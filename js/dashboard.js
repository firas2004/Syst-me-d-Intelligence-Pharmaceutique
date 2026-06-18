// ============================================================
// PHARMA-INTEL — Dashboard Module (Chart.js)
// ============================================================
import { getAllTables, getDrugInfo, isLoaded } from './database.js';
import { t } from './i18n.js';

let charts = {};

export function initDashboard() {
  document.addEventListener('langChanged', () => updateChartLabels());
}

export function renderDashboard() {
  const loaded = isLoaded('drugA');
  const placeholder = document.getElementById('dashboard-placeholder');
  const content = document.getElementById('dashboard-content');
  if (!loaded) {
    if (placeholder) placeholder.style.display = 'flex';
    if (content) content.style.display = 'none';
    return;
  }
  if (placeholder) placeholder.style.display = 'none';
  if (content) content.style.display = 'block';

  updateKPIs();
  renderHeatmap();
  renderDegradationChart();
  renderAgingTimeline();
  renderRiskMatrix();
}

function updateKPIs() {
  const tablesA = getAllTables('drugA');
  const infoA = getDrugInfo('drugA');
  const infoB = getDrugInfo('drugB');

  const shelfLife = tablesA?.T2?.conditions?.[0]?.shelfLife ?? '—';
  const maxDeg = Math.max(...(tablesA?.T3?.stressTests?.map(s => s.rate) ?? [0]));
  const version = JSON.parse(localStorage.getItem('pharma_db') ?? '{}')?.metadata?.version ?? 1;
  const sourcesCount = 6; // PubChem + ICH Q1A/Q1B/Q1E + WHO + EMA

  setText('kpi-shelf-value', shelfLife);
  setText('kpi-risk-value', `${Math.min(99, Math.round(maxDeg * 2.5))}%`);
  setText('kpi-sources-value', sourcesCount);
  setText('kpi-version-value', `v${version}`);
  setText('kpi-drug-a', infoA?.name ?? '—');
  setText('kpi-drug-b', infoB?.name ?? '—');
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ─── SCHEMA 1: Stability Heatmap ──────────────────────────────
// X: conditions (5 columns), Y: molecules (Drug A [, Drug B]), Cell: % assay remaining
function renderHeatmap() {
  const canvas = document.getElementById('chart-heatmap');
  if (!canvas) return;

  const conditions = ['25°C/60%RH', '30°C/65%RH', '40°C/75%RH', '60°C (Stress)', 'ICH Q1B UV'];
  const aData = getAllTables('drugA')?.T2?.conditions?.map(c => parseFloat(c.assay)) ?? [97, 95, 91, 78, 95];
  const bTables = getAllTables('drugB');
  const bData = bTables?.T2?.conditions?.map(c => parseFloat(c.assay)) ?? null;

  const datasets = [
    {
      label: getDrugInfo('drugA')?.name ?? 'Drug A',
      data: aData,
      backgroundColor: aData.map(v => assayToColor(v, 0.8)),
      borderColor: aData.map(v => assayToColor(v, 1)),
      borderWidth: 1,
      borderRadius: 4,
    }
  ];

  if (bData) {
    datasets.push({
      label: getDrugInfo('drugB')?.name ?? 'Drug B',
      data: bData,
      backgroundColor: bData.map(v => assayToColor(v, 0.5)),
      borderColor: bData.map(v => assayToColor(v, 0.8)),
      borderWidth: 1,
      borderRadius: 4,
    });
  }

  if (charts.heatmap) charts.heatmap.destroy();
  charts.heatmap = new Chart(canvas, {
    type: 'bar',
    data: { labels: conditions, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#e8eef7', font: { family: 'Inter' } } },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.raw}% dosage restant`,
            afterLabel: ctx => ctx.raw >= 95 ? '✓ Conforme ICH Q1A' : ctx.raw >= 90 ? '⚠ Limite ICH' : '✗ Non conforme ICH'
          }
        }
      },
      scales: {
        x: { ticks: { color: '#8fa3c0', font: { size: 11 } }, grid: { color: 'rgba(0,212,255,0.08)' } },
        y: { min: 50, max: 105, ticks: { color: '#8fa3c0', callback: v => v + '%' }, grid: { color: 'rgba(0,212,255,0.08)' },
          title: { display: true, text: '% Dosage restant', color: '#8fa3c0' } }
      }
    }
  });
}

