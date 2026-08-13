// Ricerca strumenti finanziari, seconda meta' del sistema ibrido.
//
// La tabella `instruments` (migrazione 0040) copre i piu' comuni e risponde
// senza rete; questa function e' il ripiego per tutto il resto — chi investe
// fuori dai grandi indici SEPA, o in un ETF meno diffuso. Due azioni:
//
//   ?q=<testo>       cerca per nome su Yahoo Finance, restituisce candidati
//   ?probe=<simbolo> verifica che un simbolo abbia davvero una quotazione,
//                    prima di lasciarlo entrare in `assets`
//
// La probe non e' opzionale: creare un asset da un simbolo mai verificato
// significherebbe fidarsi di un suggerimento che potrebbe essere delistato,
// scritto male, o semplicemente non esistere piu'. Lo stesso principio di
// `sync-prices`, che "si valida da sola" prima di scrivere un prezzo.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type SearchResult = {
  symbol: string;
  name: string;
  currency: string | null;
  exchange: string | null;
};

/**
 * Solo ETF, azioni e criptovalute: le altre categorie che Yahoo restituisce
 * (fondi comuni non quotati, indici, futures) non sono asset che l'app sa
 * valorizzare — un fondo indice come "^GSPC" non ha un prezzo "posseduto".
 */
const QUOTE_TYPES = new Set(["ETF", "EQUITY", "CRYPTOCURRENCY"]);

async function search(query: string): Promise<SearchResult[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${
    encodeURIComponent(query)
  }&quotesCount=10&newsCount=0`;

  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Yahoo search: HTTP ${res.status}`);

  const quotes = (await res.json())?.quotes ?? [];
  const out: SearchResult[] = [];

  for (const q of quotes) {
    if (!QUOTE_TYPES.has(q?.quoteType)) continue;
    if (!q?.symbol) continue;
    out.push({
      symbol: q.symbol,
      name: q.longname ?? q.shortname ?? q.symbol,
      currency: null, // Yahoo non lo da' qui: la probe lo conferma dopo.
      exchange: q.exchDisp ?? q.exchange ?? null,
    });
  }

  return out.slice(0, 8);
}

async function probe(
  symbol: string
): Promise<{ symbol: string; name: string; currency: string; price: number } | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${
    encodeURIComponent(symbol)
  }?range=5d&interval=1d`;

  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;

  const meta = (await res.json())?.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  if (typeof price !== "number" || !(price > 0)) return null;
  if (!meta?.currency) return null;

  return {
    symbol: meta.symbol ?? symbol,
    name: meta.longName ?? meta.shortName ?? symbol,
    currency: meta.currency,
    price,
  };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const symbol = url.searchParams.get("probe");

  try {
    if (symbol) {
      const result = await probe(symbol);
      return result
        ? jsonResponse({ ok: true, instrument: result })
        : jsonResponse({ ok: false, error: "not_found" }, 404);
    }

    if (q && q.trim().length >= 2) {
      const results = await search(q.trim());
      return jsonResponse({ results });
    }

    return jsonResponse({ error: "missing q or probe parameter" }, 400);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 502);
  }
});
