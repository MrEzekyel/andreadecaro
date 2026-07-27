-- Anche le regole keyword puntano a una categoria vera, non a un nome libero:
-- rinominare una categoria non deve rompere le regole che la usano.
alter table public.merchant_categories
  add column if not exists category_id uuid references public.categories (id) on delete cascade;

update public.merchant_categories mc
set category_id = c.id
from public.categories c
where c.user_id = mc.user_id
  and c.name = mc.category
  and mc.category_id is null;

-- Le righe senza corrispondenza non hanno piu' significato una volta tolta
-- la colonna testuale.
delete from public.merchant_categories where category_id is null;

alter table public.merchant_categories drop column if exists category;
alter table public.merchant_categories alter column category_id set not null;
