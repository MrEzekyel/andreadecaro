-- handle_new_user() e' una funzione trigger: viene invocata dal trigger nel
-- contesto del proprietario della tabella, quindi togliere EXECUTE ai ruoli
-- esposti non ne impedisce il funzionamento — impedisce solo che venga
-- chiamata a mano via /rest/v1/rpc.
revoke all on function public.handle_new_user() from public, anon, authenticated;
