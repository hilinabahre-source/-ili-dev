-- Supported measurement ranges and proportion checks for made-to-measure patterns.
-- Both are data, read by the generate-pattern Edge Function; change them with SQL, no redeploy.
--
-- measurement_map entries may carry: "label", "min_in", "max_in" (inches, after mapping).
-- checks: [{ "id", "label", "terms": { "<variable>": coefficient, ... }, "constant",
--            "min", "max", "message" }]
--   value = constant + sum(coefficient * variable in inches); must lie within [min, max].

alter table public.pattern_sources
  add column checks jsonb not null default '[]'::jsonb check (jsonb_typeof(checks) = 'array');

-- A-line Silk Dress: initial supported ranges (2026-10-12), tested with SeamScape over this whole range.
update public.pattern_sources
set measurement_map = jsonb_build_object(
      'bust',           (measurement_map -> 'bust')           || '{"label": "Bust",           "min_in": 28, "max_in": 52}',
      'waist',          (measurement_map -> 'waist')          || '{"label": "Waist",          "min_in": 20, "max_in": 52}',
      'hip',            (measurement_map -> 'hip')            || '{"label": "Hip",            "min_in": 30, "max_in": 60}',
      'shoulder_width', (measurement_map -> 'shoulder_width') || '{"label": "Shoulder width", "min_in": 12, "max_in": 18}'
    ),
    -- Provisional safeguard: horizontal distance from the shoulder point to the underarm,
    -- A - F = (bust + 0.5)/4 - (shoulder_width - 0.5)/2 = 0.25*bust - 0.5*shoulder_width + 0.375.
    -- Reference dress: 1.6 in. Outside 0.4-3.5 in the armhole shape distorts.
    checks = '[{
      "id": "underarm_to_shoulder",
      "label": "Bust and shoulder width together",
      "terms": { "bust": 0.25, "shoulder_width": -0.5 },
      "constant": 0.375,
      "min": 0.4,
      "max": 3.5,
      "fields": ["Bust", "Shoulder width"],
      "message": "Your bust and shoulder width measurements don''t work together for this pattern''s armhole. Please re-measure your bust (around the fullest part) and your shoulder width (shoulder point to shoulder point)."
    }]'::jsonb,
    updated_at = now()
where pattern_id = 'aline-silk-dress';