function assayToColor(val, alpha) {
  if (val >= 95) return `rgba(34, 197, 94, ${alpha})`;
  if (val >= 90) return `rgba(245, 158, 11, ${alpha})`;
  return `rgba(239, 68, 68, ${alpha})`;
}

// ─── SCHEMA 2: Degradation Bar Chart ──────────────────────────
// X: stress type, Y: degradation rate %, color = ICH compliance
function renderDegradationChart() {
  const canvas = document.getElementById('chart-degradation');
  if (!canvas) return;

  const stress = getAllTables('drugA')?.T3?.stressTests ?? [];
  const labels = stress.map(s => s.type);
  const rates = stress.map(s => s.rate);
  const colors = stress.map(s => s.ichCompliant ? 'rgba(34,197,94,0.8)' : s.borderline ? 'rgba(245,158,11,0.8)' : 'rgba(239,68,68,0.8)');
  const borders = stress.map(s => s.ichCompliant ? '#22c55e' : s.borderline ? '#f59e0b' : '#ef4444');

  const datasets = [{
    label: getDrugInfo('drugA')?.name ?? 'Drug A',
    data: rates, backgroundColor: colors, borderColor: borders, borderWidth: 1.5, borderRadius: 4
  }];

  const bStress = getAllTables('drugB')?.T3?.stressTests;
  if (bStress) {
    datasets.push({
      label: getDrugInfo('drugB')?.name ?? 'Drug B',
      data: bStress.map(s => s.rate),
      backgroundColor: bStress.map(() => 'rgba(0,212,255,0.4)'),
      borderColor: '#00d4ff', borderWidth: 1.5, borderRadius: 4
    });
  }

  if (charts.degradation) charts.degradation.destroy();
  charts.degradation = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#e8eef7' } },
        tooltip: {
          callbacks: {
            afterLabel: ctx => {
              const s = stress[ctx.dataIndex];
              if (!s) return '';
              return [`Produits: ${s.products}`, `Méthode: ${s.method}`, s.ichCompliant ? '✓ ICH Conforme' : '✗ ICH Non conforme'];
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: '#8fa3c0' }, grid: { color: 'rgba(0,212,255,0.08)' } },
        y: { ticks: { color: '#8fa3c0', callback: v => v + '%' }, grid: { color: 'rgba(0,212,255,0.08)' },
          title: { display: true, text: 'Taux de Dégradation (%)', color: '#8fa3c0' } }
      }
    }
  });
}

// ─── SCHEMA 3: Aging Timeline ──────────────────────────────────
// X: T0→T24 months, Y: 4 parameters
function renderAgingTimeline() {
  const canvas = document.getElementById('chart-aging');
  if (!canvas) return;

  const t4 = getAllTables('drugA')?.T4?.realTime;
  if (!t4) return;
  const pts = t4.timePoints;
  const labels = pts.map(p => `T${p.month}m`);

  if (charts.aging) charts.aging.destroy();
  charts.aging = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Dosage (%)', data: pts.map(p => p.assay), borderColor: '#00d4ff', backgroundColor: 'rgba(0,212,255,0.1)', tension: 0.4, pointRadius: 4, yAxisID: 'y1' },
        { label: 'Impuretés (%)', data: pts.map(p => p.impurities), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', tension: 0.4, pointRadius: 4, yAxisID: 'y2' },
        { label: 'pH', data: pts.map(p => p.ph), borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', tension: 0.4, pointRadius: 4, yAxisID: 'y3', borderDash: [5, 3] },
        { label: 'Dissolution (%)', data: pts.map(p => p.dissolution), borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', tension: 0.4, pointRadius: 4, yAxisID: 'y1', borderDash: [3, 3] }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#e8eef7' } } },
      scales: {
        x: { ticks: { color: '#8fa3c0' }, grid: { color: 'rgba(0,212,255,0.06)' } },
        y1: { type: 'linear', position: 'left', min: 80, max: 105, ticks: { color: '#00d4ff', callback: v => v + '%' }, grid: { color: 'rgba(0,212,255,0.06)' }, title: { display: true, text: 'Dosage / Dissolution (%)', color: '#00d4ff' } },
        y2: { type: 'linear', position: 'right', min: 0, max: 3, ticks: { color: '#ef4444', callback: v => v + '%' }, grid: { drawOnChartArea: false }, title: { display: true, text: 'Impuretés (%)', color: '#ef4444' } },
        y3: { type: 'linear', position: 'right', min: 5, max: 8, ticks: { color: '#f59e0b' }, grid: { drawOnChartArea: false }, display: false }
      }
    }
  });
}

