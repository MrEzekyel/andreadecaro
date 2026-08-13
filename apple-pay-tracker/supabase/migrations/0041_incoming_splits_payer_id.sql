drop function if exists public.incoming_splits();

create function public.incoming_splits()
returns table(
  split_id uuid,
  amount_owed numeric,
  status text,
  settled_at timestamptz,
  settle_requested_at timestamptz,
  payer_name text,
  payer_handle text,
  payer_user_id uuid,
  merchant text,
  occurred_at timestamptz,
  total_amount numeric
)
language sql
security definer
set search_path = public
as $$
  select
    s.id,
    s.amount_owed,
    s.status,
    s.settled_at,
    s.settle_requested_at,
    coalesce(pr.display_name, pr.handle, 'Un amico'),
    pr.handle,
    pa.user_id,
    pa.merchant_name,
    pa.occurred_at,
    pa.amount
  from public.payment_splits s
  join public.people pe on pe.id = s.person_id
  join public.payments pa on pa.id = s.payment_id
  left join public.profiles pr on pr.user_id = pa.user_id
  where pe.linked_user_id = auth.uid()
    and s.status in ('pending', 'accepted')
  order by pa.occurred_at desc;
$$;
