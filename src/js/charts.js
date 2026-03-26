// ============================================================
// SC School Dashboard — Chart rendering with Chart.js
// Data is passed as parameters (fetched from API in app.js)
// ============================================================

export const RATING_COLORS = {
  'Excellent':      '#1a7a4a',
  'Good':           '#0d6e8a',
  'Average':        '#b07800',
  'Below Average':  '#b05010',
  'Unsatisfactory': '#9b1c1c',
  'Not Rated':      '#9ca3af',
  '—':              '#9ca3af'
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

const GENDER_COLORS  = ['#003366', '#c0392b'];

const chartInstances = {};

function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

// ─── Accountability Trend Chart ───────────────────────────────────────────────
// ratingsData: [{ year, score, overall: { rate, short, color } }]
export function renderAccountabilityChart(ratingsData) {
  if (!ratingsData?.length) return;

  const ctx = document.getElementById('chart-accountability');
  if (!ctx) return;
  destroyChart('accountability');

  const years  = ratingsData.map(r => r.year.toString());
  const scores = ratingsData.map(r => r.score);
  const colors = ratingsData.map(r => r.overall?.color || '#9ca3af');

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
        spanGaps: false
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
              const r = ratingsData[item.dataIndex];
              return [
                `  Score: ${r.score ?? 'N/A'}`,
                `  Rating: ${r.overall?.rate || 'Not Rated'}`
              ];
            }
          },
          backgroundColor: '#1a2536',
          padding: 12,
          bodyFont: { size: 13 }
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

  renderRatingHistoryGrid(ratingsData);
}

function renderRatingHistoryGrid(ratings) {
  const grid = document.getElementById('rating-hist-grid');
  if (!grid) return;

  const allYears = [2022, 2023, 2024, 2025];
  const ratingMap = {};
  ratings.forEach(r => { ratingMap[r.year] = r; });

  grid.innerHTML = allYears.map(yr => {
    const r = ratingMap[yr];
    if (!r) return `<div class="rating-history-item">
      <span class="rating-history-year">${yr}</span>
      <span class="rating-waived">—</span>
    </div>`;
    return `<div class="rating-history-item" title="${r.overall?.rate || ''} — Score: ${r.score ?? '—'}">
      <span class="rating-history-year">${yr}</span>
      <div class="rating-history-badge" style="background:${r.overall?.color || '#9ca3af'}">${r.overall?.label || '—'}</div>
      <span style="font-size:0.68rem;color:var(--color-text-muted)">${r.score ?? '—'}</span>
    </div>`;
  }).join('');
}

// ─── Achievement Chart ────────────────────────────────────────────────────────
// achievementData: API response from /api/schools/:id/achievement
export function renderAchievementChart(achievementData, subject, year) {
  if (!achievementData) return;

  const ctx = document.getElementById('chart-achievement');
  if (!ctx) return;
  destroyChart('achievement');

  const isHigh = achievementData.type === 'high';

  if (isHigh) {
    const eocep = achievementData.EOCEP;
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
          { label: 'A — Exceeds Expectations',        data: labels.map(c => yearData[c]?.exceeds    ?? 0), backgroundColor: BAND_COLORS.exceeds },
          { label: 'B & C — Meets Expectations',     data: labels.map(c => yearData[c]?.meets      ?? 0), backgroundColor: BAND_COLORS.meets },
          { label: 'D — Minimally Meets Expectations', data: labels.map(c => yearData[c]?.basic    ?? 0), backgroundColor: BAND_COLORS.basic },
          { label: 'F — Does Not Meet Expectations', data: labels.map(c => yearData[c]?.belowBasic ?? 0), backgroundColor: BAND_COLORS.belowBasic }
        ]
      },
      options: barChartOptions('Course', '% of Students')
    });

  } else {
    const subjectData = achievementData[subject];
    if (!subjectData) return;

    const grades = Object.keys(subjectData.byGrade)
      .filter(g => g !== 'ALL')
      .sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));

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
          { label: 'Exceeding',        data: grades.map(g => gradeData[g]?.exceeds    ?? 0), backgroundColor: BAND_COLORS.exceeds },
          { label: 'Meets',            data: grades.map(g => gradeData[g]?.meets      ?? 0), backgroundColor: BAND_COLORS.meets },
          { label: 'Approaching',      data: grades.map(g => gradeData[g]?.basic      ?? 0), backgroundColor: BAND_COLORS.basic },
          { label: 'In Need of Support', data: grades.map(g => gradeData[g]?.belowBasic ?? 0), backgroundColor: BAND_COLORS.belowBasic }
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
        callbacks: { label: item => ` ${item.dataset.label}: ${item.raw != null ? item.raw + '%' : 'N/A'}` },
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
// demographicsData: API response from /api/schools/:id/demographics
export function renderDemographicsCharts(demographicsData) {
  if (!demographicsData) return;
  renderRaceChart(demographicsData);
  renderGenderChart(demographicsData);
  renderSpecialPopulations(demographicsData);
}

