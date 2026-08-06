// Riempie public.asset_prices con lo storico giornaliero degli asset che hanno
// un prezzo pubblico, cosi' l'app puo' disegnare il valore nel tempo senza
// dipendere da una API esterna a ogni apertura.
//
// Non accetta nessun input e non restituisce dati di portafoglio: risponde solo
// con dei conteggi. E' l'unico motivo per cui puo' stare senza JWT ed essere
// chiamata dallo scheduler.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Scarto mediano oltre il quale un prezzo scaricato non e' credibile. Vedi `verifica`. */
const SCARTO_MEDIANO_MAX_PCT = 5;

type Serie = Map<string, number>;

const isoDay = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);

async function serieYahoo(symbol: string, da: string): Promise<Serie> {
  const p1 = Math.floor(new Date(da + "T00:00:00Z").getTime() / 1000);
  const p2 = Math.floor(Date.now() / 1000) + 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${
    encodeURIComponent(symbol)
  }?period1=${p1}&period2=${p2}&interval=1d`;

  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Yahoo ${symbol}: HTTP ${res.status}`);

  const r = (await res.json()).chart?.result?.[0];
  const ts: number[] = r?.timestamp ?? [];
  const close: (number | null)[] = r?.indicators?.quote?.[0]?.close ?? [];

  const out: Serie = new Map();
  for (let i = 0; i < ts.length; i++) {
    if (close[i] != null) out.set(isoDay(ts[i]), close[i]!);
  }
  return out;
}

/**
 * Cambi giornalieri verso euro. I giorni senza quotazione (weekend, festivi)
 * ereditano l'ultimo cambio noto: e' cio' che fa una banca, e comunque meglio
 * che buttare via il prezzo di quel giorno.
 */
async function cambiVersoEuro(valuta: string, da: string): Promise<Serie> {
  const oggi = new Date().toISOString().slice(0, 10);
  const url =
    `https://api.frankfurter.app/${da}..${oggi}?from=${valuta}&to=EUR`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Cambi ${valuta}: HTTP ${res.status}`);

  const rates: Record<string, Record<string, number>> = (await res.json()).rates ?? {};
  const out: Serie = new Map();
  for (const [giorno, r] of Object.entries(rates)) {
    if (typeof r?.EUR === "number") out.set(giorno, r.EUR);
  }
  return out;
}

function conCambio(prezzi: Serie, cambi: Serie): Serie {
  const giorniCambio = [...cambi.keys()].sort();
  const out: Serie = new Map();
  let ultimo: number | null = null;
  let i = 0;

  for (const giorno of [...prezzi.keys()].sort()) {
    while (i < giorniCambio.length && giorniCambio[i] <= giorno) {
      ultimo = cambi.get(giorniCambio[i])!;
      i++;
    }
    if (ultimo === null) continue; // nessun cambio ancora noto: salto il giorno
    out.set(giorno, prezzi.get(giorno)! * ultimo);
  }
  return out;
}

/**
 * I prezzi di esecuzione reali sul conto sono la verita' a cui confrontarsi.
 * Serve perche' esistono quotazioni che dichiarano una valuta e ne servono
 * un'altra: i numeri restano plausibili ma sbagliati del 15%, e senza questo
 * controllo l'errore non si vedrebbe mai.
 *
 * Si guarda la mediana, non il massimo: un ordine eseguito a meta' giornata su
 * un asset volatile puo' distare parecchio dalla chiusura di quel giorno senza
 * che nulla sia rotto, mentre un errore di valuta sposta *tutti* i punti nello
 * stesso modo — ed e' esattamente quello che la mediana vede e il massimo no.
 */
function verifica(prezzi: Serie, riferimenti: { on_date: string; close_eur: number }[]) {
  const scarti: number[] = [];
  for (const r of riferimenti) {
    const scaricato = prezzi.get(r.on_date);
    if (scaricato === undefined) continue;
    scarti.push(Math.abs(scaricato / Number(r.close_eur) - 1) * 100);
  }
  if (scarti.length === 0) {
    return { controllati: 0, scarto_mediano: null, scarto_max: null, ok: true };
  }
  scarti.sort((a, b) => a - b);
  const mediana = scarti[Math.floor(scarti.length / 2)];
  return {
    controllati: scarti.length,
    scarto_mediano: +mediana.toFixed(2),
    scarto_max: +Math.max(...scarti).toFixed(2),
    ok: mediana <= SCARTO_MEDIANO_MAX_PCT,
  };
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

  const esiti = [];

  for (const asset of assets ?? []) {
    try {
      // Prima del primo acquisto il prezzo non serve a niente: scaricare da li'
      // tiene il grafico allineato alla storia vera del portafoglio.
      const { data: prima } = await supabase
        .from("investments")
        .select("occurred_at")
        .eq("asset_id", asset.id)
        .order("occurred_at", { ascending: true })
        .limit(1);

      const da = prima?.[0]?.occurred_at
        ? String(prima[0].occurred_at).slice(0, 10)
        : new Date(Date.now() - 3 * 365 * 864e5).toISOString().slice(0, 10);

      let prezzi = await serieYahoo(asset.price_symbol!, da);
      if (asset.quote_currency !== "EUR") {
        prezzi = conCambio(prezzi, await cambiVersoEuro(asset.quote_currency, da));
      }

      const { data: altreFonti } = await supabase
        .from("asset_prices")
        .select("on_date, close_eur, source")
        .eq("asset_id", asset.id)
        .neq("source", "yahoo");

      const riferimenti = (altreFonti ?? []).filter((r) => r.source === "fill");
      const controllo = verifica(prezzi, riferimenti);
      if (!controllo.ok) {
        // Meglio nessun dato che dati sbagliati con l'aria di essere giusti.
        esiti.push({ asset: asset.name, scritti: 0, saltato: "prezzi incoerenti", ...controllo });
        continue;
      }

      // Si riscrivono solo le righe di questa fonte: i prezzi inseriti a mano e
      // quelli ricavati dalle esecuzioni reali non vanno mai sovrascritti. Non
      // basta cancellare le righe 'yahoo': anche l'upsert successivo, in
      // conflitto, riscriverebbe una riga di un'altra fonte.
      await supabase.from("asset_prices").delete()
        .eq("asset_id", asset.id).eq("source", "yahoo");

      const intoccabili = new Set((altreFonti ?? []).map((r) => r.on_date));

      const righe = [...prezzi.entries()]
        .filter(([d, v]) => Number.isFinite(v) && v > 0 && !intoccabili.has(d))
        .map(([on_date, close_eur]) => ({
          asset_id: asset.id,
          on_date,
          close_eur: Number(close_eur.toFixed(8)),
          source: "yahoo",
        }));

      for (let i = 0; i < righe.length; i += 500) {
        const { error: e } = await supabase.from("asset_prices")
          .upsert(righe.slice(i, i + 500), { onConflict: "asset_id,on_date" });
        if (e) throw new Error(e.message);
      }

      esiti.push({ asset: asset.name, scritti: righe.length, ...controllo });
    } catch (e) {
      esiti.push({ asset: asset.name, scritti: 0, errore: String(e) });
    }
  }

  return new Response(
    JSON.stringify({ eseguita: new Date().toISOString(), esiti }, null, 2),
    { headers: { "Content-Type": "application/json" } },
  );
});
