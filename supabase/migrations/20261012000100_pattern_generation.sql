-- Personalised pattern generation: SeamScape links and download history.
-- Additive only: the existing measurements and user_patterns tables are not changed.

-- ---------------------------------------------------------------------------
-- Which SeamScape pattern each ILI pattern uses, and how saved measurements map onto
-- its variables. Read only by the generate-pattern Edge Function (service role).
--
-- measurement_map: { "<SeamScape variable>": { "column": "<measurements column>",
--                                              "scale": 1, "adjust_in": 0 }, ... }
-- The value sent to SeamScape, in inches, is  (column value in cm / 2.54) * scale + adjust_in.
-- ---------------------------------------------------------------------------
create table public.pattern_sources (
  pattern_id           text primary key,          -- same id as the site's PATTERNS and user_patterns
  seamscape_pattern_id uuid not null,
  seamscape_version    integer not null check (seamscape_version > 0),
  measurement_map      jsonb not null check (jsonb_typeof(measurement_map) = 'object'),
  active               boolean not null default true,
  notes                text,
  updated_at           timestamptz not null default now()
);

alter table public.pattern_sources enable row level security;   -- no policies: server only
revoke all on public.pattern_sources from anon, authenticated;

insert into public.pattern_sources (pattern_id, seamscape_pattern_id, seamscape_version, measurement_map, notes)
values (
  'aline-silk-dress',
  'df297df0-db1d-4193-84e8-d634c373ee6b',
  1,
  '{
     "bust":           { "column": "chest_girth",    "scale": 1, "adjust_in": 0 },
     "waist":          { "column": "waist_girth",    "scale": 1, "adjust_in": 0 },
     "hip":            { "column": "hip_girth",      "scale": 1, "adjust_in": 0 },
     "shoulder_width": { "column": "shoulder_width", "scale": 1, "adjust_in": 0 }
   }'::jsonb,
  'shoulder_width: BodyDouble value used provisionally. The patternmaker''s F = (shoulder width - 0.5) / 2 is a '
  || 'straight horizontal distance; BodyDouble predicts ~0.75-1.25 in more for the reference body. '
  || 'Adjust scale/adjust_in once the measuring method is confirmed.'
);

-- ---------------------------------------------------------------------------
-- Download history: one row per generated PDF. Written only by the Edge Function.
-- ---------------------------------------------------------------------------
create table public.pattern_downloads (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  pattern_id           text not null,
  seamscape_pattern_id uuid not null,
  seamscape_version    integer not null,
  paper                text not null check (paper in ('A0', 'A4', 'Letter')),
  measurements_cm      jsonb not null,   -- the saved values that were used
  variables_in         jsonb not null,   -- what was sent to SeamScape, after mapping
  created_at           timestamptz not null default now()
);

create index pattern_downloads_user_created_idx on public.pattern_downloads (user_id, created_at desc);

alter table public.pattern_downloads enable row level security;

create policy "Users can view their own downloads"
  on public.pattern_downloads for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.pattern_downloads from anon, authenticated;
grant select on public.pattern_downloads to authenticated;
