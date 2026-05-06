-- JapanApp initial schema (optimized for Supabase/PostgreSQL)
-- Run in Supabase SQL editor or via migration tool.

begin;

create extension if not exists pgcrypto;

-- ===== Enum types =====
create type public.script_type as enum ('hiragana', 'katakana');
create type public.kanji_status as enum ('unseen', 'learning', 'reviewing', 'mastered');
create type public.session_type as enum ('flashcard', 'kana', 'kanji');
create type public.ai_mode as enum ('chatbot', 'inline');
create type public.ai_role as enum ('user', 'assistant');

-- ===== Shared trigger for updated_at =====
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ===== Identity / profile =====
create table public.profile (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  locale text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profile_updated_at
before update on public.profile
for each row execute function public.set_updated_at();

-- ===== Reference content =====
create table public.vocabulary_item (
  id uuid primary key default gen_random_uuid(),
  japanese text not null,
  reading text,
  meaning text not null,
  example_sentence text,
  example_translation text,
  kanji_breakdown jsonb,
  tags text[] not null default '{}',
  jisho_url text,
  difficulty_level int,
  frequency_rank int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vocabulary_item_difficulty_chk check (difficulty_level is null or difficulty_level between 1 and 10),
  constraint vocabulary_item_frequency_rank_chk check (frequency_rank is null or frequency_rank > 0)
);

create trigger trg_vocabulary_item_updated_at
before update on public.vocabulary_item
for each row execute function public.set_updated_at();

create table public.kanji_item (
  id uuid primary key default gen_random_uuid(),
  kanji text not null unique,
  meaning text not null,
  onyomi text[] not null default '{}',
  kunyomi text[] not null default '{}',
  stroke_count int,
  radical text,
  jlpt_level int,
  frequency_rank int,
  components jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kanji_item_stroke_count_chk check (stroke_count is null or stroke_count > 0),
  constraint kanji_item_jlpt_level_chk check (jlpt_level is null or jlpt_level between 1 and 5),
  constraint kanji_item_frequency_rank_chk check (frequency_rank is null or frequency_rank > 0)
);

create trigger trg_kanji_item_updated_at
before update on public.kanji_item
for each row execute function public.set_updated_at();

create table public.kana_item (
  id uuid primary key default gen_random_uuid(),
  script_type public.script_type not null,
  character text not null,
  romaji text not null,
  group_name text,
  stroke_count int,
  order_index int not null,
  created_at timestamptz not null default now(),
  constraint kana_item_stroke_count_chk check (stroke_count is null or stroke_count > 0),
  constraint kana_item_order_chk check (order_index >= 0),
  constraint kana_item_unique_script_char unique (script_type, character)
);

create index idx_kana_item_script_order on public.kana_item (script_type, order_index);
create index idx_kanji_item_jlpt_freq on public.kanji_item (jlpt_level, frequency_rank);

create table public.kanji_vocabulary_link (
  id uuid primary key default gen_random_uuid(),
  kanji_id uuid not null references public.kanji_item(id) on delete cascade,
  vocabulary_item_id uuid not null references public.vocabulary_item(id) on delete cascade,
  is_common boolean not null default false,
  created_at timestamptz not null default now(),
  constraint kanji_vocabulary_link_uniq unique (kanji_id, vocabulary_item_id)
);

create index idx_kanji_vocabulary_link_vocab on public.kanji_vocabulary_link (vocabulary_item_id);

-- ===== Decks / flashcards =====
create table public.deck (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  source_type text,
  is_default boolean not null default false,
  is_deletable boolean not null default false,
  target_level text,
  tags text[] not null default '{}',
  visibility text,
  review_rules jsonb,
  import_format_version int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deck_owner_for_custom_chk check ((is_default and owner_id is null) or (not is_default and owner_id is not null))
);

create trigger trg_deck_updated_at
before update on public.deck
for each row execute function public.set_updated_at();

create table public.deck_item (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.deck(id) on delete restrict,
  vocabulary_item_id uuid not null references public.vocabulary_item(id) on delete cascade,
  position int,
  created_at timestamptz not null default now(),
  constraint deck_item_position_chk check (position is null or position >= 0),
  constraint deck_item_uniq unique (deck_id, vocabulary_item_id)
);

create index idx_deck_item_deck_position on public.deck_item (deck_id, position);

create table public.flashcard (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null references public.deck(id) on delete restrict,
  vocabulary_item_id uuid not null references public.vocabulary_item(id) on delete cascade,
  ease_factor double precision not null default 2.5,
  interval_days int not null default 0,
  due_date date,
  last_reviewed_at timestamptz,
  lapse_count int not null default 0,
  review_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flashcard_ease_factor_chk check (ease_factor between 1.3 and 5.0),
  constraint flashcard_interval_days_chk check (interval_days >= 0),
  constraint flashcard_lapse_count_chk check (lapse_count >= 0),
  constraint flashcard_uniq unique (user_id, deck_id, vocabulary_item_id)
);

create trigger trg_flashcard_updated_at
before update on public.flashcard
for each row execute function public.set_updated_at();

create index idx_flashcard_user_due on public.flashcard (user_id, due_date);
create index idx_flashcard_user_deck_due on public.flashcard (user_id, deck_id, due_date);
create index idx_flashcard_deck_due on public.flashcard (deck_id, due_date);

-- ===== User learning state =====
create table public.user_vocabulary_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vocabulary_item_id uuid not null references public.vocabulary_item(id) on delete cascade,
  is_known boolean not null default false,
  is_learning boolean not null default false,
  is_mastered boolean not null default false,
  last_seen_at timestamptz,
  next_review_at timestamptz,
  mastery_score double precision not null default 0,
  updated_at timestamptz not null default now(),
  constraint user_vocabulary_state_mastery_score_chk check (mastery_score between 0 and 1),
  constraint user_vocabulary_state_uniq unique (user_id, vocabulary_item_id)
);

