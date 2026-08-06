// Completa le rate dei piani di accumulo con il prezzo dell'istante in cui
// l'acquisto e' datato: le 10 del mattino, ora italiana.
//
// Il database la rata la sa inserire da solo, ma non sa a che prezzo: quello
// di un momento preciso della giornata va chiesto alla fonte intraday, che e'
// il motivo per cui questo pezzo sta qui e non in una funzione SQL.
//
// Non accetta input e risponde solo con dei conteggi: non espone niente del
// portafoglio, ed e' per questo che puo' stare senza JWT e farsi chiamare
// dallo scheduler.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Oltre questa distanza dall'orario dell'acquisto il prezzo non lo rappresenta piu'. */
const MAX_SCOSTAMENTO_GIORNI = 7;

type Quota = { istante: string; prezzo: number };

/**
 * Prima quotazione disponibile dall'istante richiesto in poi.
 *
 * "Da quel momento in poi" e non "il piu' vicino": se la rata cade a mercato
 * chiuso — un sabato, un festivo — il broker compra alla riapertura, non il
 * venerdi' prima. Prendere la quotazione precedente vorrebbe dire datare
 * l'acquisto a un prezzo che in quel momento non era piu' disponibile.
 */
async function quotaDa(symbol: string, istante: Date): Promise<Quota | null> {
  const da = Math.floor(istante.getTime() / 1000) - 86400;
  const a = Math.floor(istante.getTime() / 1000) + MAX_SCOSTAMENTO_GIORNI * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${
    encodeURIComponent(symbol)
  }?period1=${da}&period2=${a}&interval=5m`;

  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Yahoo ${symbol}: HTTP ${res.status}`);

  const r = (await res.json()).chart?.result?.[0];
  const ts: number[] = r?.timestamp ?? [];
  const close: (number | null)[] = r?.indicators?.quote?.[0]?.close ?? [];

  for (let i = 0; i < ts.length; i++) {
    if (close[i] == null) continue;
    const quando = ts[i] * 1000;
    if (quando < istante.getTime()) continue;
    return { istante: new Date(quando).toISOString(), prezzo: close[i]! };
  }
  return null;
}

/** Cambio verso euro del giorno indicato. */
async function cambio(valuta: string, giorno: string): Promise<number | null> {
  const res = await fetch(
    `https://api.frankfurter.app/${giorno}?from=${valuta}&to=EUR`,
  );
  if (!res.ok) return null;
  const rate = (await res.json())?.rates?.EUR;
  return typeof rate === "number" ? rate : null;
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: rate, error } = await supabase
    .from("investments")
    .select("id, amount, occurred_at, asset_id, assets!inner(name, price_symbol, quote_currency, price_source)")
    .eq("status", "estimated")
    .eq("kind", "buy")
    .eq("assets.price_source", "yahoo")
    .order("occurred_at");

  if (error) {
    return new Response(JSON.stringify({ errore: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const esiti = [];

  for (const r of (rate ?? []) as unknown as {
    id: string;
    amount: number;
    occurred_at: string;
    assets: { name: string; price_symbol: string; quote_currency: string };
  }[]) {
    const asset = r.assets;
    try {
      const istante = new Date(r.occurred_at);
      const quota = await quotaDa(asset.price_symbol, istante);

      if (!quota) {
        // Nessuna quotazione ancora: la borsa non ha aperto, o la fonte non ha
        // dati per quel giorno. Si riprova domani invece di ripiegare su un
        // prezzo che non c'entra.
        esiti.push({ asset: asset.name, completata: false, motivo: "quotazione non ancora disponibile" });
        continue;
      }

      let prezzo = quota.prezzo;
      if (asset.quote_currency !== "EUR") {
        const tasso = await cambio(asset.quote_currency, quota.istante.slice(0, 10));
        if (tasso === null) {
          esiti.push({ asset: asset.name, completata: false, motivo: "cambio non disponibile" });
          continue;
        }
        prezzo *= tasso;
      }

      if (!(prezzo > 0)) {
        esiti.push({ asset: asset.name, completata: false, motivo: "prezzo non valido" });
        continue;
      }

      const { error: e } = await supabase
        .from("investments")
        .update({
          quantity: Number((Number(r.amount) / prezzo).toFixed(12)),
          unit_price: Number(prezzo.toFixed(8)),
          settled_on: quota.istante.slice(0, 10),
          status: "settled",
        })
        .eq("id", r.id);
      if (e) throw new Error(e.message);

      esiti.push({
        asset: asset.name,
        completata: true,
        quotazione_delle: quota.istante,
        prezzo: Number(prezzo.toFixed(6)),
      });
    } catch (e) {
      esiti.push({ asset: asset.name, completata: false, motivo: String(e) });
    }
  }

  return new Response(
    JSON.stringify({ eseguita: new Date().toISOString(), esiti }, null, 2),
    { headers: { "Content-Type": "application/json" } },
  );
});
