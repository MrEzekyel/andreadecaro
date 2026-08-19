import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

/**
 * Le novita' dell'app, dalla piu' recente.
 *
 * Sta in un file del bundle e non su Supabase: cambia esattamente quando
 * cambia il codice, quindi arriva con lo stesso aggiornamento che porta le
 * novita' che descrive. Leggerlo dalla rete vorrebbe dire poter mostrare un
 * elenco che parla di cose non ancora installate.
 *
 * Scritto per chi usa l'app, non per chi la scrive: "la retta di ritmo parte
 * dalla base vera della linea" e' un messaggio di commit, non una novita'.
 */
export type ChangelogEntry = {
  /** Stabile nel tempo: e' quello che distingue le voci gia' lette. */
  id: string;
  date: string;
  title: string;
  items: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: "2026-08-19",
    date: "2026-08-19",
    title: "Obiettivi di risparmio",
    items: [
      "Da Impostazioni → Limiti puoi dire quanto vuoi mettere da parte ogni mese. Diventa un tetto di spesa in Home: risparmiare 1.000 € su 2.000 di entrate significa non spenderne più di 1.000.",
      "Gli investimenti contano come risparmio: un PAC da 500 € copre già metà di un obiettivo da 1.000 €.",
      "Se limite di spesa e obiettivo non possono valere insieme, l'app te lo dice e ti propone il numero che li rimette d'accordo — un tocco per applicarlo.",
      "Stesso controllo fra limite settimanale e mensile: 500 € a settimana valgono 2.174 € al mese, quindi sotto un mensile da 1.000 € non ti fermano mai. Ora si vede.",
      "Nel semicerchio, quando ci sono entrambi, una tacca segna quello che sfori per primo, e il numero al centro dice a quale dei due si riferisce.",
      "Sui mesi già chiusi trovi il verdetto: obiettivo centrato, o mancato di quanto.",
      "Nelle liste, una spesa divisa mostra ora quanto è toccato a te, con il totale pagato in piccolo sotto e se la divisione è saldata o in attesa.",
    ],
  },
  {
    id: "2026-08-13",
    date: "2026-08-13",
    title: "Dividere le spese con gli amici",
    items: [
      "Trovi il tuo Clinck Tag da Impostazioni → Profilo: condividilo, e i tuoi amici possono aggiungerti cercandolo.",
      "Quando dividi una spesa con un amico che ha Clinck, la sua quota gli arriva sull'app: la accetta o la rifiuta, e se la accetta la spesa entra nei suoi conti.",
      "Chi non ha Clinck resta come prima: le sue quote continuano a vivere in \"Ti devono\".",
      "Se un amico scarica l'app dopo, dal suo nome in Divisioni c'è \"Associa\": le quote già aperte diventano sue, senza reinserire niente.",
      "Il nome dell'esercente ora propone quelli che hai già usato, e i punti vendita della stessa insegna stanno insieme: tutti i McDonald's fanno una voce sola in \"dove spendi di più\".",
    ],
  },
  {
    id: "2026-08-11",
    date: "2026-08-11",
    title: "La Home, ridisegnata",
    items: [
      "Due schede in cima: Uscite ed Entrate, per lo stesso mese.",
      "Il budget è un semicerchio: quanto hai speso, quanto resta, e una tacca che segna dove saresti spendendo uguale ogni giorno.",
      "Accanto, tre numeri nuovi: quanto spendi al giorno, dove finisci di questo passo, e quanti giorni mancano.",
      "Introiti e uscite a confronto sulla stessa scala: lo spazio fra le due barre è quello che ti avanza.",
      "Un grafico dice se questo mese è pesante rispetto agli ultimi sei.",
      "In Entrate: da dove arrivano i soldi, quanto te ne resta giorno per giorno, e le entrate mese per mese dell'anno.",
    ],
  },
  {
    id: "2026-08-10",
    date: "2026-08-10",
    title: "Protezione e uso senza rete",
    items: [
      "Blocco con Face ID: da Impostazioni, chiede il volto all'apertura e dopo mezzo minuto fuori dall'app.",
      "L'app funziona senza connessione: spese, limiti e investimenti mostrano l'ultima lettura riuscita, dicendo a quando risale.",
      "Due mesi di automazione gratis alla registrazione, e una sezione per invitare gli amici.",
      "Le spese fatte all'estero vengono convertite in euro al cambio del giorno in cui le hai fatte.",
    ],
  },
  {
    id: "2026-08-09",
    date: "2026-08-09",
    title: "Grafici piu' onesti",
    items: [
      "La linea tratteggiata del ritmo parte da dove parte davvero la tua spesa, non sempre da zero.",
      "Escludendo i costi fissi, il tetto del grafico si abbassa di conseguenza: il margine che vedi e' quello che hai davvero.",
    ],
  },
  {
    id: "2026-08-07",
    date: "2026-08-07",
    title: "I tuoi dati, sempre recuperabili",
    items: [
      "Esporta tutto in CSV da Impostazioni: spese, introiti, investimenti e divisioni, pronti per il foglio di calcolo.",
      "Password dimenticata: si recupera con un codice a otto cifre, senza uscire dall'app.",
      "Le spese che l'automazione non riesce a mandare finiscono in un file e si reimportano da Impostazioni, senza doppioni.",
      "A fine mese l'app chiede una volta se il totale corrisponde all'estratto conto.",
      "Quando una schermata non riesce a leggere lo dice, invece di mostrare zero come se fosse un fatto.",
    ],
  },
  {
    id: "2026-08-06",
    date: "2026-08-06",
    title: "Investimenti",
    items: [
      "Nuova sezione con il valore reale del portafoglio, la ripartizione e l'andamento nel tempo.",
      "I piani di accumulo registrano le rate da soli, al prezzo dell'istante in cui il broker le esegue.",
    ],
  },
];

const SEEN_KEY = "changelog-visto";

/**
 * Se c'e' qualcosa di nuovo da leggere, e come segnarlo letto.
 *
 * Il pallino esiste perche' un changelog che nessuno apre non dice niente a
 * nessuno: e' proprio il punto di avere un ritmo di aggiornamenti e non
 * mostrarlo.
 */
export function useChangelog() {
  const latest = CHANGELOG[0]?.id ?? null;
  /** `null` finche' non si sa: senza, il pallino lampeggerebbe a ogni avvio. */
  const [seen, setSeen] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY).then(setSeen);
  }, []);

  const markRead = useCallback(async () => {
    if (!latest) return;
    await AsyncStorage.setItem(SEEN_KEY, latest);
    setSeen(latest);
  }, [latest]);

  // Chi apre l'app per la prima volta non ha "novita'": ha l'app. Il primo
  // avvio segna il changelog come gia' visto invece di accogliere con un
  // pallino da smaltire.
  useEffect(() => {
    if (seen === null) markRead();
  }, [seen, markRead]);

  return {
    unread: seen !== undefined && seen !== null && seen !== latest,
    markRead,
  };
}
