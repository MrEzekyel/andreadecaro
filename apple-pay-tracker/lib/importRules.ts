import { supabase } from "./supabase";
import type { NuovaRegola } from "./importReview";

/**
 * Scrittura delle regole che si ricordano fra un import e l'altro.
 *
 * Si salvano **quando l'import viene confermato**, non quando si spunta la
 * casella: chi corregge una riga, ci ripensa e torna indietro non deve
 * ritrovarsi una regola che gli riscrivera' gli import futuri. La regola
 * segue l'azione, non l'intenzione.
 */
export async function salvaRegole(nuove: NuovaRegola[]): Promise<number> {
  if (nuove.length === 0) return 0;

  const { data: auth } = await supabase.auth.getSession();
  const userId = auth.session?.user.id;
  if (!userId) return 0;

  // L'ultima scelta vince quando la stessa riga e' stata toccata due volte
  // nello stesso import: senza, l'upsert riceverebbe due righe con la stessa
  // chiave e il database rifiuterebbe il blocco intero.
  const perCriterio = new Map<string, NuovaRegola>();
  for (const regola of nuove) {
    perCriterio.set(`${regola.criterio}|${regola.confronto}`, regola);
  }

  const payload = [...perCriterio.values()].map((regola) => ({
    user_id: userId,
    criterio: regola.criterio,
    confronto: regola.confronto,
    ignora: regola.ignora,
    rinomina_in: regola.rinominaIn,
    categoria_id: regola.categoriaId,
    persona_id: regola.personaId,
    rimborso: regola.rimborso,
  }));

  // Rifare la stessa scelta aggiorna la regola che c'e' gia' invece di
  // crearne una seconda: due regole sullo stesso criterio renderebbero
  // imprevedibile quale vince.
  const { error } = await supabase
    .from("import_rules")
    .upsert(payload, { onConflict: "user_id,criterio,confronto" });

  // Le regole sono una comodita', non il dato: un import riuscito non si
  // dichiara fallito perche' non si e' potuto ricordare qualcosa. Si dice
  // quante ne sono state salvate, e zero e' una risposta onesta.
  return error ? 0 : payload.length;
}
