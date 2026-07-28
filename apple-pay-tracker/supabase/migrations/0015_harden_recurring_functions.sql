-- search_path fissato: senza, un ruolo potrebbe anteporre uno schema proprio
-- e dirottare le funzioni richiamate all'interno.
alter function public.next_occurrence(date, text, integer, integer)
  set search_path = public, pg_temp;

-- materialize_recurring() elabora le regole di TUTTI gli utenti, quindi non
-- deve essere raggiungibile da /rest/v1/rpc. La esegue solo il job pg_cron,
-- che gira con privilegi propri e non passa da questi grant.
revoke all on function public.materialize_recurring() from public, anon, authenticated;
