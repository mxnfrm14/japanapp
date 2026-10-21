begin;

-- ===== Diary =====
-- One entry per user per LOCAL calendar day, upserted from the client.
-- `entry_date` is supplied by the client, never derived from now() server-side.
create table public.diary_entry (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  entry_date  date not null,
  text        text not null default '',
  correction  jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint diary_entry_uniq unique (user_id, entry_date)
);

create trigger trg_diary_entry_updated_at
before update on public.diary_entry
for each row execute function public.set_updated_at();

create index idx_diary_entry_user_date_desc on public.diary_entry (user_id, entry_date desc);

alter table public.diary_entry enable row level security;

create policy diary_entry_select_own on public.diary_entry
for select to authenticated using (user_id = auth.uid());
create policy diary_entry_insert_own on public.diary_entry
for insert to authenticated with check (user_id = auth.uid());
create policy diary_entry_update_own on public.diary_entry
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy diary_entry_delete_own on public.diary_entry
for delete to authenticated using (user_id = auth.uid());

commit;
