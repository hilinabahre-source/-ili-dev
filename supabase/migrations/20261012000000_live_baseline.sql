-- BASELINE: an exact copy of the live ILI database structure and security rules
-- (project htkqrsqjikhyoztrviqw, inspected read-only on 2026-10-11).
--
-- These tables already exist in the live project. When this repo is first connected to
-- the live project, mark this migration as applied WITHOUT running it:
--   supabase migration repair --status applied 20261012000000
-- It is applied for real only to development projects such as ili-dev.

create table public.measurements (
  user_id             uuid not null,
  gender              text,
  height              numeric,
  weight              numeric,
  shoulder_width      numeric,
  neck_to_waist_back  numeric,
  neck_to_waist_front numeric,
  chest_girth         numeric,
  underbust_girth     numeric,
  arm_length          numeric,
  bicep_girth         numeric,
  waist_girth         numeric,
  hip_girth           numeric,
  thigh_girth         numeric,
  crotch_height       numeric,
  updated_at          timestamptz default now(),
  constraint measurements_pkey primary key (user_id),
  constraint measurements_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
);

create table public.user_patterns (
  user_id         uuid not null,
  pattern_id      text not null,
  saved           boolean default false,
  completed_steps jsonb default '[]'::jsonb,
  updated_at      timestamptz default now(),
  constraint user_patterns_pkey primary key (user_id, pattern_id),
  constraint user_patterns_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
);

alter table public.measurements  enable row level security;
alter table public.user_patterns enable row level security;

create policy "Users can view their own measurements"
  on public.measurements for select using (auth.uid() = user_id);
create policy "Users can insert their own measurements"
  on public.measurements for insert with check (auth.uid() = user_id);
create policy "Users can update their own measurements"
  on public.measurements for update using (auth.uid() = user_id);

create policy "Users can view their own pattern data"
  on public.user_patterns for select using (auth.uid() = user_id);
create policy "Users can insert their own pattern data"
  on public.user_patterns for insert with check (auth.uid() = user_id);
create policy "Users can update their own pattern data"
  on public.user_patterns for update using (auth.uid() = user_id);

-- Same table privileges as live (Supabase defaults); row-level security does the filtering.
grant all on public.measurements, public.user_patterns to anon, authenticated, service_role;
