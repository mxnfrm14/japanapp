begin;

-- Existing entries keep an empty title; the UI falls back to their first line.
alter table public.diary_entry
  add column if not exists title text not null default '';

commit;
