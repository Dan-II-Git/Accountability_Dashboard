// ============================================================
// SC School Dashboard — Main Application
// ============================================================

import { DISTRICTS, ACCOUNTABILITY, ACHIEVEMENT, DEMOGRAPHICS } from '../data/data.js';
import {
  renderAccountabilityChart,
  renderAchievementChart,
  renderDemographicsCharts,
  renderDistrictTrendChart,
  RATING_COLORS
} from './charts.js';

// ─── State ────────────────────────────────────────────────────────────────────
let state = {
  view: 'home',           // 'home' | 'district' | 'school'
  selectedDistrictId: null,
  selectedSchoolId: null,
  achievementSubject: null,
  achievementYear: 2024
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDistrict(id) {
  return DISTRICTS.find(d => d.id === id) || null;
}

function getSchool(districtId, schoolId) {
  const d = getDistrict(districtId);
  if (!d) return null;
  return d.schools.find(s => s.id === schoolId) || null;
}

function schoolTypeLabel(type) {
  return { high: 'High School', middle: 'Middle School', elementary: 'Elementary School' }[type] || 'School';
}

function getLatestRating(schoolId) {
  const acct = ACCOUNTABILITY[schoolId];
  if (!acct || !acct.ratings.length) return null;
  return acct.ratings[acct.ratings.length - 1];
}

function defaultSubject(schoolType) {
  return schoolType === 'high' ? 'EOCEP' : 'ELA';
}

// ─── Views ────────────────────────────────────────────────────────────────────
function showHome() {
  document.getElementById('view-home').style.display = 'flex';
  document.getElementById('view-school').style.display = 'none';
  document.getElementById('view-district').style.display = 'none';
}

function showDistrict(districtId) {
  state.view = 'district';
  state.selectedDistrictId = districtId;

  document.getElementById('view-home').style.display = 'none';
  document.getElementById('view-school').style.display = 'none';
  document.getElementById('view-district').style.display = 'block';

  renderDistrictView(districtId);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showSchool(districtId, schoolId) {
  state.view = 'school';
  state.selectedDistrictId = districtId;
  state.selectedSchoolId = schoolId;

  const school = getSchool(districtId, schoolId);
  if (!school) return;

  state.achievementSubject = defaultSubject(school.type);
  state.achievementYear = 2024;

  document.getElementById('view-home').style.display = 'none';
  document.getElementById('view-district').style.display = 'none';
  document.getElementById('view-school').style.display = 'block';

  renderSchoolView(districtId, schoolId);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Home View ─────────────────────────────────────────────────────────────────
function renderHomeSearchPanel() {
  const districtSelect = document.getElementById('district-select');

  // Populate districts sorted alphabetically
  const sorted = [...DISTRICTS].sort((a, b) => a.name.localeCompare(b.name));

  districtSelect.innerHTML = '<option value="">— Select a district —</option>' +
    sorted.map(d => `<option value="${d.id}">${d.name} (${d.county} Co.)</option>`).join('');

  districtSelect.addEventListener('change', () => {
    const distId = districtSelect.value;
    if (!distId) {
      renderSchoolList(null);
      return;
    }
    renderSchoolList(distId);
  });
}

function renderSchoolList(districtId) {
  const container = document.getElementById('school-list-container');
  const searchInput = document.getElementById('school-search');

  if (!districtId) {
    searchInput.disabled = true;
    searchInput.value = '';
    container.innerHTML = '';
    return;
  }

  searchInput.disabled = false;
  const district = getDistrict(districtId);
  if (!district) return;

  function filterAndRender(query) {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? district.schools.filter(s => s.name.toLowerCase().includes(q))
      : district.schools;

    if (!filtered.length) {
      container.innerHTML = `<div class="no-schools-msg">No schools match your search.</div>`;
      return;
    }

    container.innerHTML = `<ul class="school-list" role="listbox" aria-label="Schools in ${district.name}">
      ${filtered.map(s => `
        <li class="school-list-item"
            role="option"
            tabindex="0"
            data-school-id="${s.id}"
            data-district-id="${districtId}">
          <span class="school-type-badge ${s.type}">${schoolTypeLabel(s.type)}</span>
          <span class="school-name-text">${s.name}</span>
          <span class="school-grades-text">Grades ${s.grades}</span>
        </li>
      `).join('')}
    </ul>`;

    container.querySelectorAll('.school-list-item').forEach(item => {
      item.addEventListener('click', () => {
        showSchool(item.dataset.districtId, item.dataset.schoolId);
      });
      item.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          showSchool(item.dataset.districtId, item.dataset.schoolId);
        }
      });
    });
  }

  filterAndRender('');

  searchInput.removeEventListener('input', searchInput._handler);
  searchInput._handler = () => filterAndRender(searchInput.value);
  searchInput.addEventListener('input', searchInput._handler);

  // Also allow clicking "View District" button
  const viewDistBtn = document.getElementById('view-district-btn');
  if (viewDistBtn) {
    viewDistBtn.style.display = 'inline-flex';
    viewDistBtn.onclick = () => showDistrict(districtId);
    viewDistBtn.textContent = `View ${district.name} Overview`;
  }
}

