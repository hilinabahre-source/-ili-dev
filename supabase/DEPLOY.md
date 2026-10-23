# Launching made-to-measure downloads

Development happens on the `ili-dev` Supabase project (`mxdwppfhitjdrylvipkc`), which the site uses
automatically on `localhost`. The live site uses the live project (`htkqrsqjikhyoztrviqw`).
Every step below changes the **live** project or site, so do them in order and only when approved.

## 1. Database (live project)

The live project already has `measurements` and `user_patterns`, so the baseline migration must be
recorded as applied **without running it**:

```
supabase link --project-ref htkqrsqjikhyoztrviqw
supabase migration repair --status applied 20261012000000
supabase db push --dry-run        # should list 20261012000100_pattern_generation.sql and 20261013000000_measurement_limits.sql
supabase db push
```

Then run the access-rule tests against `ili-dev` (never live; they create temporary users):
`supabase db query --linked -f supabase/tests/access_rules_test.sql` after linking back to ili-dev.

## 2. Edge Function (live project)

```
supabase secrets set --project-ref htkqrsqjikhyoztrviqw --env-file <private file with SEAMSCAPE_API_KEY=...>
supabase functions deploy generate-pattern --use-api --project-ref htkqrsqjikhyoztrviqw
```

Use a separate SeamScape key for production. `ALLOWED_ORIGINS` defaults to ilipatterns.com,
www.ilipatterns.com and localhost; `DOWNLOADS_PER_HOUR` defaults to 10.

## 3. Measurement mapping and size limits

`pattern_sources.measurement_map` controls which profile column feeds each dress variable, and an
optional correction (`scale`, `adjust_in`) and limits (`min_in`, `max_in`) per variable. Update it with
SQL; no code change or redeploy is needed. Shoulder width is provisional until the pattern maker
confirms how it is measured.

Initial supported ranges (A-line Silk Dress): bust 28-52, waist 20-52, hip 30-60, shoulder width
12-18 in, plus the provisional underarm-to-shoulder check 0.4-3.5 in (pattern_sources.checks). Note that
the proportion check effectively limits bust to 48.5 in at the widest supported shoulder (18 in).
Boundary tests: run against ili-dev only (they use a temporary test customer).

## 4. Website

Merge the development branch into `main` (GitHub Pages deploys `main`). The site switches to the live
Supabase project automatically on ilipatterns.com.

## 5. After launch

- Sign in on ilipatterns.com, complete the profile, download A4 / US Letter / A0, check My Patterns.
- Print A4 and US Letter at 100% and measure the 2 in and 5 cm test squares.
- Supabase dashboard: enable leaked-password protection (Authentication settings).
