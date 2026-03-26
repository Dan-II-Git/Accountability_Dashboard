# CLAUDE.md — SC School Accountability Dashboard

Instructions and architectural decisions for Claude Code working in this repository.

---

## Project Overview

A public-facing web dashboard for South Carolina school accountability data, built for the SC Department of Education. It exposes ratings, academic achievement, demographics, and teacher workforce data for every public school and district in the state.

**Stack:** Node.js + Express 5 (API server) · better-sqlite3 (read-only SQLite) · Chart.js (frontend charts) · vanilla JS ES modules (no bundler)

**Entry points:**
- `server.js` — Express API + static file server
- `src/js/app.js` — main app logic (ES module, loaded via `<script type="module">`)
- `src/js/api.js` — all fetch calls to the backend
- `src/js/charts.js` — all Chart.js rendering functions
- `index.html` — single-page HTML shell

---

## Workflow Instructions

**After editing any source file while the preview server is running, always verify changes:**
1. Restart the server (`preview_stop` → `preview_start`) — changes to `server.js` require a full restart; the preview tool does not hot-reload Node.
2. Check `preview_console_logs` for errors.
3. Take a `preview_screenshot` or `preview_snapshot` to confirm the change is visible.
4. Never ask the user to manually verify — confirm and share proof directly.

**Server management:** The server ID changes each session. Always call `preview_list` first to find the active server ID before calling `preview_stop`.

---

## Database

**File:** `data/accountability.db` (SQLite, checked into the repo for deployment)

**Key tables:**

| Table | Description |
|---|---|
| `schools` | One row per school. `is_active` flag soft-deletes schools from the UI. |
| `ratings` | Annual accountability ratings per school. |
| `achievement_high` | EOCEP (End-of-Course) data for high schools. |
| `achievement_elem_mid` | SC READY data for elementary/middle schools. |
| `participation` | Subgroup enrollment and testing participation. |
| `school_climate` | Climate survey results. |
| `grad_rates` | 4-year and 5-year graduation rates. |
| `college_career` | College/career readiness indicators. |
| `classroom_environment` | Teacher salary, retention, and qualifications. |

### `is_active` flag
Schools with `is_active = 0` are excluded from all district lists and trend charts via `AND is_active = 1` in every query. Their historical data remains intact and is still queryable by `school_id` directly (e.g., the `/api/schools/:id` endpoint does not filter by `is_active`).

Reasons a school may be deactivated: closed, merged, renamed (new record created), or it appears in source data but has no ratings and is not a real operational school.

### `pct_overall` column
The `ratings` table has both `indx_overall` (1–5 integer category) and `pct_overall` (0–100 actual composite score). **Always use `pct_overall` when available.** It is populated for 2023–2025 from the SCDE `forResearchers` Excel files. For 2022, `pct_overall` is NULL and the server falls back to `idx * 20` (five discrete values). Do not remove this fallback.

### District name normalization
District names in the DB were normalized so that all spelled-out numbers are replaced with digits (e.g., "District One" → "District 1"). This was done directly in the DB via SQL `UPDATE`. The `naturalSort` helper in `server.js` ensures numeric ordering (District 2 before District 10) when serving the district list.

---

## API Design Decisions

### No authentication
The API is fully public read-only. The DB is opened with `{ readonly: true }`. No write endpoints exist.

### Parameterized queries only
All DB queries use prepared statements (`DB.prepare`). Never interpolate user input into SQL strings.

### District name as URL param
Districts are identified by name (URL-encoded), not by an ID. This matches how the source data is structured. Use `decodeURIComponent(req.params.name)` on every district route.

### `is_active` filtering
All district-scoped queries must include `AND s.is_active = 1 AND s.school_type != 'D'`. The `school_type != 'D'` filter excludes district-level administrative records from school lists.

---

## Rating System Rules

SC DOE uses five rating levels. **Always use full names — never abbreviations.**

| Full Name | Color |
|---|---|
| Excellent | `#1a7a4a` |
| Good | `#0d6e8a` |
| Average | `#b07800` |
| Below Average | `#b05010` |
| Unsatisfactory | `#9b1c1c` |
| Not Rated / — | `#9ca3af` |

The `formatRating` function in `server.js` returns `{ rate, label, color }`. The `label` field is the full name. On the frontend, always reference `rating.overall.label` — never `.short` (that field was removed).

**Rating years:** 2022, 2023, 2024, 2025. Four years total. There is no 2021 rating (data exists for classroom/environment going back to 2021, but accountability ratings start at 2022).

---

## Achievement Data Rules

### High Schools — EOCEP (End-of-Course Exam Program)
Performance bands map from letter grades. **B and C are always combined into a single "Meets Expectations" band.**

| DB Column | Band Label |
|---|---|
| `pct_a` | A — Exceeds Expectations |
| `pct_b + pct_c` | B & C — Meets Expectations (combined) |
| `pct_d` | D — Minimally Meets Expectations |
| `pct_f` | F — Does Not Meet Expectations |

Never split B and C into separate bands. Never combine D and F.

### Elementary/Middle — SC READY
Four bands: Exceeding / Meets / Approaching / In Need of Support (mapped to `pct_exceeding`, `pct_ready`, `pct_close`, `pct_in_need`).

---

## Chart Conventions (`charts.js`)

- All chart instances are stored in `chartInstances[id]` and destroyed via `destroyChart(id)` before re-rendering. Always use the canvas element's `id` as the key.
- `renderClassroomChart(data, canvasId)` accepts an optional second argument for the canvas ID, defaulting to `'chart-classroom'`. This allows it to be reused for both the school view (`chart-classroom`) and district view (`chart-dist-classroom`).
- Use `spanGaps: true` on salary lines — some years have NULL salary data.
- The dual-axis layout: salary on left Y axis (`ySalary`), retention percentages on right Y axis (`yPct`).

---

## Frontend Conventions

- No build step, no bundler. All JS is served as native ES modules.
- The app is a single-page app managed by `show*View()` functions in `app.js` that toggle `display` on `<section>` elements.
- The `window.app` object exposes public methods called from inline HTML `onclick` handlers.
- Fetch calls should be parallelized with `Promise.all` where the results are independent.
- Chart renders are wrapped in `setTimeout(..., 50–100)` to allow the DOM to paint before Chart.js measures canvas dimensions.

---

## Deployment

The app is self-contained and ready for one-click deployment on Railway or Render.

- `PORT` is read from `process.env.PORT` (set by the host) or falls back to `5501`.
- The SQLite DB is at `data/accountability.db` relative to `server.js` — no external DB needed.
- `node_modules/` is excluded from git via `.gitignore`. The host runs `npm install` from `package.json`.
- Static files are served from the project root via `express.static(__dirname)`.

---

## Brand Guidelines

This dashboard follows the SCDE brand. See `SCDE_Style_Guide.md` for full details.

Key rules:
- Primary font: **Poppins**
- Tagline (verbatim): **Serve Students. Support Teachers. Empower Parents.**
- Primary dark color: `#2F3D4C`
- Accent/gold: `#F1BA55`
- Do not paraphrase the tagline or reorder its clauses.
- Data source attribution must appear on every view: "SC Department of Education Report Card data (2021–2025)" with a link to screportcards.com.
