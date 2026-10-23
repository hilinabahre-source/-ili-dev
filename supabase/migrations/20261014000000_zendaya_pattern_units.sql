-- Zendaya Spider-Man Dress made to measure, plus per-pattern units and print settings.
-- Additive: the A-line Silk Dress row keeps its behaviour (unit 'in', no print settings = the A-line defaults).

-- The unit of the SeamScape pattern's variables. Customers always see inches; ranges (min_in/max_in)
-- and proportion checks stay in inches; the value sent to SeamScape is converted from the saved cm.
alter table public.pattern_sources
  add column variable_unit text not null default 'in' check (variable_unit in ('in', 'cm'));

-- How the printed PDF describes the pieces:
-- { "title": "...", "file_slug": "...", "order": ["<piece>", ...], "pieces": { "<SeamScape piece name>": { "label", "cut", "seamAllowance",
--   "fold": "vertical" | "horizontal" | "none", "print": false } } }
-- Empty = every piece "Cut 1 on fold (outer silk)", "0.5 in seam allowance included", vertical fold.
alter table public.pattern_sources
  add column pdf jsonb not null default '{}'::jsonb check (jsonb_typeof(pdf) = 'object');

-- What unit variables_in was sent in (older rows: inches).
alter table public.pattern_downloads
  add column variables_unit text not null default 'in' check (variables_unit in ('in', 'cm'));

insert into public.pattern_sources
  (pattern_id, seamscape_pattern_id, seamscape_version, variable_unit, measurement_map, checks, pdf, notes)
values (
  'pattern-1',
  '23c633a1-c191-474e-93e0-8d2f9f520ade',
  5,
  'cm',
  '{
     "bust":  { "column": "chest_girth", "label": "Bust",  "scale": 1, "adjust_in": 0, "min_in": 30, "max_in": 44 },
     "waist": { "column": "waist_girth", "label": "Waist", "scale": 1, "adjust_in": 0, "min_in": 22, "max_in": 38 },
     "hip":   { "column": "hip_girth",   "label": "Hip",   "scale": 1, "adjust_in": 0, "min_in": 33, "max_in": 48 }
   }'::jsonb,
  -- Provisional safeguard (awaiting the patternmaker): the front panel at the bust line must not reach past the
  -- underarm point. Half-widths in the pattern: underarm = waist/4 - 0.644 in, bust line = 0.14975*bust - 0.0032 in,
  -- so underarm - bust line = 0.25*waist - 0.14975*bust - 0.640856 in (1.18 in for the 86/70/98 cm reference).
  '[{
     "id": "bust_inside_underarm",
     "label": "Bust and waist together",
     "terms": { "waist": 0.25, "bust": -0.14975 },
     "constant": -0.640856,
     "min": 0,
     "fields": ["Bust", "Waist"],
     "message": "Your bust and waist measurements don''t work together for this dress''s halter armhole. Please re-measure your bust (around the fullest part) and your waist (at the narrowest point)."
   }]'::jsonb,
  '{
     "title": "ILI Zendaya Spider-Man Dress",
     "file_slug": "zendaya-spider-man-dress",
     "pieces": {
       "Front_bodice": { "label": "Front bodice", "cut": "Cut 1 on fold", "seamAllowance": "1 cm seam allowance included (1.2 cm at the hem)", "fold": "vertical" },
       "Back_bodice":  { "label": "Back bodice",  "cut": "Cut 1 on fold", "seamAllowance": "1 cm seam allowance included (1.2 cm at the hem)", "fold": "vertical" },
       "Front_ruffle": { "label": "Ruffle", "cut": "Cut 2 on fold (one for the front, one for the back)", "seamAllowance": "1 cm seam allowance included (2 cm at the short end)", "fold": "horizontal" },
       "Back_ruffle":  { "print": false }
     }
   }'::jsonb,
  'SeamScape v5: front + back bodice, two full ruffles on the fold (~7.3x gather), no facings. Variables in cm. '
  || 'Formulas: half-width = (measurement - 2)/4 - shaping; bust widens the front panels. Ranges tested 2026-10-14.'
);
