-- Insegne dello stesso esercente sotto un nome solo.
--
-- "McDonalds Dragona" e "McDonalds Infernetto" sono due righe diverse in
-- `merchants`, quindi due voci diverse in "dove spendo di piu'" e due
-- categorie da correggere a mano. Il difetto esiste da sempre e non si vede,
-- perche' ogni riga presa da sola sembra giusta.
--
-- La soluzione e' un livello solo di raggruppamento: `parent_id` punta alla
-- riga dell'insegna (il "brand"), che e' a sua volta un `merchants` normale.
-- Niente tabella separata: il brand deve poter tenere categoria e esclusione
-- dalle classifiche esattamente come un esercente qualunque, ed e' cio' che
-- l'utente vede negli elenchi.

alter table public.merchants
  add column if not exists parent_id uuid
    references public.merchants (id) on delete set null;

create index if not exists merchants_parent_idx
  on public.merchants (user_id, parent_id);

-- L'albero e' profondo uno, sempre. Un brand di un brand renderebbe ogni
-- somma dipendente da quante volte si risale, e la prima query che si
-- dimenticasse un livello darebbe un totale plausibile e sbagliato.
create or replace function public.merchants_keep_flat()
returns trigger
language plpgsql
as $$
declare
  v_grandparent uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    new.parent_id := null;
    return new;
  end if;

  select parent_id into v_grandparent
  from public.merchants
  where id = new.parent_id;

  -- Attaccarsi a un figlio significa voler stare col suo brand.
  if v_grandparent is not null then
    new.parent_id := v_grandparent;
  end if;

  return new;
end;
$$;

drop trigger if exists merchants_keep_flat on public.merchants;
create trigger merchants_keep_flat
  before insert or update of parent_id on public.merchants
  for each row execute function public.merchants_keep_flat();

-- Se una riga che gia' aveva figli diventa a sua volta figlia, i suoi figli
-- salgono con lei invece di restare appesi a un livello che non esiste piu'.
create or replace function public.merchants_reparent_children()
returns trigger
language plpgsql
as $$
begin
  if new.parent_id is not null then
    update public.merchants
    set parent_id = new.parent_id
    where parent_id = new.id
      and id <> new.parent_id;
  end if;
  return null;
end;
$$;

drop trigger if exists merchants_reparent_children on public.merchants;
create trigger merchants_reparent_children
  after update of parent_id on public.merchants
  for each row
  when (new.parent_id is not null)
  execute function public.merchants_reparent_children();

-- ── La regola ──────────────────────────────────────────────────────────────
-- Due nomi appartengono alla stessa insegna se condividono un prefisso di
-- parole intere abbastanza specifico da essere un marchio.
--
-- Il pericolo non e' non raggruppare: e' raggruppare cose diverse. "Farmacia
-- Rossi" e "Farmacia Verdi" condividono un prefisso lungo otto lettere e non
-- sono la stessa farmacia. Per questo un prefisso di una parola sola passa
-- solo se non e' un nome di *categoria merceologica*, che in italiano sta
-- quasi sempre in testa al nome.
create or replace function public.merchant_generic_word(p_word text)
returns boolean
language sql
immutable
as $$
  select p_word = any (array[
    'bar','caffe','caffè','cafe','ristorante','pizzeria','trattoria','osteria',
    'pub','birreria','enoteca','gelateria','pasticceria','panificio',
    'panetteria','forno','rosticceria','friggitoria','paninoteca','sushi',
    'macelleria','pescheria','alimentari','market','supermercato','minimarket',
    'farmacia','parafarmacia','tabacchi','tabaccheria','edicola','cartoleria',
    'libreria','profumeria','ottica','erboristeria','lavanderia','autolavaggio',
    'officina','carrozzeria','distributore','carburanti','stazione',
    'hotel','albergo','residence','agriturismo','ostello',
    'centro','studio','negozio','ferramenta','abbigliamento','calzature',
    'parrucchiere','barbiere','estetica','palestra','ambulatorio','clinica',
    'poliambulatorio','laboratorio','agenzia','societa','società','ditta',
    'azienda','impresa','cooperativa','associazione','fondazione',
    'via','viale','piazza','piazzale','corso','largo','vicolo','strada',
    'shop','store','the','and','del','della','delle','dei','degli','di','da',
    'il','la','le','lo','gli','un','una','san','santa','santo','sant'
  ]);
$$;

/**
 * Il prefisso comune fra due nomi normalizzati, o NULL se non basta a
 * identificare un'insegna.
 *
 * Confronta **parole intere** e non caratteri: su caratteri "Conad" e
 * "Conforama" condividerebbero "Con", che non vuol dire niente.
 */
create or replace function public.merchant_common_prefix(p_a text, p_b text)
returns text
language plpgsql
immutable
as $$
declare
  a text[] := string_to_array(p_a, ' ');
  b text[] := string_to_array(p_b, ' ');
  i int := 1;
  n int := 0;
