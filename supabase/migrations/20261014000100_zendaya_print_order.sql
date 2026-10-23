-- jsonb does not keep object key order, so the print order of the pieces is an explicit array.
update public.pattern_sources
set pdf = pdf || '{"order": ["Front_bodice", "Back_bodice", "Front_ruffle"]}'::jsonb,
    updated_at = now()
where pattern_id = 'pattern-1';
