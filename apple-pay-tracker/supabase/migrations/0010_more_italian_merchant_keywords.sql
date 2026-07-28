-- Ampliamento delle regole predefinite con le catene italiane mancanti
-- (fra cui "todis", che al primo pagamento reale non veniva riconosciuto).
--
-- Le chiavi restano volutamente specifiche: una parola troppo generica
-- produrrebbe falsi positivi, e una categoria sbagliata e' peggio di nessuna
-- categoria, perche' non si nota e falsa le statistiche.

insert into public.default_merchant_categories (keyword, category) values
  ('todis', 'Spesa'), ('sisa', 'Spesa'), ('famila', 'Spesa'),
  ('interspar', 'Spesa'), ('eurospar', 'Spesa'), ('carrefour express', 'Spesa'),
  ('simply', 'Spesa'), ('tuodi', 'Spesa'), ('dpiu', 'Spesa'), ('dpiù', 'Spesa'),
  ('prezzemolo', 'Spesa'), ('naturasi', 'Spesa'), ('natura si', 'Spesa'),
  ('alimentari', 'Spesa'), ('supermercat', 'Spesa'), ('macelleria', 'Spesa'),
  ('panificio', 'Spesa'), ('panetteria', 'Spesa'), ('fruttivendolo', 'Spesa'),
  ('ortofrutta', 'Spesa'), ('salumeria', 'Spesa'), ('pescheria', 'Spesa'),
  ('pizzeri', 'Ristorazione'), ('gelateria', 'Ristorazione'),
  ('pasticceria', 'Ristorazione'), ('tavola calda', 'Ristorazione'),
  ('rosticceria', 'Ristorazione'), ('birreria', 'Ristorazione'),
  ('enoteca', 'Ristorazione'), ('sushi', 'Ristorazione'),
  ('poke', 'Ristorazione'), ('roadhouse', 'Ristorazione'),
  ('old wild west', 'Ristorazione'), ('autogrill', 'Ristorazione'),
  ('chef express', 'Ristorazione'), ('venchi', 'Ristorazione'),
  ('grom', 'Ristorazione'),
  ('trenord', 'Trasporti'), ('cotral', 'Trasporti'), ('anm ', 'Trasporti'),
  ('amat', 'Trasporti'), ('tper', 'Trasporti'), ('flixbus', 'Trasporti'),
  ('blablacar', 'Trasporti'), ('parcheggio', 'Trasporti'),
  ('easypark', 'Trasporti'), ('mytaxi', 'Trasporti'), ('agip', 'Trasporti'),
  ('repsol', 'Trasporti'), ('keropetrol', 'Trasporti'),
  ('carburant', 'Trasporti'), ('distributore', 'Trasporti'),
  ('farmacie', 'Salute'), ('dentist', 'Salute'), ('ottica', 'Salute'),
  ('laborator', 'Salute'), ('fisioterap', 'Salute'),
  ('euronics', 'Shopping'), ('trony', 'Shopping'), ('expert', 'Shopping'),
  ('comet', 'Shopping'), ('cisalfa', 'Shopping'), ('game7', 'Shopping'),
  ('kasanova', 'Shopping'), ('tiger', 'Shopping'), ('flying tiger', 'Shopping'),
  ('action', 'Shopping'), ('primark', 'Shopping'), ('ovs', 'Shopping'),
  ('calzedonia', 'Shopping'), ('intimissimi', 'Shopping'),
  ('tezenis', 'Shopping'), ('douglas', 'Shopping'), ('sephora', 'Shopping'),
  ('acqua e sapone', 'Shopping'), ('tigota', 'Shopping'), ('tigotà', 'Shopping'),
  ('obi ', 'Casa'), ('bricoman', 'Casa'), ('bricofer', 'Casa'),
  ('ferramenta', 'Casa'),
  ('acea', 'Utenze'), ('sorgenia', 'Utenze'), ('edison', 'Utenze'),
  ('illumia', 'Utenze'), ('ho. mobile', 'Utenze'), ('very mobile', 'Utenze'),
  ('poste', 'Utenze'),
  ('libreria', 'Cultura'), ('ucicinemas', 'Cultura'), ('teatro', 'Cultura'),
  ('museo', 'Cultura'),
  ('piscina', 'Sport'), ('fitness', 'Sport'), ('crossfit', 'Sport'),
  ('padel', 'Sport'),
  ('audible', 'Abbonamenti'), ('icloud', 'Abbonamenti'),
  ('dropbox', 'Abbonamenti'), ('github', 'Abbonamenti'),
  ('figma', 'Abbonamenti'), ('canva', 'Abbonamenti'),
  ('claude', 'Abbonamenti'), ('chatgpt', 'Abbonamenti')
on conflict (keyword) do nothing;