function renderRaceChart(data) {
  const ctx = document.getElementById('chart-race');
  if (!ctx) return;
  destroyChart('race');

  const races  = Object.values(data.raceEthnicity || {});
  if (!races.length) return;

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
          callbacks: { label: item => ` ${item.label}: ${item.raw}%` },
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

  const male   = data.gender?.male?.pct;
  const female = data.gender?.female?.pct;
  if (male == null && female == null) return;

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
                text: `${l}: ${d.datasets[0].data[i] ?? '—'}%`,
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

  const pops = Object.values(data.specialPopulations || {});
  if (!pops.length) {
    container.innerHTML = '<li style="color:var(--color-text-muted);font-size:.85rem">No data available.</li>';
    return;
  }

  container.innerHTML = pops.map(p => `
    <li class="spec-pop-item">
      <div class="spec-pop-header">
        <span class="spec-pop-name">${p.label}</span>
        <div style="display:flex;gap:8px;align-items:baseline">
          <span class="spec-pop-count">${p.count?.toLocaleString() ?? '—'} students</span>
          <span class="spec-pop-pct">${p.pct ?? '—'}%</span>
        </div>
      </div>
      <div class="spec-pop-bar-bg">
        <div class="spec-pop-bar" style="width:${Math.min(p.pct ?? 0, 100)}%;background:${getSpecPopColor(p.pct ?? 0)}"></div>
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

// ─── District Trend Chart ─────────────────────────────────────────────────────
// trendData: [{ school_id, school_name, school_type, ratings: [{ year, score }] }]
export function renderDistrictTrendChart(trendData) {
  const ctx = document.getElementById('chart-dist-trend');
  if (!ctx) return;
  destroyChart('district-trend');

  if (!trendData?.length) return;

  const colors = ['#003366','#007a8a','#2ca05a','#8b44ac','#c0392b','#d97706','#5d6d7e','#1e40af'];
  const years  = ['2022','2023','2024','2025'];

  const datasets = trendData.slice(0, 8).map((school, i) => {
    const ratingMap = {};
    school.ratings.forEach(r => { ratingMap[r.year] = r.score; });
    return {
      label:           school.school_name,
      data:            years.map(y => ratingMap[parseInt(y)] ?? null),
      borderColor:     colors[i % colors.length],
      backgroundColor: 'transparent',
      borderWidth:     2,
      tension:         0.3,
      pointRadius:     4,
      spanGaps:        false
    };
  });

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
            label: item => ` ${item.dataset.label}: ${item.raw != null ? item.raw + ' pts' : 'N/A'}`
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

// ─── Classroom / Teacher Workforce Chart ─────────────────────────────────────
// data: [{ year, avg_salary, pct_return_1yr, pct_return_3yr, teacher_count }]
export function renderClassroomChart(data, canvasId = 'chart-classroom') {
  const ctx = document.getElementById(canvasId);
  if (!ctx || !data?.length) return;
  destroyChart(canvasId);

  const years      = data.map(d => d.year);
  const salaries   = data.map(d => d.avg_salary   ?? null);
  const ret1yr     = data.map(d => d.pct_return_1yr ?? null);
  const ret3yr     = data.map(d => d.pct_return_3yr ?? null);

  const fmtSalary = v => v != null ? `$${Math.round(v).toLocaleString()}` : 'N/A';
  const fmtPct    = v => v != null ? `${v.toFixed(1)}%` : 'N/A';

  chartInstances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: years,
      datasets: [
        {
          label: 'Avg Teacher Salary',
          data: salaries,
          borderColor: '#1a7a4a',
          backgroundColor: 'rgba(26,122,74,0.08)',
          tension: 0.3,
          pointRadius: 5,
          pointHoverRadius: 7,
          yAxisID: 'ySalary',
          spanGaps: true
        },
        {
          label: '1-Year Retention',
          data: ret1yr,
          borderColor: '#0d6e8a',
          backgroundColor: 'rgba(13,110,138,0.08)',
          tension: 0.3,
          pointRadius: 5,
          pointHoverRadius: 7,
          yAxisID: 'yPct',
          spanGaps: true
        },
        {
          label: '3-Year Retention',
          data: ret3yr,
          borderColor: '#b07800',
          backgroundColor: 'rgba(176,120,0,0.08)',
          borderDash: [5, 4],
          tension: 0.3,
          pointRadius: 5,
          pointHoverRadius: 7,
          yAxisID: 'yPct',
          spanGaps: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { size: 13 }, padding: 16 }
        },
        tooltip: {
          backgroundColor: '#1a2536',
          padding: 10,
          callbacks: {
            label: item => {
              const v = item.raw;
              if (item.dataset.yAxisID === 'ySalary') return ` ${item.dataset.label}: ${fmtSalary(v)}`;
              return ` ${item.dataset.label}: ${fmtPct(v)}`;
            }
          }
        }
      },
      scales: {
        ySalary: {
          type: 'linear',
          position: 'left',
          title: { display: true, text: 'Average Salary', font: { size: 12 } },
          ticks: {
            callback: v => `$${(v / 1000).toFixed(0)}k`,
            font: { size: 12 }
          },
          grid: { color: 'rgba(0,0,0,0.06)' }
        },
        yPct: {
          type: 'linear',
          position: 'right',
          min: 0,
          max: 100,
          title: { display: true, text: 'Retention Rate (%)', font: { size: 12 } },
          ticks: {
            callback: v => `${v}%`,
            font: { size: 12 }
          },
          grid: { display: false }
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
