// ============================================================
// SC School Dashboard — Chart rendering with Chart.js
// ============================================================

import { ACCOUNTABILITY, ACHIEVEMENT, DEMOGRAPHICS } from '../data/data.js';

export const RATING_COLORS = {
  A: '#1a7a4a',
  B: '#0d6e8a',
  C: '#b07800',
  D: '#b05010',
  F: '#9b1c1c'
};

const BAND_COLORS = {
  exceeds:    '#003366',
  meets:      '#007a8a',
  basic:      '#d97706',
  belowBasic: '#b91c1c'
};

const RACE_COLORS = [
  '#003366', '#007a8a', '#2ca05a',
  '#8b44ac', '#c0392b', '#d97706', '#5d6d7e'
];

const GENDER_COLORS = ['#003366', '#c0392b'];
const SPEC_POP_COLOR = '#007a8a';

// Keep track of chart instances so we can destroy before re-rendering
const chartInstances = {};

function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

// ─── Accountability Trend Chart ───────────────────────────────────────────────
export function renderAccountabilityChart(schoolId) {
  const data = ACCOUNTABILITY[schoolId];
  if (!data) return;

  const ctx = document.getElementById('chart-accountability');
  if (!ctx) return;

  destroyChart('accountability');

  const years = data.ratings.map(r => r.year.toString());
  const scores = data.ratings.map(r => r.score);
  const ratings = data.ratings.map(r => r.rating);
  const colors = ratings.map(r => RATING_COLORS[r] || '#999');

  chartInstances['accountability'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: years,
      datasets: [{
        label: 'Rating Score',
        data: scores,
        borderColor: '#007a8a',
        borderWidth: 2.5,
        backgroundColor: 'rgba(0,122,138,0.08)',
        fill: true,
        tension: 0.35,
        pointRadius: 8,
        pointHoverRadius: 10,
        pointBackgroundColor: colors,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => `School Year ${items[0].label}`,
            label: item => {
              const r = data.ratings[item.dataIndex];
              return [`  Score: ${r.score}`, `  Rating: ${r.rating} — ${r.category}`];
            }
          },
          backgroundColor: '#1a2536',
          padding: 12,
          bodyFont: { size: 13 }
        },
        annotation: {
          annotations: {
            covidLine: {
              type: 'line',
              xMin: '2019',
              xMax: '2021',
              borderColor: 'rgba(180,0,0,0.25)',
              borderWidth: 1,
              borderDash: [5, 5],
              label: {
                content: '2020 Waived (COVID-19)',
                enabled: true,
                position: 'center',
                color: '#9b1c1c',
                font: { size: 11 },
                backgroundColor: 'rgba(255,255,255,0.85)'
              }
            }
          }
        }
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          grid: { color: 'rgba(0,0,0,0.06)' },
          ticks: {
            font: { size: 12 },
            callback: v => v + ' pts'
          },
          title: {
            display: true,
            text: 'Composite Score (0–100)',
            font: { size: 12 },
            color: '#4a5d74'
          }
        },
        x: {
          grid: { display: false },
          ticks: { font: { size: 12 } }
        }
      }
    }
  });

  // Render the history grid
  renderRatingHistoryGrid(data.ratings);
}

function renderRatingHistoryGrid(ratings) {
  const grid = document.getElementById('rating-history-grid');
  if (!grid) return;

  // Add 2020 as waived year marker
  const allYears = [2018, 2019, 2020, 2021, 2022, 2023, 2024];
  const ratingMap = {};
  ratings.forEach(r => { ratingMap[r.year] = r; });

  grid.innerHTML = allYears.map(yr => {
    if (yr === 2020) {
      return `<div class="rating-history-item">
        <span class="rating-history-year">${yr}</span>
        <span class="rating-waived">Waived</span>
        <span style="font-size:0.65rem;color:var(--color-text-muted)">COVID-19</span>
      </div>`;
    }
    const r = ratingMap[yr];
    if (!r) return `<div class="rating-history-item">
      <span class="rating-history-year">${yr}</span>
      <span class="rating-waived">—</span>
    </div>`;
    return `<div class="rating-history-item" title="${r.category} — Score: ${r.score}">
      <span class="rating-history-year">${yr}</span>
      <div class="rating-history-badge" style="background:${RATING_COLORS[r.rating]}">${r.rating}</div>
      <span style="font-size:0.68rem;color:var(--color-text-muted)">${r.score}</span>
    </div>`;
  }).join('');
}