// ─── District View ─────────────────────────────────────────────────────────────
function renderDistrictView(districtId) {
  const district = getDistrict(districtId);
  if (!district) return;

  // Breadcrumb
  document.getElementById('district-breadcrumb').innerHTML = `
    <a onclick="app.goHome()">Home</a>
    <span class="breadcrumb-sep">›</span>
    <span class="breadcrumb-current">${district.name}</span>
  `;

  // District header
  document.getElementById('district-header-name').textContent = district.name;
  document.getElementById('district-header-county').textContent = `${district.county} County`;
  document.getElementById('district-header-schools').textContent = `${district.schools.length} Schools`;

  // School cards
  const grid = document.getElementById('district-school-cards');
  grid.innerHTML = district.schools.map(school => {
    const latest = getLatestRating(school.id);
    const demo = DEMOGRAPHICS[school.id];
    const color = latest ? (RATING_COLORS[latest.rating] || '#999') : '#999';
    return `
      <div class="district-school-card" tabindex="0"
           onclick="app.openSchool('${districtId}','${school.id}')"
           onkeydown="if(event.key==='Enter')app.openSchool('${districtId}','${school.id}')">
        <div class="dsc-header">
          <div class="dsc-grade-badge" style="background:${color}">
            ${latest ? latest.rating : '—'}
          </div>
          <div class="dsc-info">
            <div class="dsc-name">${school.name}</div>
            <div class="dsc-meta">
              <span class="school-type-badge ${school.type}">${schoolTypeLabel(school.type)}</span>
              <span class="dsc-grades">Grades ${school.grades}</span>
            </div>
          </div>
        </div>
        ${latest ? `
        <div class="dsc-stats">
          <div class="dsc-stat">
            <span class="dsc-stat-value">${latest.score}</span>
            <span class="dsc-stat-label">Score (2024)</span>
          </div>
          <div class="dsc-stat">
            <span class="dsc-stat-value">${demo ? demo.enrollment.toLocaleString() : '—'}</span>
            <span class="dsc-stat-label">Enrollment</span>
          </div>
          <div class="dsc-stat">
            <span class="dsc-stat-value" style="color:${color}">${latest.rating}</span>
            <span class="dsc-stat-label">${latest.category}</span>
          </div>
        </div>` : ''}
      </div>
    `;
  }).join('');

  // District trend chart
  setTimeout(() => renderDistrictTrendChart(district.schools), 100);
}

// ─── School View ───────────────────────────────────────────────────────────────
function renderSchoolView(districtId, schoolId) {
  const district = getDistrict(districtId);
  const school   = getSchool(districtId, schoolId);
  if (!district || !school) return;

  // Breadcrumb
  document.getElementById('school-breadcrumb').innerHTML = `
    <a onclick="app.goHome()">Home</a>
    <span class="breadcrumb-sep">›</span>
    <a onclick="app.openDistrict('${districtId}')">${district.name}</a>
    <span class="breadcrumb-sep">›</span>
    <span class="breadcrumb-current">${school.name}</span>
  `;

  // School header
  const latest = getLatestRating(schoolId);
  const color  = latest ? (RATING_COLORS[latest.rating] || '#003366') : '#003366';

  document.getElementById('school-header-typebadge').textContent = schoolTypeLabel(school.type);
  document.getElementById('school-header-name').textContent = school.name;
  document.getElementById('school-header-district').textContent = district.name;
  document.getElementById('school-header-grades').textContent = `Grades ${school.grades}`;
  document.getElementById('school-header-county').textContent = `${district.county} County`;

  const gradeBadge = document.getElementById('school-current-grade');
  if (latest) {
    gradeBadge.style.background = color;
    gradeBadge.textContent = latest.rating;
    document.getElementById('school-grade-year').textContent = `${latest.year} Rating`;
  }

  // ── Accountability
  setTimeout(() => renderAccountabilityChart(schoolId), 50);

  // ── Achievement tabs
  const achievementData = ACHIEVEMENT[schoolId];
  renderAchievementTabs(school, achievementData, schoolId);

  // ── Demographics
  setTimeout(() => renderDemographicsCharts(schoolId), 50);
  renderEnrollmentStats(schoolId);
}