create trigger trg_user_vocab_updated_at
before update on public.user_vocabulary_state
for each row execute function public.set_updated_at();

create index idx_user_vocabulary_state_user_next_review on public.user_vocabulary_state (user_id, next_review_at);

create table public.user_kana_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kana_item_id uuid not null references public.kana_item(id) on delete cascade,
  mastery_score double precision not null default 0,
  correct_count int not null default 0,
  wrong_count int not null default 0,
  last_seen_at timestamptz,
  next_review_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint user_kana_progress_mastery_score_chk check (mastery_score between 0 and 1),
  constraint user_kana_progress_counts_chk check (correct_count >= 0 and wrong_count >= 0),
  constraint user_kana_progress_uniq unique (user_id, kana_item_id)
);

create trigger trg_user_kana_updated_at
before update on public.user_kana_progress
for each row execute function public.set_updated_at();

create index idx_user_kana_progress_user_next_review on public.user_kana_progress (user_id, next_review_at);

create table public.user_kanji_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kanji_item_id uuid not null references public.kanji_item(id) on delete cascade,
  status public.kanji_status not null default 'unseen',
  mastery_score double precision not null default 0,
  correct_count int not null default 0,
  wrong_count int not null default 0,
  last_seen_at timestamptz,
  next_review_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint user_kanji_progress_mastery_score_chk check (mastery_score between 0 and 1),
  constraint user_kanji_progress_counts_chk check (correct_count >= 0 and wrong_count >= 0),
  constraint user_kanji_progress_uniq unique (user_id, kanji_item_id)
);

create trigger trg_user_kanji_updated_at
before update on public.user_kanji_progress
for each row execute function public.set_updated_at();

create index idx_user_kanji_progress_user_next_review on public.user_kanji_progress (user_id, next_review_at);

create table public.progress_snapshot (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null,
  cards_reviewed int not null default 0,
  correct_rate double precision,
  streak_days int not null default 0,
  review_minutes int not null default 0,
  daily_goal_completed boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint progress_snapshot_cards_reviewed_chk check (cards_reviewed >= 0),
  constraint progress_snapshot_correct_rate_chk check (correct_rate is null or (correct_rate >= 0 and correct_rate <= 1)),
  constraint progress_snapshot_streak_days_chk check (streak_days >= 0),
  constraint progress_snapshot_review_minutes_chk check (review_minutes >= 0),
  constraint progress_snapshot_uniq unique (user_id, snapshot_date)
);

create trigger trg_progress_snapshot_updated_at
before update on public.progress_snapshot
for each row execute function public.set_updated_at();

-- ===== Sessions / review events =====
create table public.study_session (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid references public.deck(id) on delete restrict,
  session_type public.session_type not null,
  source text,
  total_cards int not null default 0,
  correct_cards int not null default 0,
  skipped_cards int not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  constraint study_session_counts_chk check (total_cards >= 0 and correct_cards >= 0 and skipped_cards >= 0),
  constraint study_session_finished_after_start_chk check (finished_at is null or finished_at >= started_at)
);

create index idx_study_session_user_started_at on public.study_session (user_id, started_at desc);