// ─── Achievement Chart ────────────────────────────────────────────────────────
export function renderAchievementChart(schoolId, subject, year) {
  const data = ACHIEVEMENT[schoolId];
  if (!data) return;

  const ctx = document.getElementById('chart-achievement');
  if (!ctx) return;

  destroyChart('achievement');

  const isHigh = data.type === 'high';

  if (isHigh) {
    // EOCEP: x-axis = courses
    const eocep = data.EOCEP;
    if (!eocep) return;

    const yearData = {};
    eocep.courses.forEach(course => {
      const entry = eocep.byCourse[course]?.find(e => e.year === year);
      if (entry) yearData[course] = entry;
    });

    const labels = eocep.courses;
    chartInstances['achievement'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Exceeds',     data: labels.map(c => yearData[c]?.exceeds    ?? 0), backgroundColor: BAND_COLORS.exceeds },
          { label: 'Meets',       data: labels.map(c => yearData[c]?.meets      ?? 0), backgroundColor: BAND_COLORS.meets },
          { label: 'Basic',       data: labels.map(c => yearData[c]?.basic      ?? 0), backgroundColor: BAND_COLORS.basic },
          { label: 'Below Basic', data: labels.map(c => yearData[c]?.belowBasic ?? 0), backgroundColor: BAND_COLORS.belowBasic }
        ]
      },
      options: barChartOptions('Course', '% of Students')
    });
  } else {
    // Elementary/Middle: x-axis = grade, bars = performance levels
    const subjectData = data[subject];
    if (!subjectData) return;

    const grades = Object.keys(subjectData.byGrade).sort((a, b) => a - b);
    const gradeData = {};
    grades.forEach(g => {
      const entry = subjectData.byGrade[g]?.find(e => e.year === year);
      if (entry) gradeData[g] = entry;
    });

    const labels = grades.map(g => `Grade ${g}`);
    chartInstances['achievement'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Exceeds',     data: grades.map(g => gradeData[g]?.exceeds    ?? 0), backgroundColor: BAND_COLORS.exceeds },
          { label: 'Meets',       data: grades.map(g => gradeData[g]?.meets      ?? 0), backgroundColor: BAND_COLORS.meets },
          { label: 'Basic',       data: grades.map(g => gradeData[g]?.basic      ?? 0), backgroundColor: BAND_COLORS.basic },
          { label: 'Below Basic', data: grades.map(g => gradeData[g]?.belowBasic ?? 0), backgroundColor: BAND_COLORS.belowBasic }
        ]
      },
      options: barChartOptions('Grade Level', '% of Students')
    });
  }
}

function barChartOptions(xLabel, yLabel) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: { size: 12 },
          usePointStyle: true,
          pointStyleWidth: 10,
          padding: 16
        }
      },
      tooltip: {
        callbacks: {
          label: item => ` ${item.dataset.label}: ${item.raw}%`
        },
        backgroundColor: '#1a2536',
        padding: 10
      }
    },
    scales: {
      x: {
        stacked: false,
        grid: { display: false },
        ticks: { font: { size: 12 } },
        title: { display: true, text: xLabel, font: { size: 12 }, color: '#4a5d74' }
      },
      y: {
        stacked: false,
        min: 0,
        max: 100,
        grid: { color: 'rgba(0,0,0,0.06)' },
        ticks: { font: { size: 12 }, callback: v => v + '%' },
        title: { display: true, text: yLabel, font: { size: 12 }, color: '#4a5d74' }
      }
    }
  };
}

// ─── Demographics Charts ──────────────────────────────────────────────────────
export function renderDemographicsCharts(schoolId) {
  const data = DEMOGRAPHICS[schoolId];
  if (!data) return;

  renderRaceChart(data);
  renderGenderChart(data);
  renderSpecialPopulations(data);
}

