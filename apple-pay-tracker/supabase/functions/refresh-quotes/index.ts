// Prezzo di adesso per gli asset a quotazione pubblica.
//
// Diversa da `sync-prices`, che ogni sera ricostruisce tutto lo storico: qui
// si chiede solo l'ultima quotazione e si aggiorna la riga di oggi. Serve
// perche' il broker mostra il prezzo del momento, e leggere un valore fermo
// alla chiusura di ieri fa apparire scarti che sembrano errori di calcolo
// mentre sono solo due istantanee prese in momenti diversi.
//
// Non accetta input e risponde con dei conteggi: nessun dato di portafoglio
// esce da qui, ed e' il motivo per cui puo' stare senza JWT.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function quotaOra(symbol: string): Promise<number | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${
    encodeURIComponent(symbol)
  }?range=1d&interval=1m`;

  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Yahoo ${symbol}: HTTP ${res.status}`);

  const meta = (await res.json()).chart?.result?.[0]?.meta;
  const prezzo = meta?.regularMarketPrice;
  return typeof prezzo === "number" && prezzo > 0 ? prezzo : null;
}

async function cambio(valuta: string): Promise<number | null> {
  const res = await fetch(`https://api.frankfurter.app/latest?from=${valuta}&to=EUR`);
  if (!res.ok) return null;
  const rate = (await res.json())?.rates?.EUR;
  return typeof rate === "number" ? rate : null;
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: assets, error } = await supabase
    .from("assets")
    .select("id, name, price_symbol, quote_currency")
    .eq("price_source", "yahoo")
    .eq("archived", false);

  if (error) {
    return new Response(JSON.stringify({ errore: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const oggi = new Date().toISOString().slice(0, 10);
  const cambiVisti = new Map<string, number | null>();
  const esiti = [];
  let aggiornati = 0;

  for (const asset of assets ?? []) {
    try {
      // Un prezzo di esecuzione reale o un valore messo a mano valgono piu' di
      // una quotazione di mercato: se per oggi ce n'e' gia' uno, non si tocca.
      const { data: altra } = await supabase
        .from("asset_prices")
        .select("source")
        .eq("asset_id", asset.id)
        .eq("on_date", oggi)
        .neq("source", "yahoo")
        .maybeSingle();

      if (altra) {
        esiti.push({ asset: asset.name, saltato: `gia' presente (${altra.source})` });
        continue;
      }

      let prezzo = await quotaOra(asset.price_symbol!);
      if (prezzo === null) {
        esiti.push({ asset: asset.name, saltato: "quotazione non disponibile" });
        continue;
      }

      if (asset.quote_currency !== "EUR") {
        if (!cambiVisti.has(asset.quote_currency)) {
          cambiVisti.set(asset.quote_currency, await cambio(asset.quote_currency));
        }
        const tasso = cambiVisti.get(asset.quote_currency);
        if (!tasso) {
          esiti.push({ asset: asset.name, saltato: "cambio non disponibile" });
          continue;
        }
        prezzo *= tasso;
      }

      const { error: e } = await supabase.from("asset_prices").upsert(
        {
          asset_id: asset.id,
          on_date: oggi,
          close_eur: Number(prezzo.toFixed(8)),
          source: "yahoo",
        },
        { onConflict: "asset_id,on_date" },
      );
      if (e) throw new Error(e.message);

      aggiornati++;
      esiti.push({ asset: asset.name, prezzo: Number(prezzo.toFixed(6)) });
    } catch (e) {
      esiti.push({ asset: asset.name, errore: String(e) });
    }
  }

  return new Response(JSON.stringify({ aggiornati, esiti }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
