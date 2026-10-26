begin;

create table public.favorite (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vocabulary_item_id uuid references public.vocabulary_item(id) on delete cascade,
  kanji_item_id uuid references public.kanji_item(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint favorite_one_item_chk check (
    (vocabulary_item_id is not null) <> (kanji_item_id is not null)
  )
);

create unique index favorite_user_vocabulary_uniq
  on public.favorite (user_id, vocabulary_item_id) where vocabulary_item_id is not null;
create unique index favorite_user_kanji_uniq
  on public.favorite (user_id, kanji_item_id) where kanji_item_id is not null;
create index idx_favorite_user_created on public.favorite (user_id, created_at desc, id desc);
create index idx_favorite_vocabulary on public.favorite (vocabulary_item_id)
  where vocabulary_item_id is not null;
create index idx_favorite_kanji on public.favorite (kanji_item_id)
  where kanji_item_id is not null;

alter table public.favorite enable row level security;

create policy favorite_select_own on public.favorite
  for select to authenticated using (user_id = auth.uid());
create policy favorite_insert_own on public.favorite
  for insert to authenticated with check (user_id = auth.uid());
create policy favorite_update_own on public.favorite
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy favorite_delete_own on public.favorite
  for delete to authenticated using (user_id = auth.uid());

commit;
