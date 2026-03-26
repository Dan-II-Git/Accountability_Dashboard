// ============================================================
// SC School Dashboard — Main Application (API-backed)
// ============================================================

import {
  fetchDistricts,
  fetchDistrictSchools,
  fetchDistrictTrend,
  fetchDistrictClassroom,
  fetchSchool,
  fetchAchievement,
  fetchDemographics,
  fetchClassroom
} from './api.js';

import {
  renderAccountabilityChart,
  renderAchievementChart,
  renderDemographicsCharts,
  renderDistrictTrendChart,
  renderClassroomChart
} from './charts.js';

// ─── State ────────────────────────────────────────────────────────────────────
let state = {
  view:                'home',
  selectedDistrictName: null,
  selectedSchoolId:    null,
  achievementData:     null,
  achievementSubject:  null,
  achievementYear:     2025
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TYPE_LABEL = { H: 'High School', M: 'Middle School', E: 'Elementary School', P: 'Primary School' };
const TYPE_CSS   = { H: 'high',        M: 'middle',        E: 'elementary',        P: 'elementary'     };

function typeLabel(t) { return TYPE_LABEL[t] || 'School'; }
function typeCss(t)   { return TYPE_CSS[t]   || ''; }
function defaultSubject(t) { return t === 'H' ? 'EOCEP' : 'ELA'; }

function $(id) { return document.getElementById(id); }

// ─── Views ────────────────────────────────────────────────────────────────────
function showHome() {
  $('view-home').style.display     = 'flex';
  $('view-school').style.display   = 'none';
  $('view-district').style.display = 'none';
}
function showDistrictView() {
  $('view-home').style.display     = 'none';
  $('view-school').style.display   = 'none';
  $('view-district').style.display = 'block';
}
function showSchoolView() {
  $('view-home').style.display     = 'none';
  $('view-district').style.display = 'none';
  $('view-school').style.display   = 'block';
}

// ─── Home ─────────────────────────────────────────────────────────────────────
async function renderHomeSearchPanel() {
  const sel = $('district-select');
  sel.innerHTML = '<option value="">Loading…</option>';

  try {
    const districts = await fetchDistricts();

    const elD = $('stat-districts');
    if (elD) elD.textContent = districts.length;

    sel.innerHTML = '<option value="">— Select a district —</option>' +
      districts.map(d =>
        `<option value="${encodeURIComponent(d.district_name)}">${d.district_name}</option>`
      ).join('');

  } catch (e) {
    sel.innerHTML = '<option value="">Error loading districts</option>';
    console.error(e);
  }
}

async function renderSchoolList(districtName) {
  const container   = $('school-list-container');
  const searchInput = $('school-search');
  const btn         = $('view-dist-btn');

  if (!districtName) {
    searchInput.disabled = true;
    searchInput.value    = '';
    container.innerHTML  = '';
    if (btn) btn.style.display = 'none';
    return;
  }

  searchInput.disabled = false;
  container.innerHTML  = '<div class="no-schools">Loading…</div>';
  if (btn) btn.style.display = 'none';

  try {
    const { schools } = await fetchDistrictSchools(districtName);
    state.selectedDistrictName = districtName;

    if (btn) {
      btn.style.display = 'block';
    }

    function filterAndRender(query) {
      const q        = query.trim().toLowerCase();
      const filtered = q ? schools.filter(s => s.school_name.toLowerCase().includes(q)) : schools;

      if (!filtered.length) {
        container.innerHTML = '<div class="no-schools">No schools match.</div>';
        return;
      }

      container.innerHTML = `<ul class="school-list">` + filtered.map(s => `
        <li class="school-item" tabindex="0"
            data-school-id="${s.school_id}">
          <span class="type-badge ${typeCss(s.school_type)}">${typeLabel(s.school_type)}</span>
          <span class="school-name">${s.school_name}</span>
          <span class="school-grades-lbl">Grades ${s.grade_span || '—'}</span>
        </li>`).join('') + '</ul>';

      container.querySelectorAll('.school-item').forEach(item => {
        const open = () => openSchool(item.dataset.schoolId);
        item.addEventListener('click', open);
        item.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
      });
    }

    filterAndRender('');

    searchInput.removeEventListener('input', searchInput._handler);
    searchInput._handler = () => filterAndRender(searchInput.value);
    searchInput.addEventListener('input', searchInput._handler);

  } catch (e) {
    container.innerHTML = '<div class="no-schools">Error loading schools.</div>';
    console.error(e);
  }
}

// ─── District View ─────────────────────────────────────────────────────────────
async function openDistrict(districtName) {
  state.view = 'district';
  state.selectedDistrictName = districtName;
  showDistrictView();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  $('dist-breadcrumb').innerHTML = `
    <a onclick="goHome()">Home</a>
    <span class="bc-sep">›</span>
    <span class="bc-cur">${districtName}</span>
  `;
  $('dist-name').textContent = districtName;
  $('dist-meta').innerHTML   = '<span>Loading…</span>';
  $('dist-school-cards').innerHTML = '<p style="color:var(--color-text-muted);padding:16px">Loading…</p>';

  try {
    const [{ schools }, trendData, classroomData] = await Promise.all([
      fetchDistrictSchools(districtName),
      fetchDistrictTrend(districtName),
      fetchDistrictClassroom(districtName)
    ]);

    const county = districtName.replace(/School District.*/i, '').replace(/County/i, '').trim();
    $('dist-meta').innerHTML = `<span>${county} County</span><span>${schools.length} Schools</span>`;

    $('dist-school-cards').innerHTML = schools.map(school => {
      const r     = school.latest_rating;
      const color = r?.overall?.color || '#9ca3af';
      const short = r?.overall?.label || '—';
      return `
        <div class="dist-card" tabindex="0"
             onclick="openSchool('${school.school_id}')"
             onkeydown="if(event.key==='Enter')openSchool('${school.school_id}')">
          <div class="dc-hdr">
            <div class="dc-grade" style="background:${color}">${short}</div>
            <div>
              <div class="dc-name">${school.school_name}</div>
              <div class="dc-meta">
                <span class="type-badge ${typeCss(school.school_type)}">${typeLabel(school.school_type)}</span>
                <span class="dc-grades-lbl">Grades ${school.grade_span || '—'}</span>
              </div>
            </div>
          </div>
          ${r ? `<div class="dc-stats">
            <div><span class="dc-stat-val">${r.score ?? '—'}</span><span class="dc-stat-lbl">Score</span></div>
            <div><span class="dc-stat-val">${r.enrollment?.toLocaleString() || '—'}</span><span class="dc-stat-lbl">Enrolled</span></div>
            <div><span class="dc-stat-val" style="color:${color}">${r.overall?.rate || '—'}</span><span class="dc-stat-lbl">${r.year}</span></div>
          </div>` : ''}
        </div>`;
    }).join('');

    setTimeout(() => renderDistrictTrendChart(trendData), 100);
    setTimeout(() => renderClassroomChart(classroomData, 'chart-dist-classroom'), 100);

  } catch (e) {
    console.error(e);
    $('dist-school-cards').innerHTML = '<p style="color:var(--color-text-muted)">Error loading district data.</p>';
  }
}

// ─── School View ───────────────────────────────────────────────────────────────
async function openSchool(schoolId) {
  state.view            = 'school';
  state.selectedSchoolId = schoolId;
  showSchoolView();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  try {
    const school = await fetchSchool(schoolId);
    state.achievementSubject = defaultSubject(school.school_type);

    const latest = school.latest_rating;
    const color  = latest?.overall?.color || '#003366';
    const county = school.district_name.replace(/School District.*/i, '').replace(/County/i, '').trim();

    // Breadcrumb
    $('school-breadcrumb').innerHTML = `
      <a onclick="goHome()">Home</a>
      <span class="bc-sep">›</span>
      <a onclick="app.openDistrict('${encodeURIComponent(school.district_name)}')">${school.district_name}</a>
      <span class="bc-sep">›</span>
      <span class="bc-cur">${school.school_name}</span>
    `;

    // Header
    $('school-type-badge').textContent = typeLabel(school.school_type);
    $('school-name').textContent       = school.school_name;
    $('school-meta').innerHTML         =
      `<span>${school.district_name}</span><span>${county} County</span><span>Grades ${school.grade_span || '—'}</span>`;

    const circle = $('school-grade-circle');
    if (circle && latest) {
      circle.style.background = color;
      circle.textContent      = latest.overall?.label || '—';
    }
    const gradeYear = $('school-grade-year');
    if (gradeYear && latest) gradeYear.textContent = `${latest.year} Rating`;

    // ── Accountability trend ─────────────────────────────────────────────────
    setTimeout(() => renderAccountabilityChart(school.ratings), 50);

    // ── Achievement ──────────────────────────────────────────────────────────
    const achieveData = await fetchAchievement(schoolId);
    state.achievementData = achieveData;
    renderAchievementTabs(school, achieveData);

    // ── Demographics + Classroom (parallel) ──────────────────────────────────
    const [demoData, classroomData] = await Promise.all([
      fetchDemographics(schoolId, state.achievementYear),
      fetchClassroom(schoolId)
    ]);
    setTimeout(() => renderDemographicsCharts(demoData), 50);
    renderEnrollmentStats(demoData);
    setTimeout(() => renderClassroomChart(classroomData), 50);

  } catch (e) {
    console.error(e);
  }
}

// ─── Achievement Tabs ─────────────────────────────────────────────────────────
function renderAchievementTabs(school, achievementData) {
  const tabBar = $('ach-tabs');
  const yearSel = $('ach-year');
  if (!tabBar) return;

  if (!achievementData) {
    tabBar.innerHTML = '<span style="color:var(--color-text-muted);font-size:.85rem">No achievement data available.</span>';
    return;
  }

  const isHigh = school.school_type === 'H';
  const tabs = isHigh
    ? [{ id: 'EOCEP', label: 'EOCEP (End-of-Course)' }]
    : [
        { id: 'ELA',     label: 'ELA — SC READY' },
        { id: 'Math',    label: 'Math — SC READY' },
        { id: 'Science', label: 'Science — SC PASS' }
      ];

  tabBar.innerHTML = tabs.map((t, i) =>
    `<button class="tab-btn ${i === 0 ? 'active' : ''}" data-subject="${t.id}">${t.label}</button>`
  ).join('');

  tabBar.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      tabBar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.achievementSubject = btn.dataset.subject;
      renderAchievementChart(state.achievementData, state.achievementSubject, state.achievementYear);
    });
  });

  // Year selector
  const availableYears = getAvailableYears(achievementData, isHigh);
  const defaultYear    = availableYears.includes(2025) ? 2025 :
                         availableYears.includes(2024) ? 2024 :
                         availableYears[availableYears.length - 1] || 2024;
  state.achievementYear = defaultYear;

  if (yearSel) {
    yearSel.innerHTML = availableYears.map(y =>
      `<option value="${y}" ${y === defaultYear ? 'selected' : ''}>${y}</option>`
    ).join('');
    yearSel.onchange = () => {
      state.achievementYear = parseInt(yearSel.value);
      renderAchievementChart(state.achievementData, state.achievementSubject, state.achievementYear);
    };
  }

  state.achievementSubject = tabs[0].id;
  setTimeout(() => renderAchievementChart(state.achievementData, state.achievementSubject, state.achievementYear), 50);
}