begin
  while i <= coalesce(array_length(a, 1), 0)
    and i <= coalesce(array_length(b, 1), 0)
    and a[i] = b[i]
  loop
    n := i;
    i := i + 1;
  end loop;

  if n = 0 then
    return null;
  end if;

  -- Stesso nome: non c'e' niente da raggruppare, e' lo stesso esercente.
  if n = array_length(a, 1) and n = array_length(b, 1) then
    return null;
  end if;

  if n = 1 then
    -- Una sigla di due o tre lettere combacia troppo spesso per caso, e un
    -- numero non e' mai un marchio.
    if length(a[1]) < 4 or a[1] ~ '^[0-9]+$' then
      return null;
    end if;
    if public.merchant_generic_word(a[1]) then
      return null;
    end if;
  end if;

  -- "bar della" non e' un'insegna piu' di quanto lo sia "bar".
  if n = 2
    and public.merchant_generic_word(a[1])
    and public.merchant_generic_word(a[2])
  then
    return null;
  end if;

  return array_to_string(a[1:n], ' ');
end;
$$;

/** Stessa normalizzazione che l'app e la Edge Function usano da sempre. */
create or replace function public.merchant_normalize(p_name text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(btrim(p_name)), '\s+', ' ', 'g');
$$;

/** Le prime `p_words` parole di un nome, con le maiuscole originali. */
create or replace function public.merchant_display_prefix(p_display text, p_words int)
returns text
language sql
immutable
as $$
  select array_to_string(
    (string_to_array(regexp_replace(btrim(p_display), '\s+', ' ', 'g'), ' '))[1:p_words],
    ' '
  );
$$;

/**
 * Trova l'esercente, lo crea se non c'e', e lo attacca alla sua insegna.
 *
 * È l'unico punto in cui un `merchants` nasce: prima la stessa logica stava
 * in tre copie (l'app, la Edge Function di ingestione, il recupero da file) e
 * le tre non potevano che divergere — una divergenza qui non da' errori, crea
 * gruppi diversi a seconda di *da dove* e' entrata la spesa.
 *
 * `security invoker`: la RLS deve valere. Chiamata dall'app vale
 * `auth.uid() = user_id` come per ogni altra scrittura; la Edge Function usa
 * la service key e passa l'utente esplicitamente, come gia' fa oggi.
 *
 * Restituisce anche la categoria **efficace**: quella del brand se il singolo
 * punto vendita non ne ha una propria. È il motivo per cui il raggruppamento
 * serve davvero — correggere "McDonalds" una volta vale per tutti i McDonalds,
 * anche quelli in cui non si e' ancora mai entrati.
 */
-- I nomi delle colonne restituite sono apposta diversi da quelli di
-- `merchants`: in plpgsql un parametro OUT che si chiama come una colonna
-- rende ambiguo ogni riferimento non qualificato dentro la funzione, e
-- l'errore arriva a runtime alla prima chiamata, non quando si crea.
create or replace function public.resolve_merchant(p_user_id uuid, p_name text)
returns table (
  merchant_id uuid,
  brand_id uuid,
  merchant_name text,
  brand_name text,
  effective_category_id uuid,
  effective_excluded boolean
)
language plpgsql
security invoker
as $$
declare
  v_norm text := public.merchant_normalize(p_name);
  v_display text := regexp_replace(btrim(p_name), '\s+', ' ', 'g');
  v_row public.merchants;
  v_brand public.merchants;
  v_sibling public.merchants;
  v_prefix text;
  v_words int;
