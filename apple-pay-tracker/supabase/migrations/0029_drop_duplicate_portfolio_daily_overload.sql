-- Aggiungendo p_group nella 0024 era rimasta anche la firma vecchia a un solo
-- parametro: due funzioni chiamate portfolio_daily, entrambe risolvibili a
-- zero argomenti (hanno tutti i parametri di default). Chiamandola senza
-- argomenti, come fa l'app, la scelta fra le due era ambigua: a volte andava,
-- a volte no, a seconda di cosa la cache dello schema di PostgREST decideva
-- in quel momento. Era questo il grafico che spariva al secondo caricamento
-- della schermata.
drop function if exists public.portfolio_daily(uuid);

notify pgrst, 'reload schema';