function getAvailableYears(data, isHigh) {
  try {
    if (isHigh) {
      const courses = data.EOCEP?.courses || [];
      const first   = data.EOCEP?.byCourse[courses[0]] || [];
      return first.map(e => e.year).sort();
    }
    const subj   = Object.keys(data).find(k => k !== 'type');
    const grades = Object.keys(data[subj]?.byGrade || {});
    const entries = data[subj]?.byGrade[grades[0]] || [];
    return entries.map(e => e.year).sort();
  } catch { return [2024]; }
}

// ─── Demographics ─────────────────────────────────────────────────────────────
function renderEnrollmentStats(demoData) {
  if (!demoData) return;

  const enroll = $('enroll-info');
  if (enroll) {
    enroll.innerHTML = `
      <div class="enroll-badge">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        ${demoData.enrollment?.toLocaleString() || '—'} Students Enrolled (${state.achievementYear})
      </div>
    `;
  }

  const raceBody = $('race-tbody');
  if (raceBody) {
    const colors = ['#2F3D4C','#43718B','#2ca05a','#8b44ac','#c0392b','#d97706','#5d6d7e'];
    const races  = Object.values(demoData.raceEthnicity || {});
    raceBody.innerHTML = races.map((r, i) => `
      <tr>
        <td>${r.label}</td>
        <td>
          <div class="bar-wrap">
            <div class="bar" style="width:${Math.round((r.pct || 0) * 2)}px;max-width:110px;background:${colors[i % colors.length]}"></div>
            <span style="font-size:.75rem;color:var(--color-text-muted)">${r.pct ?? '—'}%</span>
          </div>
        </td>
        <td>${r.count?.toLocaleString() || '—'}</td>
      </tr>`).join('');
  }
}