begin
  if v_norm = '' then
    return;
  end if;

  -- 1. Esercente gia' noto.
  select * into v_row
  from public.merchants m
  where m.user_id = p_user_id and m.normalized_name = v_norm;

  if found then
    if v_row.parent_id is not null then
      select b.* into v_brand from public.merchants b where b.id = v_row.parent_id;
    end if;
    return query select
      v_row.id,
      v_row.parent_id,
      v_row.display_name,
      coalesce(v_brand.display_name, v_row.display_name),
      coalesce(v_row.category_id, v_brand.category_id),
      (v_row.excluded_from_stats or coalesce(v_brand.excluded_from_stats, false));
    return;
  end if;

  -- 2. Un'insegna gia' formata di cui questo nome e' una declinazione.
  --    La piu' corta fra quelle che combaciano: se esistono sia "esselunga"
  --    sia "esselunga milano", il gruppo giusto e' quello ampio — altrimenti
  --    lo stesso marchio si spezzerebbe in sottogruppi per citta'.
  select b.* into v_brand
  from public.merchants b
  where b.user_id = p_user_id
    and b.parent_id is null
    and starts_with(v_norm, b.normalized_name || ' ')
    and exists (
      select 1 from public.merchants c where c.parent_id = b.id
    )
  order by length(b.normalized_name) asc
  limit 1;

  -- 3. Nessuna insegna: cerco un fratello con cui formarne una.
  if v_brand.id is null then
    select m.* into v_sibling
    from public.merchants m
    where m.user_id = p_user_id
      and m.parent_id is null
      and public.merchant_common_prefix(v_norm, m.normalized_name) is not null
    order by
      length(public.merchant_common_prefix(v_norm, m.normalized_name)) desc,
      m.created_at asc
    limit 1;

    if v_sibling.id is not null then
      v_prefix := public.merchant_common_prefix(v_norm, v_sibling.normalized_name);
      v_words := array_length(string_to_array(v_prefix, ' '), 1);

      select * into v_brand
      from public.merchants m
      where m.user_id = p_user_id and m.normalized_name = v_prefix;

      if not found then
        -- Il brand eredita categoria ed esclusione del fratello: e' la stessa
        -- insegna, e ripartire da "da categorizzare" farebbe sparire una
        -- scelta che l'utente aveva gia' fatto.
        insert into public.merchants (
          user_id, normalized_name, display_name, category_id, excluded_from_stats
        )
        values (
          p_user_id,
          v_prefix,
          public.merchant_display_prefix(v_sibling.display_name, v_words),
          v_sibling.category_id,
          v_sibling.excluded_from_stats
        )
        on conflict (user_id, normalized_name)
          do update set display_name = public.merchants.display_name
        returning * into v_brand;
      end if;

      if v_sibling.id <> v_brand.id then
        update public.merchants m set parent_id = v_brand.id where m.id = v_sibling.id;
      end if;
    end if;
  end if;

  -- Il nome nuovo *e'* il brand appena creato (si e' pagato da "McDonalds"
  -- dopo essere stati da "McDonalds Dragona").
  if v_brand.id is not null and v_brand.normalized_name = v_norm then
    return query select
      v_brand.id, v_brand.parent_id, v_brand.display_name, v_brand.display_name,
      v_brand.category_id, v_brand.excluded_from_stats;
    return;
  end if;

  insert into public.merchants (user_id, normalized_name, display_name, parent_id)
  values (p_user_id, v_norm, v_display, v_brand.id)
  on conflict (user_id, normalized_name)
    do update set display_name = public.merchants.display_name
  returning * into v_row;

  return query select
    v_row.id,
    v_row.parent_id,
    v_row.display_name,
    coalesce(v_brand.display_name, v_row.display_name),
    coalesce(v_row.category_id, v_brand.category_id),
    (v_row.excluded_from_stats or coalesce(v_brand.excluded_from_stats, false));
end;
$$;

revoke all on function public.resolve_merchant(uuid, text) from public, anon;
grant execute on function public.resolve_merchant(uuid, text) to authenticated, service_role;

-- ── Recupero dei gruppi gia' esistenti ─────────────────────────────────────
-- I prefissi si applicano dal piu' corto al piu' lungo, per lo stesso motivo
-- del punto 2: prima "esselunga" prende tutti i suoi punti vendita, poi
-- "esselunga milano" non trova piu' nessuno libero e non spezza il gruppo.
do $$
declare
  r record;
begin
  for r in
    select coppie.user_id, coppie.prefix
    from (
      select distinct
        m.user_id,
        public.merchant_common_prefix(m.normalized_name, o.normalized_name) as prefix
      from public.merchants m
      join public.merchants o
        on o.user_id = m.user_id and o.id <> m.id
      where public.merchant_common_prefix(m.normalized_name, o.normalized_name) is not null
    ) as coppie
    order by length(coppie.prefix) asc, coppie.prefix asc
  loop
    declare
      v_brand public.merchants;
      v_seed public.merchants;
    begin
      select * into v_brand
      from public.merchants b
      where b.user_id = r.user_id and b.normalized_name = r.prefix;

      if not found then
        select * into v_seed
        from public.merchants c
        where c.user_id = r.user_id
          and c.parent_id is null
          and starts_with(c.normalized_name, r.prefix || ' ')
        order by c.created_at asc
        limit 1;

        continue when v_seed.id is null;

        insert into public.merchants (
          user_id, normalized_name, display_name, category_id, excluded_from_stats
        )
        values (
          r.user_id,
          r.prefix,
          public.merchant_display_prefix(
            v_seed.display_name,
            array_length(string_to_array(r.prefix, ' '), 1)
          ),
          v_seed.category_id,
          v_seed.excluded_from_stats
        )
        returning * into v_brand;
      end if;

      update public.merchants c
      set parent_id = v_brand.id
      where c.user_id = r.user_id
        and c.parent_id is null
        and c.id <> v_brand.id
        and starts_with(c.normalized_name, r.prefix || ' ');
    end;
  end loop;
end;
$$;
