// ============================================================
// SC School Accountability Dashboard — Express API Server
// ============================================================
const express = require('express');
const path    = require('path');
const Database = require('better-sqlite3');

const app  = express();
const PORT = process.env.PORT || process.argv[2] || 5501;
const DB   = new Database(
  path.join(__dirname, 'data', 'accountability.db'),
  { readonly: true }
);

// ── Lookup tables ─────────────────────────────────────────────────────────────
// Background colors for each rating level (used for Chart.js dataset colors)
// Light/warm = strong performance; dark/cool = poor performance
const RATING_COLORS = {
  'Excellent':      '#f5cc7f',
  'Good':           '#fff5e0',
  'Average':        '#e2eaf2',
  'Below Average':  '#315e72',
  'Unsatisfactory': '#2f3d4c',
  'Not Rated':      '#575757',
  '—':              '#575757'
};

// Foreground/text colors to pair with each rating background
const RATING_TEXT_COLORS = {
  'Excellent':      '#303d4d',
  'Good':           '#303d4d',
  'Average':        '#303d4d',
  'Below Average':  '#fff',
  'Unsatisfactory': '#fff',
  'Not Rated':      '#fff',
  '—':              '#fff'
};

const SUBGROUP_LABELS = {
  ALL: 'All Students',
  AA:  'African American',
  AP:  'Asian/Pacific Islander',
  AI:  'American Indian',
  HI:  'Hispanic/Latino',
  CA:  'Caucasian',
  EL:  'English Learners',
  DI:  'Students with Disabilities',
  ND:  'Not Disabled',
  ED:  'Econ. Disadvantaged',
  NE:  'Non-Econ. Disadvantaged',
  MA:  'Male',
  FE:  'Female',
  MG:  'Migrant',
  MC:  'Military Connected',
  FO:  'Foster Care',
  HO:  'Homeless'
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function cleanStr(s) {
  return typeof s === 'string' ? s.replace(/\n/g, ' ').trim() : s;
}

// Natural sort: splits name into [text, number] segments so "District 2" < "District 10"
function naturalSort(a, b) {
  const seg = s => s.split(/(\d+)/).map((t, i) => i % 2 ? parseInt(t, 10) : t.toLowerCase());
  const [sa, sb] = [seg(a), seg(b)];
  for (let i = 0; i < Math.max(sa.length, sb.length); i++) {
    const [va, vb] = [sa[i] ?? '', sb[i] ?? ''];
    if (va < vb) return -1;
    if (va > vb) return 1;
  }
  return 0;
}

function formatRating(r) {
  const label = r || '—';
  return {
    rate:      r,
    label,
    color:     RATING_COLORS[label]      || '#575757',
    textColor: RATING_TEXT_COLORS[label] || '#fff'
  };
}

// Use pct_overall (actual 0–100 score) when available; fall back to idx*20 for 2022
function toScore(pct, idx) {
  if (pct != null) return Math.round(pct);
  if (!idx || idx === 9) return null;
  return Math.round(idx * 20);
}

function shapeRating(row) {
  if (!row) return null;
  return {
    year:              row.year,
    enrollment:        row.enrollment,
    poverty_index:     row.poverty_index,
    score:             toScore(row.pct_overall, row.indx_overall),
    indx_overall:      row.indx_overall,
    overall:           formatRating(row.rate_overall),
    achieve:           formatRating(row.rate_achieve),
    prep_success:      formatRating(row.rate_prepsuccess),
    progress:          formatRating(row.rate_progress),
    grad_rate:         formatRating(row.rate_gradrate),
    ccr:               formatRating(row.rate_ccr),
    climate:           formatRating(row.rate_climate),
    el:                formatRating(row.rate_el)
  };
}

function shapeSchool(s) {
  return {
    school_id:    s.school_id,
    school_name:  cleanStr(s.school_name),
    district_name: cleanStr(s.district_name),
    school_type:  s.school_type,
    grade_span:   s.grade_span,
    city:         s.city,
    state:        s.state,
    zip:          s.zip,
    street:       s.street,
    url:          s.url,
    phone:        s.phone
  };
}

// ── Prepared statements ───────────────────────────────────────────────────────
const stmts = {
  districts: DB.prepare(`
    SELECT REPLACE(district_name, CHAR(10), ' ') AS district_name,
           COUNT(*) AS school_count
    FROM schools WHERE school_type != 'D' AND is_active = 1
    GROUP BY district_name
  `),

  districtSchools: DB.prepare(`
    SELECT s.school_id, s.school_name, s.school_type, s.grade_span,
           r.year AS rating_year, r.rate_overall, r.indx_overall, r.pct_overall, r.enrollment
    FROM schools s
    LEFT JOIN ratings r ON s.school_id = r.school_id
      AND r.year = (SELECT MAX(year) FROM ratings WHERE school_id = s.school_id)
    WHERE REPLACE(s.district_name, CHAR(10), ' ') = ? AND s.school_type != 'D' AND s.is_active = 1
    ORDER BY s.school_name
  `),

  school: DB.prepare(`SELECT * FROM schools WHERE school_id = ?`),

  ratings: DB.prepare(`SELECT * FROM ratings WHERE school_id = ? ORDER BY year`),

  latestRating: DB.prepare(`
    SELECT * FROM ratings WHERE school_id = ?
    ORDER BY year DESC LIMIT 1
  `),

  achieveHigh: DB.prepare(`
    SELECT * FROM achievement_high WHERE school_id = ? ORDER BY year, subject
  `),

  achieveElem: DB.prepare(`
    SELECT * FROM achievement_elem_mid WHERE school_id = ? ORDER BY year, subject, grade
  `),

  participation: DB.prepare(`
    SELECT subgroup, pct_tested, n_tested, n_total
    FROM participation WHERE school_id = ? AND year = ?
  `),

  climate: DB.prepare(`
    SELECT * FROM school_climate WHERE school_id = ? AND year = ?
  `),

  gradRates: DB.prepare(`
    SELECT * FROM grad_rates WHERE school_id = ? ORDER BY year
  `),

  collegeCareer: DB.prepare(`
    SELECT * FROM college_career WHERE school_id = ? ORDER BY year
  `),

  classroom: DB.prepare(`
    SELECT year, teacher_count, avg_salary, pct_return_1yr, pct_return_3yr,
           pct_adv_degree, pct_inexperienced, pct_out_of_field, student_teacher_ratio
    FROM classroom_environment WHERE school_id = ? ORDER BY year
  `),

  districtTrend: DB.prepare(`
    SELECT school_id, year, rate_overall, indx_overall, pct_overall
    FROM ratings WHERE school_id IN (SELECT school_id FROM schools WHERE REPLACE(district_name, CHAR(10), ' ') = ? AND school_type != 'D' AND is_active = 1)
    ORDER BY year
  `),

  districtClassroom: DB.prepare(`
    SELECT ce.year,
           ROUND(AVG(ce.avg_salary), 0) AS avg_salary,
           ROUND(AVG(ce.pct_return_1yr), 1) AS pct_return_1yr,
           ROUND(AVG(ce.pct_return_3yr), 1) AS pct_return_3yr,
           SUM(ce.teacher_count) AS teacher_count
    FROM classroom_environment ce
    JOIN schools s ON ce.school_id = s.school_id
    WHERE REPLACE(s.district_name, CHAR(10), ' ') = ?
      AND s.is_active = 1 AND s.school_type != 'D'
    GROUP BY ce.year ORDER BY ce.year
  `),

  // Cross-district school name search (max 25 results)
  schoolSearch: DB.prepare(`
    SELECT s.school_id, s.school_name, s.school_type, s.grade_span,
           REPLACE(s.district_name, CHAR(10), ' ') AS district_name,
           r.rate_overall, r.indx_overall
    FROM schools s
    LEFT JOIN ratings r ON r.school_id = s.school_id
      AND r.year = (SELECT MAX(year) FROM ratings WHERE school_id = s.school_id)
    WHERE s.is_active = 1 AND s.school_type != 'D'
      AND s.school_name LIKE ? ESCAPE '\\'
    ORDER BY s.school_name
    LIMIT 25
  `)
};

// ── API Routes ────────────────────────────────────────────────────────────────

// GET /api/districts
app.get('/api/districts', (_req, res) => {
  const rows = stmts.districts.all()
    .map(r => ({ district_name: cleanStr(r.district_name), school_count: r.school_count }))
    .sort((a, b) => naturalSort(a.district_name, b.district_name));
  res.json(rows);
});

// GET /api/districts/:name/schools
app.get('/api/districts/:name/schools', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const rows = stmts.districtSchools.all(name);
  const schools = rows.map(s => ({
    school_id:    s.school_id,
    school_name:  cleanStr(s.school_name),
    school_type:  s.school_type,
    grade_span:   s.grade_span,
    latest_rating: s.rating_year ? shapeRating({
      year: s.rating_year, enrollment: s.enrollment,
      rate_overall: s.rate_overall, indx_overall: s.indx_overall, pct_overall: s.pct_overall,
      rate_achieve: null, rate_prepsuccess: null, rate_progress: null,
      rate_gradrate: null, rate_ccr: null, rate_climate: null, rate_el: null
    }) : null
  }));
  res.json({ district_name: name, schools });
});

