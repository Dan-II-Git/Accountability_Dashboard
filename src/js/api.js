// ============================================================
// SC School Dashboard — API Client
// All data fetched from the Express/SQLite backend
// ============================================================

const BASE = '';  // same origin

async function get(url) {
  const res = await fetch(BASE + url);
  if (!res.ok) throw new Error(`API error ${res.status}: ${url}`);
  return res.json();
}

// Returns [{ district_name, school_count }]
export function fetchDistricts() {
  return get('/api/districts');
}

// Returns { district_name, schools: [{ school_id, school_name, school_type, grade_span, latest_rating }] }
export function fetchDistrictSchools(districtName) {
  return get(`/api/districts/${encodeURIComponent(districtName)}/schools`);
}

// Returns [{ school_id, school_name, school_type, ratings: [{ year, score }] }]
export function fetchDistrictTrend(districtName) {
  return get(`/api/districts/${encodeURIComponent(districtName)}/trend`);
}

// Returns { school_id, school_name, ..., ratings[], latest_rating }
export function fetchSchool(schoolId) {
  return get(`/api/schools/${schoolId}`);
}

// Returns achievement data shaped for charts (type: 'high' | 'middle' | 'elementary')
export function fetchAchievement(schoolId) {
  return get(`/api/schools/${schoolId}/achievement`);
}

// Returns { enrollment, raceEthnicity, gender, specialPopulations }
export function fetchDemographics(schoolId, year = 2024) {
  return get(`/api/schools/${schoolId}/demographics?year=${year}`);
}

// Returns [{ year, grad_rate_4yr, ... }]
export function fetchGradRates(schoolId) {
  return get(`/api/schools/${schoolId}/grad-rates`);
}

// Returns [{ year, pct_college, pct_career, ... }]
export function fetchCollegeCareer(schoolId) {
  return get(`/api/schools/${schoolId}/college-career`);
}

// Returns [{ year, teacher_count, avg_salary, pct_return_1yr, pct_return_3yr, ... }]
export function fetchClassroom(schoolId) {
  return get(`/api/schools/${schoolId}/classroom`);
}

// Returns [{ year, avg_salary, pct_return_1yr, pct_return_3yr, teacher_count }] aggregated across district
export function fetchDistrictClassroom(districtName) {
  return get(`/api/districts/${encodeURIComponent(districtName)}/classroom`);
}

// Returns up to 25 schools matching the query across all districts
export function fetchSchoolSearch(q) {
  return get(`/api/schools/search?q=${encodeURIComponent(q)}`);
}
