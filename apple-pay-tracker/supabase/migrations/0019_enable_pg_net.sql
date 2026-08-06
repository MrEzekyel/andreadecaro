-- pg_net serve per far partire chiamate HTTP dal database: e' il modo standard
-- con cui pg_cron invoca una Edge Function su una schedule. Ci appoggera' il
-- recupero automatico dei prezzi degli asset (sync giornaliero).
create extension if not exists pg_net with schema extensions;
