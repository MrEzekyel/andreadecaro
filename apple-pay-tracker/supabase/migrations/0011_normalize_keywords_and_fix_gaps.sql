-- Gli spazi in coda ('pam ', 'ip ', 'tim ') erano una difesa artigianale
-- contro i match a meta' parola. Ora quel controllo lo fa la Edge Function
-- in modo esplicito, quindi le chiavi tornano pulite.
update public.default_merchant_categories
set keyword = trim(keyword)
where keyword <> trim(keyword);

-- Catene che le chiavi generiche non possono raggiungere: 'iper' e' sotto
-- i 5 caratteri, quindi richiede parola intera e non prende "ipercoop".
insert into public.default_merchant_categories (keyword, category) values
  ('ipercoop', 'Spesa'),
  ('iperal', 'Spesa'),
  ('unes', 'Spesa'),
  ('conad city', 'Spesa'),
  ('carrefour market', 'Spesa'),
  ('lidl italia', 'Spesa')
on conflict (keyword) do nothing;

-- Eventuali duplicati creati dal trim vanno tolti, tenendo la riga piu' vecchia.
delete from public.default_merchant_categories a
using public.default_merchant_categories b
where a.keyword = b.keyword and a.id > b.id;