// ─── SCHEMA 4: Risk Matrix (Bubble Chart) ─────────────────────
// X: degradation probability, Y: impact severity, size: pathway count, color: ICH zone
function renderRiskMatrix() {
  const canvas = document.getElementById('chart-risk');
  if (!canvas) return;

  function buildRiskData(slot, color) {
    const t3 = getAllTables(slot)?.T3?.stressTests ?? [];
    return t3.map(s => ({
      x: s.rate * 2.2,
      y: s.ichCompliant ? (s.rate < 10 ? 3 : 6) : 9,
      r: 8 + s.rate * 0.4,
      type: s.type,
      rate: s.rate,
      ich: s.ichCompliant
    }));
  }

  const datasets = [{
    label: getDrugInfo('drugA')?.name ?? 'Drug A',
    data: buildRiskData('drugA'),
    backgroundColor: 'rgba(0,212,255,0.5)',
    borderColor: '#00d4ff', borderWidth: 1.5
  }];

  const bLoaded = isLoaded('drugB');
  if (bLoaded) {
    datasets.push({
      label: getDrugInfo('drugB')?.name ?? 'Drug B',
      data: buildRiskData('drugB'),
      backgroundColor: 'rgba(245,158,11,0.5)',
      borderColor: '#f59e0b', borderWidth: 1.5
    });
  }

  if (charts.risk) charts.risk.destroy();
  charts.risk = new Chart(canvas, {
    type: 'bubble',
    data: { datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#e8eef7' } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const d = ctx.raw;
              return [`Type: ${d.type ?? ''}`, `Probabilité: ${Math.round(d.x)}%`, `Sévérité: ${d.y}/10`, `ICH: ${d.ich ? '✓' : '✗'}`];
            }
          }
        }
      },
      scales: {
        x: { min: 0, max: 100, ticks: { color: '#8fa3c0', callback: v => v + '%' }, grid: { color: 'rgba(0,212,255,0.06)' }, title: { display: true, text: 'Probabilité Dégradation (%)', color: '#8fa3c0' } },
        y: { min: 0, max: 10, ticks: { color: '#8fa3c0' }, grid: { color: 'rgba(0,212,255,0.06)' }, title: { display: true, text: 'Sévérité / Impact (0-10)', color: '#8fa3c0' } }
      }
    }
  });

  // Draw risk quadrant overlay
  addRiskAnnotations(canvas);
}

function addRiskAnnotations(canvas) {
  // Add risk zone labels via CSS overlay — no plugin needed
  const parent = canvas.parentElement;
  const existing = parent.querySelector('.risk-overlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.className = 'risk-overlay';
  overlay.innerHTML = `
    <span class="risk-label rl-low">RISQUE FAIBLE</span>
    <span class="risk-label rl-high">RISQUE ÉLEVÉ</span>
  `;
  parent.style.position = 'relative';
  parent.appendChild(overlay);
}

function updateChartLabels() {
  renderDashboard();
}

export function getChartAsBase64(chartId) {
  const canvas = document.getElementById(chartId);
  return canvas?.toDataURL('image/png') ?? null;
}