function renderRaceChart(data) {
  const ctx = document.getElementById('chart-race');
  if (!ctx) return;
  destroyChart('race');

  const races = Object.values(data.raceEthnicity);
  const labels = races.map(r => r.label);
  const values = races.map(r => r.pct);

  chartInstances['race'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: RACE_COLORS.slice(0, labels.length),
        borderColor: '#fff',
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '55%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { size: 11 },
            usePointStyle: true,
            padding: 12,
            boxWidth: 10,
            generateLabels: chart => {
              const d = chart.data;
              return d.labels.map((l, i) => ({
                text: `${l}: ${d.datasets[0].data[i]}%`,
                fillStyle: d.datasets[0].backgroundColor[i],
                strokeStyle: '#fff',
                lineWidth: 1,
                pointStyle: 'circle'
              }));
            }
          }
        },
        tooltip: {
          callbacks: {
            label: item => ` ${item.label}: ${item.raw}%`
          },
          backgroundColor: '#1a2536',
          padding: 10
        }
      }
    }
  });
}

function renderGenderChart(data) {
  const ctx = document.getElementById('chart-gender');
  if (!ctx) return;
  destroyChart('gender');

  const male   = data.gender.male.pct;
  const female = data.gender.female.pct;

  chartInstances['gender'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Male', 'Female'],
      datasets: [{
        data: [male, female],
        backgroundColor: GENDER_COLORS,
        borderColor: '#fff',
        borderWidth: 2,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { size: 12 },
            usePointStyle: true,
            padding: 14,
            generateLabels: chart => {
              const d = chart.data;
              return d.labels.map((l, i) => ({
                text: `${l}: ${d.datasets[0].data[i]}%`,
                fillStyle: d.datasets[0].backgroundColor[i],
                strokeStyle: '#fff',
                lineWidth: 1,
                pointStyle: 'circle'
              }));
            }
          }
        },
        tooltip: {
          callbacks: { label: item => ` ${item.label}: ${item.raw}%` },
          backgroundColor: '#1a2536',
          padding: 10
        }
      }
    }
  });
}

function renderSpecialPopulations(data) {
  const container = document.getElementById('spec-pop-list');
  if (!container) return;

  const pops = Object.values(data.specialPopulations);
  container.innerHTML = pops.map(p => `
    <li class="spec-pop-item">
      <div class="spec-pop-header">
        <span class="spec-pop-name">${p.label}</span>
        <div style="display:flex;gap:8px;align-items:baseline">
          <span class="spec-pop-count">${p.count.toLocaleString()} students</span>
          <span class="spec-pop-pct">${p.pct}%</span>
        </div>
      </div>
      <div class="spec-pop-bar-bg">
        <div class="spec-pop-bar" style="width:${Math.min(p.pct, 100)}%;background:${getSpecPopColor(p.pct)}"></div>
      </div>
    </li>
  `).join('');
}

function getSpecPopColor(pct) {
  if (pct >= 50) return '#b91c1c';
  if (pct >= 30) return '#d97706';
  if (pct >= 15) return '#007a8a';
  return '#003366';
}

// ─── Trend comparison chart (district view) ───────────────────────────────────
export function renderDistrictTrendChart(districtSchools) {
  const ctx = document.getElementById('chart-district-trend');
  if (!ctx) return;
  destroyChart('district-trend');

  const colors = ['#003366','#007a8a','#2ca05a','#8b44ac','#c0392b','#d97706','#5d6d7e','#1e40af'];
  const years = ['2018','2019','2021','2022','2023','2024'];

  const datasets = districtSchools.slice(0, 8).map((school, i) => {
    const acct = ACCOUNTABILITY[school.id];
    if (!acct) return null;
    const ratingMap = {};
    acct.ratings.forEach(r => { ratingMap[r.year] = r.score; });
    return {
      label: school.name,
      data: years.map(y => ratingMap[parseInt(y)] ?? null),
      borderColor: colors[i % colors.length],
      backgroundColor: 'transparent',
      borderWidth: 2,
      tension: 0.3,
      pointRadius: 4,
      spanGaps: false
    };
  }).filter(Boolean);

  chartInstances['district-trend'] = new Chart(ctx, {
    type: 'line',
    data: { labels: years, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: 11 }, usePointStyle: true, padding: 12, boxWidth: 10 }
        },
        tooltip: {
          callbacks: {
            title: items => `School Year ${items[0].label}`,
            label: item => ` ${item.dataset.label}: ${item.raw} pts`
          },
          backgroundColor: '#1a2536',
          padding: 10
        }
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          grid: { color: 'rgba(0,0,0,0.06)' },
          ticks: { callback: v => v + ' pts', font: { size: 11 } }
        },
        x: {
          grid: { display: false },
          ticks: { font: { size: 12 } }
        }
      }
    }
  });
}

export { BAND_COLORS };