function renderAchievementTabs(school, achievementData, schoolId) {
  const tabBar    = document.getElementById('achievement-tab-bar');
  const panelArea = document.getElementById('achievement-panel-area');
  const yearSel   = document.getElementById('achievement-year-select');

  if (!achievementData) {
    tabBar.innerHTML = '';
    panelArea.innerHTML = '<div class="empty-state"><p>No achievement data available.</p></div>';
    return;
  }

  const isHigh = school.type === 'high';
  const tabs = isHigh
    ? [{ id: 'EOCEP', label: 'EOCEP (End-of-Course)' }]
    : [
        { id: 'ELA',     label: 'ELA — SC READY' },
        { id: 'Math',    label: 'Math — SC READY' },
        { id: 'Science', label: 'Science — SC PASS' }
      ];

  // Render tabs
  tabBar.innerHTML = tabs.map((t, i) =>
    `<button class="tab-btn ${i === 0 ? 'active' : ''}"
             role="tab"
             aria-selected="${i === 0}"
             data-subject="${t.id}">${t.label}</button>`
  ).join('');

  tabBar.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      tabBar.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      state.achievementSubject = btn.dataset.subject;
      renderAchievementChart(schoolId, state.achievementSubject, state.achievementYear);
    });
  });

  // Year selector
  yearSel.innerHTML = [2022, 2023, 2024].map(y =>
    `<option value="${y}" ${y === 2024 ? 'selected' : ''}>${y}</option>`
  ).join('');
  yearSel.onchange = () => {
    state.achievementYear = parseInt(yearSel.value);
    renderAchievementChart(schoolId, state.achievementSubject, state.achievementYear);
  };

  state.achievementSubject = tabs[0].id;
  setTimeout(() => renderAchievementChart(schoolId, state.achievementSubject, state.achievementYear), 50);
}

function renderEnrollmentStats(schoolId) {
  const demo = DEMOGRAPHICS[schoolId];
  if (!demo) return;

  const el = document.getElementById('enrollment-info');
  if (!el) return;

  el.innerHTML = `
    <div class="enrollment-badge">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
      ${demo.enrollment.toLocaleString()} Students Enrolled (2024)
    </div>
  `;

  // Race/ethnicity bars
  const raceTable = document.getElementById('race-table');
  if (raceTable) {
    const colors = ['#003366','#007a8a','#2ca05a','#8b44ac','#c0392b','#d97706','#5d6d7e'];
    raceTable.innerHTML = Object.values(demo.raceEthnicity).map((r, i) => `
      <tr>
        <td>${r.label}</td>
        <td>
          <div class="demo-bar-wrap">
            <div class="demo-bar" style="width:${r.pct * 2}px;max-width:120px;background:${colors[i % colors.length]}"></div>
            <span class="demo-bar-pct">${r.pct}%</span>
          </div>
        </td>
        <td>${Math.round(demo.enrollment * r.pct / 100).toLocaleString()}</td>
      </tr>
    `).join('');
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
window.app = {
  goHome() {
    state.view = 'home';
    state.selectedDistrictId = null;
    state.selectedSchoolId = null;
    showHome();
    // Reset search
    document.getElementById('district-select').value = '';
    document.getElementById('school-search').disabled = true;
    document.getElementById('school-search').value = '';
    document.getElementById('school-list-container').innerHTML = '';
    const btn = document.getElementById('view-district-btn');
    if (btn) btn.style.display = 'none';
  },
  openDistrict(districtId) {
    showDistrict(districtId);
  },
  openSchool(districtId, schoolId) {
    showSchool(districtId, schoolId);
  }
};

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  // Update hero stats
  const totalSchools = DISTRICTS.reduce((n, d) => n + d.schools.length, 0);
  const el = document.getElementById('stat-districts');
  if (el) el.textContent = DISTRICTS.length;
  const el2 = document.getElementById('stat-schools');
  if (el2) el2.textContent = totalSchools.toLocaleString();

  renderHomeSearchPanel();
  showHome();
}

document.addEventListener('DOMContentLoaded', init);