// ─── Global functions (called by HTML inline handlers) ────────────────────────
function goHome() {
  state.view                = 'home';
  state.selectedDistrictName = null;
  state.selectedSchoolId    = null;
  showHome();
  $('district-select').value       = '';
  $('school-search').disabled      = true;
  $('school-search').value         = '';
  $('school-list-container').innerHTML = '';
  const btn = $('view-dist-btn');
  if (btn) btn.style.display = 'none';
}

window.goHome    = goHome;
window.openSchool = (schoolId) => openSchool(schoolId);

window.app = {
  goHome,
  openDistrict(encoded) { openDistrict(decodeURIComponent(encoded)); },
  openCurrentDistrict()  { if (state.selectedDistrictName) openDistrict(state.selectedDistrictName); },
  openSchool(schoolId)   { openSchool(schoolId); }
};

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  showHome();
  await renderHomeSearchPanel();

  // Wire up district select (the HTML onchange calls onDistrictChange — define it globally)
  window.onDistrictChange = async (encoded) => {
    const name = encoded ? decodeURIComponent(encoded) : null;
    await renderSchoolList(name);
  };

  // Wire up school search filter
  window.filterSchools = (q) => {
    const handler = $('school-search')._handler;
    if (handler) handler();
  };

  // Wire up year selector (HTML inline onchange)
  window.onAchYearChange = (yr) => {
    state.achievementYear = parseInt(yr);
    renderAchievementChart(state.achievementData, state.achievementSubject, state.achievementYear);
  };

  // Total school count
  try {
    const districts = await fetchDistricts();
    const elS = $('stat-schools');
    if (elS) {
      const total = districts.reduce((n, d) => n + d.school_count, 0);
      elS.textContent = total.toLocaleString();
    }
  } catch {}
}

document.addEventListener('DOMContentLoaded', init);