// GET /api/districts/:name/trend
app.get('/api/districts/:name/trend', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const rows = stmts.districtTrend.all(name);

  // Group by school_id
  const bySchool = {};
  rows.forEach(r => {
    if (!bySchool[r.school_id]) bySchool[r.school_id] = [];
    bySchool[r.school_id].push({ year: r.year, score: toScore(r.pct_overall, r.indx_overall) });
  });

  // Get school names
  const schoolRows = stmts.districtSchools.all(name);
  const result = schoolRows.map(s => ({
    school_id:   s.school_id,
    school_name: cleanStr(s.school_name),
    school_type: s.school_type,
    ratings:     bySchool[s.school_id] || []
  }));
  res.json(result);
});

// GET /api/schools/search?q=... — cross-district school name search
app.get('/api/schools/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json([]);
  const rows = stmts.schoolSearch.all(`%${q}%`);
  res.json(rows.map(r => ({
    school_id:     r.school_id,
    school_name:   r.school_name,
    school_type:   r.school_type,
    grade_span:    r.grade_span,
    district_name: r.district_name,
    rating:        formatRating(r.rate_overall),
    indx_overall:  r.indx_overall
  })));
});

// GET /api/schools/:id
app.get('/api/schools/:id', (req, res) => {
  const school = stmts.school.get(req.params.id);
  if (!school) return res.status(404).json({ error: 'School not found' });

  const ratings = stmts.ratings.all(req.params.id);
  const shaped  = ratings.map(shapeRating);

  res.json({
    ...shapeSchool(school),
    ratings:       shaped,
    latest_rating: shaped.length ? shaped[shaped.length - 1] : null
  });
});