create table public.review_record (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  flashcard_id uuid not null references public.flashcard(id) on delete cascade,
  session_id uuid references public.study_session(id) on delete set null,
  answer_quality int not null,
  response_time_ms int,
  was_correct boolean not null,
  reviewed_at timestamptz not null default now(),
  constraint review_record_answer_quality_chk check (answer_quality between 0 and 5),
  constraint review_record_response_time_chk check (response_time_ms is null or response_time_ms >= 0)
);

create index idx_review_record_user_reviewed_at on public.review_record (user_id, reviewed_at desc);
create index idx_review_record_session_id on public.review_record (session_id);
create index idx_review_record_flashcard_id on public.review_record (flashcard_id);

-- ===== Daily word =====
-- Optimized from the PRD: keep one row per user per date for clean history.
-- If carried over, set carried_over=true and source_daily_word_id to prior row.
create table public.daily_word (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  vocabulary_item_id uuid not null references public.vocabulary_item(id) on delete restrict,
  chosen_from text,
  carried_over boolean not null default false,
  source_daily_word_id uuid references public.daily_word(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint daily_word_uniq unique (user_id, date)
);

create index idx_daily_word_user_date_desc on public.daily_word (user_id, date desc);

-- ===== AI conversations/messages =====
create table public.ai_conversation (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode public.ai_mode not null default 'chatbot',
  title text,
  context_summary text,
  is_deleted boolean not null default false,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_ai_conversation_updated_at
before update on public.ai_conversation
for each row execute function public.set_updated_at();

create index idx_ai_conversation_user_last_msg_active
on public.ai_conversation (user_id, last_message_at desc)
where is_deleted = false;

create table public.ai_message (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversation(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.ai_role not null,
  content text not null,
  token_count int,
  created_at timestamptz not null default now(),
  constraint ai_message_token_count_chk check (token_count is null or token_count >= 0)
);

create index idx_ai_message_conversation_created_at on public.ai_message (conversation_id, created_at);
create index idx_ai_message_user on public.ai_message (user_id);

-- ===== Enable Row Level Security =====
alter table public.profile enable row level security;
alter table public.deck enable row level security;
alter table public.flashcard enable row level security;
alter table public.user_vocabulary_state enable row level security;
alter table public.user_kana_progress enable row level security;
alter table public.user_kanji_progress enable row level security;
alter table public.progress_snapshot enable row level security;
alter table public.study_session enable row level security;
alter table public.review_record enable row level security;
alter table public.daily_word enable row level security;
alter table public.ai_conversation enable row level security;
alter table public.ai_message enable row level security;
alter table public.vocabulary_item enable row level security;
alter table public.kanji_item enable row level security;
alter table public.kana_item enable row level security;
alter table public.kanji_vocabulary_link enable row level security;
alter table public.deck_item enable row level security;

-- ===== RLS policies: user-owned tables =====
create policy profile_select_own on public.profile
for select to authenticated using (id = auth.uid());
create policy profile_insert_own on public.profile
for insert to authenticated with check (id = auth.uid());
create policy profile_update_own on public.profile
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy flashcard_select_own on public.flashcard
for select to authenticated using (user_id = auth.uid());
create policy flashcard_insert_own on public.flashcard
for insert to authenticated with check (user_id = auth.uid());
create policy flashcard_update_own on public.flashcard
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy flashcard_delete_own on public.flashcard
for delete to authenticated using (user_id = auth.uid());

create policy user_vocabulary_state_select_own on public.user_vocabulary_state
for select to authenticated using (user_id = auth.uid());
create policy user_vocabulary_state_insert_own on public.user_vocabulary_state
for insert to authenticated with check (user_id = auth.uid());
create policy user_vocabulary_state_update_own on public.user_vocabulary_state
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy user_vocabulary_state_delete_own on public.user_vocabulary_state
for delete to authenticated using (user_id = auth.uid());

create policy user_kana_progress_select_own on public.user_kana_progress
for select to authenticated using (user_id = auth.uid());
create policy user_kana_progress_insert_own on public.user_kana_progress
for insert to authenticated with check (user_id = auth.uid());
create policy user_kana_progress_update_own on public.user_kana_progress
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy user_kana_progress_delete_own on public.user_kana_progress
for delete to authenticated using (user_id = auth.uid());

create policy user_kanji_progress_select_own on public.user_kanji_progress
for select to authenticated using (user_id = auth.uid());
create policy user_kanji_progress_insert_own on public.user_kanji_progress
for insert to authenticated with check (user_id = auth.uid());
create policy user_kanji_progress_update_own on public.user_kanji_progress
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy user_kanji_progress_delete_own on public.user_kanji_progress
for delete to authenticated using (user_id = auth.uid());

create policy progress_snapshot_select_own on public.progress_snapshot
for select to authenticated using (user_id = auth.uid());
create policy progress_snapshot_insert_own on public.progress_snapshot
for insert to authenticated with check (user_id = auth.uid());
create policy progress_snapshot_update_own on public.progress_snapshot
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy progress_snapshot_delete_own on public.progress_snapshot
for delete to authenticated using (user_id = auth.uid());

create policy study_session_select_own on public.study_session
for select to authenticated using (user_id = auth.uid());
create policy study_session_insert_own on public.study_session
for insert to authenticated with check (user_id = auth.uid());
create policy study_session_update_own on public.study_session
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy study_session_delete_own on public.study_session
for delete to authenticated using (user_id = auth.uid());

create policy review_record_select_own on public.review_record
for select to authenticated using (user_id = auth.uid());
create policy review_record_insert_own on public.review_record
for insert to authenticated with check (user_id = auth.uid());
create policy review_record_update_own on public.review_record
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy review_record_delete_own on public.review_record
for delete to authenticated using (user_id = auth.uid());

create policy daily_word_select_own on public.daily_word
for select to authenticated using (user_id = auth.uid());
create policy daily_word_insert_own on public.daily_word
for insert to authenticated with check (user_id = auth.uid());
create policy daily_word_update_own on public.daily_word
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy daily_word_delete_own on public.daily_word
for delete to authenticated using (user_id = auth.uid());

create policy ai_conversation_select_own on public.ai_conversation
for select to authenticated using (user_id = auth.uid());
create policy ai_conversation_insert_own on public.ai_conversation
for insert to authenticated with check (user_id = auth.uid());
create policy ai_conversation_update_own on public.ai_conversation
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ai_conversation_delete_own on public.ai_conversation
for delete to authenticated using (user_id = auth.uid());

create policy ai_message_select_own on public.ai_message
for select to authenticated using (user_id = auth.uid());
create policy ai_message_insert_own on public.ai_message
for insert to authenticated with check (user_id = auth.uid());
create policy ai_message_update_own on public.ai_message
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ai_message_delete_own on public.ai_message
for delete to authenticated using (user_id = auth.uid());

-- ===== RLS policies: reference content (read for all authenticated) =====
create policy vocabulary_item_read_all_authenticated on public.vocabulary_item
for select to authenticated using (true);

create policy kanji_item_read_all_authenticated on public.kanji_item
for select to authenticated using (true);

create policy kana_item_read_all_authenticated on public.kana_item
for select to authenticated using (true);

create policy kanji_vocabulary_link_read_all_authenticated on public.kanji_vocabulary_link
for select to authenticated using (true);

-- Deck visibility: all default decks + own decks are readable.
create policy deck_select_default_or_owned on public.deck
for select to authenticated using (is_default = true or owner_id = auth.uid());

-- Only users can create/update their own non-default decks.
create policy deck_insert_owned_non_default on public.deck
for insert to authenticated with check (owner_id = auth.uid() and is_default = false);

create policy deck_update_owned_non_default on public.deck
for update to authenticated
using (owner_id = auth.uid() and is_default = false)
with check (owner_id = auth.uid() and is_default = false);

-- No delete policy for deck by design (blocked for authenticated users).

-- Deck items are readable if deck is visible.
create policy deck_item_select_visible_deck on public.deck_item
for select to authenticated
using (
  exists (
    select 1
    from public.deck d
    where d.id = deck_item.deck_id
      and (d.is_default = true or d.owner_id = auth.uid())
  )
);

-- Insert/update/delete deck items only on owned non-default decks.
create policy deck_item_insert_owned_deck on public.deck_item
for insert to authenticated
with check (
  exists (
    select 1
    from public.deck d
    where d.id = deck_item.deck_id
      and d.owner_id = auth.uid()
      and d.is_default = false
  )
);

create policy deck_item_update_owned_deck on public.deck_item
for update to authenticated
using (
  exists (
    select 1
    from public.deck d
    where d.id = deck_item.deck_id
      and d.owner_id = auth.uid()
      and d.is_default = false
  )
)
with check (
  exists (
    select 1
    from public.deck d
    where d.id = deck_item.deck_id
      and d.owner_id = auth.uid()
      and d.is_default = false
  )
);

create policy deck_item_delete_owned_deck on public.deck_item
for delete to authenticated
using (
  exists (
    select 1
    from public.deck d
    where d.id = deck_item.deck_id
      and d.owner_id = auth.uid()
      and d.is_default = false
  )
);

commit;
