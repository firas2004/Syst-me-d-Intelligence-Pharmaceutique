// ============================================================
// PHARMA-INTEL v3.0 — Global Database Dashboard
// Statistics across entire IndexedDB collection
// ============================================================
import { getStats, openDB } from './indexeddb.js';

let charts = {};

export async function renderGlobalDash() {
  const container = document.getElementById('page-global-dash');
  if (!container) return;

  const stats = await getStats();
  const { total, byClass, byPhase, byFlag, withStability } = stats;

  const topClasses = Object.entries(byClass).sort((a, b) => b[1] - a[1]).slice(0, 20);
  const realCount = byFlag['DONNÉE RÉELLE'] ?? 0;
  const missingCount = byFlag['DONNÉE MANQUANTE'] ?? 0;
  const realPct = total > 0 ? Math.round(realCount / total * 100) : 0;

  container.innerHTML = `
    <div class="page-header">
      <h1>📊 Dashboard Global de la Base</h1>
    </div>
    <div class="kpi-grid" style="grid-template-columns:repeat(5,1fr)">
      <div class="kpi-card">
        <div class="kpi-label">Molécules totales</div>
        <div class="kpi-value">${total.toLocaleString()}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Données réelles</div>
        <div class="kpi-value" style="color:var(--ok)">${realPct}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Molécules approuvées (Ph4)</div>
        <div class="kpi-value">${(byPhase['4'] ?? 0).toLocaleString()}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Avec stabilité pug_view</div>
        <div class="kpi-value">${withStability.toLocaleString()}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Classes thérapeutiques</div>
        <div class="kpi-value">${Object.keys(byClass).length}</div>
      </div>
    </div>

    ${total === 0 ? `
      <div class="card">
        <div id="dashboard-placeholder" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:300px;gap:16px;color:var(--text2)">
          <div style="font-size:60px;opacity:.3">📦</div>
          <p style="font-size:15px">La base est vide — lancez la collecte automatique d'abord</p>
          <button class="btn btn-primary" id="gdash-go-collect">🚀 Aller à la Collecte</button>
        </div>
      </div>
    ` : `
      <div class="charts-grid">
        <div class="chart-card" style="grid-column:span 2">
          <div class="chart-title">Top 20 Classes Thérapeutiques</div>
          <div class="chart-wrap" style="height:320px"><canvas id="gchart-classes"></canvas></div>
        </div>
        <div class="chart-card">
          <div class="chart-title">Distribution Phases Cliniques</div>
          <div class="chart-wrap"><canvas id="gchart-phases"></canvas></div>
        </div>
        <div class="chart-card">
          <div class="chart-title">Qualité des Données</div>
          <div class="chart-wrap"><canvas id="gchart-flags"></canvas></div>
        </div>
      </div>
      <div class="card">
        <h3>Résumé par Classe Thérapeutique (Top 10)</h3>
        <table class="data-table">
          <thead><tr><th>Classe</th><th>Molécules</th><th>% du total</th><th>Distribution</th></tr></thead>
          <tbody>
            ${topClasses.slice(0, 10).map(([cls, cnt]) => {
              const pct = Math.round(cnt / total * 100);
              return `<tr>
                <td>${cls || 'Non classifié'}</td>
                <td style="font-weight:700;color:var(--teal)">${cnt.toLocaleString()}</td>
                <td>${pct}%</td>
                <td><div class="progress-bar" style="width:120px;display:inline-block"><div style="width:${pct}%"></div></div></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;

  document.getElementById('gdash-go-collect')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('pharma:navigate', { detail: 'collector' }));
  });

  if (total > 0) {
    await buildCharts(topClasses, byPhase, byFlag);
  }
}

async function buildCharts(topClasses, byPhase, byFlag) {
  destroyCharts();

  const TEAL = '#00d4ff', OK = '#22c55e', WARN = '#f59e0b', BAD = '#ef4444';
  const TEXT = '#8fa3c0', BG4 = '#1a2340';

  const baseOpts = {
    plugins: { legend: { labels: { color: TEXT, font: { size: 11 } } } },
    scales: {
      x: { ticks: { color: TEXT, font: { size: 10 } }, grid: { color: 'rgba(0,212,255,.06)' } },
      y: { ticks: { color: TEXT }, grid: { color: 'rgba(0,212,255,.06)' } }
    }
  };

  // Top 20 classes bar chart
  const classEl = document.getElementById('gchart-classes');
  if (classEl) {
    charts.classes = new Chart(classEl, {
      type: 'bar',
      data: {
        labels: topClasses.map(([cls]) => cls || 'N/A'),
        datasets: [{ label: 'Molécules', data: topClasses.map(([, c]) => c), backgroundColor: TEAL + 'aa', borderColor: TEAL, borderWidth: 1 }]
      },
      options: { ...baseOpts, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: baseOpts.scales.x, y: { ticks: { color: TEXT, font: { size: 10 } }, grid: { color: 'rgba(0,212,255,.06)' } } } }
    });
  }

  // Phases pie chart
  const phaseEl = document.getElementById('gchart-phases');
  if (phaseEl) {
    const phaseLabels = Object.keys(byPhase).map(p => `Phase ${p}`);
    const phaseData = Object.values(byPhase);
    const phaseColors = [OK, TEAL, WARN, BAD, '#8b5cf6', '#ec4899'];
    charts.phases = new Chart(phaseEl, {
      type: 'doughnut',
      data: { labels: phaseLabels, datasets: [{ data: phaseData, backgroundColor: phaseColors.slice(0, phaseData.length), borderWidth: 2, borderColor: BG4 }] },
      options: { plugins: { legend: { position: 'right', labels: { color: TEXT, font: { size: 11 } } } }, cutout: '65%' }
    });
  }

  // Flags quality chart
  const flagEl = document.getElementById('gchart-flags');
  if (flagEl) {
    const flagLabels = Object.keys(byFlag);
    const flagData = Object.values(byFlag);
    const flagColors = flagLabels.map(f => f === 'DONNÉE RÉELLE' ? OK : f === 'DONNÉE MANQUANTE' ? BAD : WARN);
    charts.flags = new Chart(flagEl, {
      type: 'pie',
      data: { labels: flagLabels, datasets: [{ data: flagData, backgroundColor: flagColors.map(c => c + 'cc'), borderColor: flagColors, borderWidth: 2 }] },
      options: { plugins: { legend: { position: 'bottom', labels: { color: TEXT, font: { size: 11 } } } } }
    });
  }
}

function destroyCharts() {
  Object.values(charts).forEach(c => { try { c.destroy(); } catch {} });
  charts = {};
}