// GET /api/schools/:id/achievement
app.get('/api/schools/:id/achievement', (req, res) => {
  const school = stmts.school.get(req.params.id);
  if (!school) return res.status(404).json({ error: 'School not found' });

  if (school.school_type === 'H') {
    const rows    = stmts.achieveHigh.all(req.params.id);
    const courses = [...new Set(rows.map(r => r.subject))];
    const byCourse = {};
    courses.forEach(course => {
      byCourse[course] = rows
        .filter(r => r.subject === course)
        .map(r => ({
          year:       r.year,
          exceeds:    r.pct_a,
          meets:      ((r.pct_b ?? 0) + (r.pct_c ?? 0)) || null,
          basic:      r.pct_d,
          belowBasic: r.pct_f,
          pct_abc:    r.pct_abc,
          n_total:    r.n_total
        }));
    });
    res.json({ type: 'high', EOCEP: { courses, byCourse } });

  } else {
    const rows     = stmts.achieveElem.all(req.params.id);
    const subjects = [...new Set(rows.map(r => r.subject))];
    const data     = {};
    subjects.forEach(subj => {
      const subjRows = rows.filter(r => r.subject === subj);
      const grades   = [...new Set(subjRows.map(r => r.grade))];
      const byGrade  = {};
      grades.forEach(grade => {
        byGrade[grade] = subjRows
          .filter(r => r.grade === grade)
          .map(r => ({
            year:       r.year,
            exceeds:    r.pct_exceeding,
            meets:      r.pct_ready,
            basic:      r.pct_close,
            belowBasic: r.pct_in_need,
            pct_me:     r.pct_meets,
            n_total:    r.n_total
          }));
      });
      data[subj] = { byGrade };
    });
    res.json({
      type: school.school_type === 'M' ? 'middle' : 'elementary',
      ...data
    });
  }
});

// GET /api/schools/:id/demographics?year=2024
app.get('/api/schools/:id/demographics', (req, res) => {
  const year = parseInt(req.query.year) || 2024;
  const rows = stmts.participation.all(req.params.id, year);

  if (!rows.length) return res.json(null);

  const sg = {};
  rows.forEach(r => { sg[r.subgroup] = r; });

  const totalN = sg['ALL']?.n_total || 0;

  const pct = (n) => (totalN && n) ? Math.round((n / totalN) * 1000) / 10 : null;

  const raceEthnicity = {};
  ['AA','AP','AI','HI','CA'].forEach(code => {
    if (sg[code]?.n_total) {
      raceEthnicity[code] = {
        label: SUBGROUP_LABELS[code],
        pct:   pct(sg[code].n_total),
        count: sg[code].n_total
      };
    }
  });

  const gender = {
    male:   { pct: pct(sg['MA']?.n_total), count: sg['MA']?.n_total || null },
    female: { pct: pct(sg['FE']?.n_total), count: sg['FE']?.n_total || null }
  };

  const specialPopulations = {};
  ['ED','DI','EL','MG','MC','FO','HO'].forEach(code => {
    if (sg[code]?.n_total) {
      specialPopulations[code] = {
        label: SUBGROUP_LABELS[code],
        pct:   pct(sg[code].n_total),
        count: sg[code].n_total
      };
    }
  });

  res.json({ enrollment: totalN, raceEthnicity, gender, specialPopulations });
});

// GET /api/schools/:id/grad-rates
app.get('/api/schools/:id/grad-rates', (req, res) => {
  res.json(stmts.gradRates.all(req.params.id));
});

// GET /api/schools/:id/college-career
app.get('/api/schools/:id/college-career', (req, res) => {
  res.json(stmts.collegeCareer.all(req.params.id));
});

// GET /api/schools/:id/classroom
app.get('/api/schools/:id/classroom', (req, res) => {
  res.json(stmts.classroom.all(req.params.id));
});

// GET /api/districts/:name/classroom
app.get('/api/districts/:name/classroom', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  res.json(stmts.districtClassroom.all(name));
});

// ── Static files (serve frontend) ─────────────────────────────────────────────
app.use(express.static(__dirname));

app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`SC Dashboard API + static server → http://localhost:${PORT}`);
});
