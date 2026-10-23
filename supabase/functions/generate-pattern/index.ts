// generate-pattern: builds a personalised, true-scale pattern PDF for the signed-in customer.
//
// Request:  POST { "pattern": "aline-silk-dress", "paper": "A0" | "A4" | "Letter" }
//           or    { "pattern": "aline-silk-dress", "check": true }  -> validate only, returns JSON
//           Authorization: Bearer <customer's Supabase access token>
// Response: the PDF file (application/pdf), or JSON { error, message, ... } with a 4xx/5xx status.
//
// Measurements never come from the browser: they are read from the customer's own row in
// `measurements` (stored in cm) with the customer's permissions, mapped through
// `pattern_sources.measurement_map`, converted to inches, checked against the supported ranges
// (measurement_map min_in/max_in) and proportion checks (pattern_sources.checks), then sent to SeamScape
// in the pattern's own unit (pattern_sources.variable_unit: 'in' or 'cm'). Customers always see inches.
// pattern_sources.pdf describes the printed pieces (title, labels, cutting quantities, seam allowances, folds).
//
// Secrets: SEAMSCAPE_API_KEY (set with `supabase secrets set`).
// Provided by Supabase: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
// Optional: ALLOWED_ORIGINS (comma-separated), DOWNLOADS_PER_HOUR (default 10).

import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { buildPatternPdf, type Paper, type PieceOptions, type SeamScapePiece } from './pdf.ts';

const SEAMSCAPE_URL = 'https://seamscape.com/api/v1/patterns/';
const PAPERS: Paper[] = ['A0', 'A4', 'Letter'];
const CM_PER_IN = 2.54;
const ALLOWED_ORIGINS = new Set(
  (Deno.env.get('ALLOWED_ORIGINS') ??
    'https://ilipatterns.com,https://www.ilipatterns.com,http://localhost:8000,http://127.0.0.1:8000')
    .split(',').map(s => s.trim()).filter(Boolean),
);
const DOWNLOADS_PER_HOUR = Number(Deno.env.get('DOWNLOADS_PER_HOUR') ?? '10');

// Friendly names for the measurement columns, used in "please complete your profile" messages.
const COLUMN_LABELS: Record<string, string> = {
  chest_girth: 'Bust / Chest Girth', waist_girth: 'Waist Girth', hip_girth: 'Hip Girth',
  shoulder_width: 'Shoulder Width',
};

interface MapEntry { column: string; label?: string; scale?: number; adjust_in?: number; min_in?: number; max_in?: number }
interface ProportionCheck {
  id: string; label?: string; terms: Record<string, number>; constant?: number;
  min?: number; max?: number; fields?: string[]; message?: string;
}
interface Issue { fields: string[]; message: string }
interface PdfConfig { title?: string; file_slug?: string; pieces?: Record<string, PieceOptions>; order?: string[] }

