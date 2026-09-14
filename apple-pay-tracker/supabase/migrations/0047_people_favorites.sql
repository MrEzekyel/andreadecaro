-- Preferiti nella scelta delle persone con cui dividere.
--
-- Con venti contatti scorrere l'intero elenco per trovare le due o tre
-- persone con cui si divide quasi sempre e' il difetto che rende
-- inutilizzabile il vecchio elenco di checkbox (`SplitEditor`). Un preferito
-- e' una scelta esplicita di chi usa l'app, non calcolata dalla frequenza
-- delle divisioni passate: chi si e' appena aggiunto in rubrica e si sa gia'
-- che sara' un compagno di casa fisso non deve aspettare la prima spesa
-- divisa per comparire fra le scelte rapide.

alter table public.people
  add column if not exists is_favorite boolean not null default false;

-- Parziale: i preferiti sono una minoranza per costruzione (l'interfaccia ne
-- lascia scegliere al piu' quattro), un indice sull'intera tabella pagherebbe
-- per tutte le altre righe.
create index if not exists people_favorite_idx
  on public.people (user_id)
  where is_favorite = true;
