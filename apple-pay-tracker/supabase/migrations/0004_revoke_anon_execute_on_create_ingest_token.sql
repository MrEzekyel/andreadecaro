-- Supabase concede EXECUTE di default al ruolo anon sulle nuove function:
-- la revoca esplicita evita che create_ingest_token sia raggiungibile
-- da /rest/v1/rpc senza aver effettuato l'accesso.
revoke all on function public.create_ingest_token(text) from anon;