const ABSOLUTE_MIN_IN = 8, ABSOLUTE_MAX_IN = 80;   // sanity limits for any body, any pattern
const EPS = 1e-6;                                  // boundary values themselves are allowed
const both = (inches: number) => `${fmt(inches)} in`;   // ILI shows measurements in inches

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Expose-Headers': 'content-disposition',
    'Vary': 'Origin',
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function json(status: number, body: Record<string, unknown>, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

const fmt = (n: number) => Number(n.toFixed(2)).toString();

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' }, origin);
  // Browsers always send Origin on cross-site POSTs; reject pages we don't serve.
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(403, { error: 'origin_not_allowed' }, origin);

  // 1. Who is asking? Validate the customer's token with Supabase Auth.
  const authHeader = req.headers.get('authorization') ?? '';
  if (!/^Bearer\s+\S+/.test(authHeader)) {
    return json(401, { error: 'sign_in_required', message: 'Please sign in to download your pattern.' }, origin);
  }
  const url = Deno.env.get('SUPABASE_URL')!;
  const asCustomer = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await asCustomer.auth.getUser();
  const user = userData?.user;
  if (userError || !user) {
    return json(401, { error: 'sign_in_required', message: 'Your session has expired. Please sign in again.' }, origin);
  }
  const asServer = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 2. What do they want?
  let body: { pattern?: unknown; paper?: unknown; check?: unknown };
  try { body = await req.json(); } catch { return json(400, { error: 'invalid_request' }, origin); }
  const patternId = typeof body.pattern === 'string' && /^[a-z0-9-]{1,60}$/.test(body.pattern) ? body.pattern : null;
  const checkOnly = body.check === true;
  const paper = PAPERS.find(p => p === body.paper);
  if (!patternId || (!paper && !checkOnly)) {
    return json(400, { error: 'invalid_request', message: 'Choose a pattern and a paper size (A0, A4 or Letter).' }, origin);
  }

  const { data: source, error: sourceError } = await asServer.from('pattern_sources')
    .select('seamscape_pattern_id, seamscape_version, measurement_map, checks, variable_unit, pdf')
    .eq('pattern_id', patternId).eq('active', true).maybeSingle();
  if (sourceError) return json(500, { error: 'server_error' }, origin);
  if (!source) return json(404, { error: 'pattern_not_available', message: 'This pattern is not available for download.' }, origin);

  // 3. Their saved measurements (read with the customer's own permissions).
  const { data: saved, error: measurementError } = await asCustomer.from('measurements')
    .select('*').eq('user_id', user.id).maybeSingle();
  if (measurementError) return json(500, { error: 'server_error' }, origin);

  const map = source.measurement_map as Record<string, MapEntry>;
  const unit: 'in' | 'cm' = source.variable_unit === 'cm' ? 'cm' : 'in';
  const pdfConfig = (source.pdf ?? {}) as PdfConfig;
  const labelOf = (entry: MapEntry) => entry.label ?? COLUMN_LABELS[entry.column] ?? entry.column;
  // inches: the customer's measurement as ILI shows it (ranges, checks and messages use these);
  // variables: the same measurement in the SeamScape pattern's unit, converted straight from the saved cm.
  const inches: Record<string, number> = {};
  const variables: Record<string, number> = {};
  const usedCm: Record<string, number> = {};
  const missing: string[] = [];
  const issues: Issue[] = [];
  for (const [variable, entry] of Object.entries(map)) {
    const cm = Number(saved?.[entry.column]);
    if (!saved || !Number.isFinite(cm) || cm <= 0) { missing.push(labelOf(entry)); continue; }
    const valueIn = Number(((cm / CM_PER_IN) * (entry.scale ?? 1) + (entry.adjust_in ?? 0)).toFixed(3));
    usedCm[entry.column] = cm;
    inches[variable] = valueIn;
    variables[variable] = unit === 'in' ? valueIn
      : Number((cm * (entry.scale ?? 1) + (entry.adjust_in ?? 0) * CM_PER_IN).toFixed(4));
    const label = labelOf(entry);
    const min = Math.max(entry.min_in ?? ABSOLUTE_MIN_IN, ABSOLUTE_MIN_IN);
    const max = Math.min(entry.max_in ?? ABSOLUTE_MAX_IN, ABSOLUTE_MAX_IN);
    if (valueIn < min - EPS) {
      issues.push({ fields: [label], message: `${label} is ${both(valueIn)}, below the supported minimum of ${both(min)}.` });
    } else if (valueIn > max + EPS) {
      issues.push({ fields: [label], message: `${label} is ${both(valueIn)}, above the supported maximum of ${both(max)}.` });
    }
  }
  if (missing.length) {
    return json(422, { error: 'measurements_missing', fields: missing,
      message: `Please add these measurements to your profile first: ${missing.join(', ')}.` }, origin);
  }

  // Proportion checks (configured in pattern_sources.checks, terms in inches), e.g. underarm vs shoulder point.
  for (const check of (source.checks ?? []) as ProportionCheck[]) {
    const names = Object.keys(check.terms ?? {});
    if (!names.length || names.some(n => inches[n] == null)) continue;
    const value = names.reduce((sum, n) => sum + check.terms[n] * inches[n], check.constant ?? 0);
    if ((check.min != null && value < check.min - EPS) || (check.max != null && value > check.max + EPS)) {
      const fields = check.fields ?? names.map(n => labelOf(map[n]));
      issues.push({ fields, message: check.message ?? `${check.label ?? check.id} is outside what this pattern supports.` });
    }
  }

  if (issues.length) {
    const fields = [...new Set(issues.flatMap(i => i.fields))];
    return json(422, { error: 'measurements_out_of_range', fields, issues,
      message: `Please review these measurements in your profile: ${fields.join(', ')}.` }, origin);
  }
  if (checkOnly) {
    return json(200, { ok: true, variables: inches }, origin);
  }
  if (!paper) return json(400, { error: 'invalid_request', message: 'Choose a paper size (A0, A4 or Letter).' }, origin);

  // 4. Fair-use limit, counted from the download history.
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count, error: countError } = await asServer.from('pattern_downloads')
    .select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', since);
  if (countError) return json(500, { error: 'server_error' }, origin);
  if ((count ?? 0) >= DOWNLOADS_PER_HOUR) {
    return json(429, { error: 'too_many_downloads', message: 'You have reached the download limit for this hour. Please try again later.' }, origin);
  }

  // 5. Ask SeamScape to regenerate the pattern for these measurements.
  let pattern: { errors?: unknown[]; variables?: Record<string, number>; data?: { pieces?: SeamScapePiece[] } };
  try {
    const res = await fetch(SEAMSCAPE_URL + source.seamscape_pattern_id, {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('SEAMSCAPE_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ versionNumber: source.seamscape_version, format: 'json', variables }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      console.error('SeamScape responded', res.status, (await res.text()).slice(0, 300));
      return json(502, { error: 'pattern_service_unavailable', message: 'The pattern service is unavailable. Please try again shortly.' }, origin);
    }
    pattern = await res.json();
  } catch (e) {
    console.error('SeamScape request failed', String(e));
    return json(502, { error: 'pattern_service_unavailable', message: 'The pattern service is unavailable. Please try again shortly.' }, origin);
  }
  const pieces = pattern.data?.pieces ?? [];
  const applied = pattern.variables ?? {};
  const mismatch = Object.keys(variables).some(k => Math.abs(Number(applied[k]) - variables[k]) > 1e-6);
  if ((pattern.errors?.length ?? 0) > 0 || mismatch || pieces.length === 0) {
    console.error('SeamScape could not generate', JSON.stringify(pattern.errors ?? []).slice(0, 300), mismatch);
    return json(422, { error: 'pattern_generation_failed',
      message: 'We could not generate this pattern for your measurements. Please check your profile or contact us.' }, origin);
  }

  // 6. Build the PDF.
  const inchesLine = Object.entries(inches).map(([k, v]) => `${k.replace('_', ' ')} ${fmt(v)} in`).join(', ');
  const today = new Date().toISOString().slice(0, 10);
  let pdf: { bytes: Uint8Array; pageCount: number };
  try {
    pdf = buildPatternPdf(pieces, paper, {
      patternTitle: pdfConfig.title ?? 'ILI A-line Silk Dress',
      infoLine: `Made for: ${inchesLine}`,
      footer: `Generated ${today} - ilipatterns.com - pattern v${source.seamscape_version}`,
      pieces: pdfConfig.pieces,
      order: pdfConfig.order,
    });
  } catch (e) {
    console.error('PDF build failed', String(e));
    return json(500, { error: 'pdf_failed', message: 'Something went wrong while preparing your PDF. Please try again.' }, origin);
  }

  // 7. Record the download, then send the file.
  const { error: logError } = await asServer.from('pattern_downloads').insert({
    user_id: user.id, pattern_id: patternId,
    seamscape_pattern_id: source.seamscape_pattern_id, seamscape_version: source.seamscape_version,
    paper, measurements_cm: usedCm, variables_in: variables, variables_unit: unit,
  });
  if (logError) {
    console.error('Download history insert failed', logError.message);
    return json(500, { error: 'server_error' }, origin);
  }

  return new Response(pdf.bytes, {
    status: 200,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ILI-${pdfConfig.file_slug ?? patternId}-${paper}.pdf"`,
      'Cache-Control': 'no-store',
      'X-Page-Count': String(pdf.pageCount),
    },
  });
});
