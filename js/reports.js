// ============================================================
// PHARMA-INTEL — Department Reports Module
// ============================================================
import { getAllTables, getDrugInfo, isLoaded } from './database.js';
import { t } from './i18n.js';

function flag(type) {
  const classes = { VERIFIED: 'flag-ok', SIMULATED: 'flag-sim', MISSING: 'flag-miss', CONFLICT: 'flag-conflict' };
  const labels = { VERIFIED: t('flag.verified'), SIMULATED: t('flag.simulated'), MISSING: t('flag.missing'), CONFLICT: t('flag.conflict') };
  return `<span class="data-flag ${classes[type] ?? 'flag-sim'}">${labels[type] ?? type}</span>`;
}

function simNote() {
  return `<div class="sim-warning">⚠ ${t('flag.simulated')}</div>`;
}

// ─── R&D Report ───────────────────────────────────────────────
export function renderRD() {
  const tables = getAllTables('drugA');
  const info = getDrugInfo('drugA');
  if (!tables || !info) return `<div class="no-data">${t('common.no_data')}</div>`;
  const t1 = tables.T1, t3 = tables.T3, t5 = tables.T5;

  return `
  <div class="report-section">
    <h2 class="report-title">${t('rep.rd_title')} — ${info.name}</h2>
    ${simNote()}
    <div class="card-grid">
      <div class="info-card">
        <h3>${t('table.t1')}</h3>
        <table class="data-table"><tbody>
          <tr><td>${t('mol.iupac')}</td><td>${t1.iupac}</td><td>${flag('VERIFIED')}</td></tr>
          <tr><td>${t('mol.formula')}</td><td>${t1.formula}</td><td>${flag('VERIFIED')}</td></tr>
          <tr><td>${t('mol.mw')}</td><td>${t1.mw} g/mol</td><td>${flag('VERIFIED')}</td></tr>
          <tr><td>${t('mol.logp')}</td><td>${t1.logp}</td><td>${flag('VERIFIED')}</td></tr>
          <tr><td>${t('mol.mechanism')}</td><td>${t1.mechanism}</td><td>${flag('SIMULATED')}</td></tr>
          <tr><td>${t('mol.bioavailability')}</td><td>${t1.bioavailability}%</td><td>${flag('SIMULATED')}</td></tr>
          <tr><td>${t('mol.halflife')}</td><td>${t1.halflife}</td><td>${flag('SIMULATED')}</td></tr>
          <tr><td>${t('mol.cid')}</td><td><a href="https://pubchem.ncbi.nlm.nih.gov/compound/${t1.cid}" target="_blank" class="src-link">CID ${t1.cid}</a></td><td>${flag('VERIFIED')}</td></tr>
        </tbody></table>
      </div>
      <div class="info-card">
        <h3>${t('table.t3')} — Scorecard</h3>
        <div class="scorecard-grid">
          ${t3.stressTests.map(s => `
            <div class="score-item ${s.ichCompliant ? 'score-ok' : s.borderline ? 'score-warn' : 'score-bad'}">
              <span class="score-label">${s.type}</span>
              <span class="score-val">${s.rate}%</span>
              <span class="score-ich">${s.ichCompliant ? '✓ ICH' : s.borderline ? '⚠ Limite' : '✗ NC'}</span>
            </div>`).join('')}
        </div>
        ${simNote()}
      </div>
    </div>
    <div class="info-card mt-4">
      <h3>${t('table.t5')}</h3>
      <table class="data-table">
        <thead><tr><th>Route</th><th>Rendement</th><th>Coût €/g</th><th>Faisabilité</th><th>Notes</th></tr></thead>
        <tbody>
          ${t5.routes.map(r => `<tr>
            <td>${r.name}</td><td>${r.yield}%</td><td>€${r.costPerGram}</td>
            <td><div class="progress-bar"><div style="width:${r.feasibility}%"></div></div>${r.feasibility}%</td>
            <td class="notes-cell">${r.notes}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      ${simNote()}
    </div>
  </div>`;
}

// ─── Logistics Report ─────────────────────────────────────────
export function renderLogistique() {
  const tables = getAllTables('drugA');
  const info = getDrugInfo('drugA');
  if (!tables || !info) return `<div class="no-data">${t('common.no_data')}</div>`;
  const t2 = tables.T2;

  return `
  <div class="report-section">
    <h2 class="report-title">${t('rep.log_title')} — ${info.name}</h2>
    ${simNote()}
    <div class="card-grid">
      ${t2.conditions.map(c => `
        <div class="condition-card ${c.compliant ? 'cond-ok' : 'cond-bad'}">
          <div class="cond-header">${c.condition}</div>
          <div class="cond-body">
            <div class="cond-row"><span>Résultat:</span><strong>${c.result}</strong></div>
            <div class="cond-row"><span>Dosage:</span><strong>${c.assay}%</strong></div>
            <div class="cond-row"><span>Durée de vie:</span><strong>${c.shelfLife}</strong></div>
            <div class="cond-row"><span>Emballage:</span><span>${c.packaging}</span></div>
            <div class="cond-row"><span>Zone ICH:</span><span>${c.ichZone}</span></div>
            <div class="cond-badge ${c.compliant ? 'badge-ok' : 'badge-bad'}">${c.compliant ? '✓ Conforme ICH' : '✗ Non Conforme'}</div>
          </div>
        </div>`).join('')}
    </div>
    <div class="info-card mt-4">
      <h3>Transport & ERP/SAP</h3>
      <table class="data-table"><tbody>
        <tr><td>Condition recommandée</td><td>25°C / 60%RH — Éviter chaleur et humidité</td></tr>
        <tr><td>Emballage transport</td><td>${t2.conditions[0]?.packaging ?? '—'}</td></tr>
        <tr><td>Durée de vie optimale</td><td>${t2.conditions[0]?.shelfLife ?? '—'}</td></tr>
        <tr><td>Code ERP/SAP</td><td>STOR-${info.name.toUpperCase().slice(0,6)}-A1 ${flag('SIMULATED')}</td></tr>
      </tbody></table>
    </div>
  </div>`;
}

// ─── Regulatory Report ────────────────────────────────────────
export function renderReglementaire() {
  const tables = getAllTables('drugA');
  const info = getDrugInfo('drugA');
  if (!tables || !info) return `<div class="no-data">${t('common.no_data')}</div>`;
  const t6 = tables.T6;

  const countries = [
    { key: 'TN', label: 'Tunisie 🇹🇳', ...t6.approvals.TN },
    { key: 'FR', label: 'France 🇫🇷', ...t6.approvals.FR },
    { key: 'IT', label: 'Italie 🇮🇹', ...t6.approvals.IT },
    { key: 'USA', label: 'États-Unis 🇺🇸', ...t6.approvals.USA }
  ];

  return `
  <div class="report-section">
    <h2 class="report-title">${t('rep.reg_title')} — ${info.name}</h2>
    ${simNote()}
    <div class="card-grid">
      <div class="info-card">
        <h3>Pays Approuvés</h3>
        ${countries.map(c => `
          <div class="country-row">
            <span class="country-name">${c.label}</span>
            <span class="country-status status-pending">${c.status}</span>
            <span class="country-agency">${c.agency}</span>
            <span class="country-ctd">${c.ctdModule}</span>
            ${flag('SIMULATED')}
          </div>`).join('')}
      </div>
      <div class="info-card">
        <h3>ICH Guidelines</h3>
        ${Object.entries(t6.ichGuidelines).map(([k, v]) => `
          <div class="ich-row">
            <span class="ich-key">${k}</span>
            <span class="ich-val">${v}</span>
          </div>`).join('')}
      </div>
    </div>
    <div class="info-card mt-4">
      <h3>Sécurité & Toxicologie</h3>
      <table class="data-table"><tbody>
        <tr><td>DL50</td><td>${t6.ld50}</td><td>${flag('SIMULATED')}</td></tr>
        <tr><td>Classe WHO</td><td>Catégorie ${t6.whoToxicityClass}</td><td>${flag('SIMULATED')}</td></tr>
        <tr><td>Mentions GHS</td><td>${t6.ghsHazards.join(', ')}</td><td>${flag('SIMULATED')}</td></tr>
        <tr><td>CTD Module 3</td><td>${t6.ctdModule3Status}</td><td>${flag('SIMULATED')}</td></tr>
      </tbody></table>
    </div>
  </div>`;
}

// ─── Quality Report ───────────────────────────────────────────
export function renderQualite() {
  const tables = getAllTables('drugA');
  const info = getDrugInfo('drugA');
  if (!tables || !info) return `<div class="no-data">${t('common.no_data')}</div>`;
  const t3 = tables.T3, t4 = tables.T4;

  return `
  <div class="report-section">
    <h2 class="report-title">${t('rep.qual_title')} — ${info.name}</h2>
    ${simNote()}
    <div class="info-card">
      <h3>Méthodes Analytiques & Critères d'Acceptation</h3>
      <table class="data-table">
        <thead><tr><th>Type Stress</th><th>Méthode</th><th>Produits</th><th>Taux</th><th>Seuil OOS</th><th>ICH</th></tr></thead>
        <tbody>
          ${t3.stressTests.map(s => `<tr>
            <td>${s.type}</td><td>${s.method}</td><td>${s.products}</td>
            <td class="${s.rate > 15 ? 'val-bad' : s.rate > 8 ? 'val-warn' : 'val-ok'}">${s.rate}%</td>
            <td>${s.rate > 15 ? '⚠ OOS' : s.rate > 8 ? '⚠ Limite' : '✓ Conforme'}</td>
            <td class="${s.ichCompliant ? 'val-ok' : 'val-bad'}">${s.ichCompliant ? '✓ ICH Q1A' : '✗ NC'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="info-card mt-4">
      <h3>Spécifications Libération — Étude Vieillissement (T0→T24)</h3>
      <table class="data-table">
        <thead><tr><th>Point</th><th>Dosage (%)</th><th>Impuretés (%)</th><th>pH</th><th>Dissolution (%)</th><th>Statut</th></tr></thead>
        <tbody>
          ${t4.realTime.timePoints.map(p => `<tr>
            <td>T${p.month}m</td>
            <td class="${p.assay < 90 ? 'val-bad' : p.assay < 95 ? 'val-warn' : 'val-ok'}">${p.assay}</td>
            <td class="${p.impurities > 1.0 ? 'val-bad' : p.impurities > 0.5 ? 'val-warn' : 'val-ok'}">${p.impurities}</td>
            <td>${p.ph}</td>
            <td class="${p.dissolution < 85 ? 'val-bad' : 'val-ok'}">${p.dissolution}</td>
            <td>${p.assay >= 90 && p.impurities <= 1.0 ? '✓' : '✗ OOS'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      ${simNote()}
    </div>
  </div>`;
}

// ─── Production Report ────────────────────────────────────────
export function renderProduction() {
  const tables = getAllTables('drugA');
  const info = getDrugInfo('drugA');
  if (!tables || !info) return `<div class="no-data">${t('common.no_data')}</div>`;
  const t7 = tables.T7;

  return `
  <div class="report-section">
    <h2 class="report-title">${t('rep.prod_title')} — ${info.name}</h2>
    ${simNote()}
    <div class="info-card">
      <h3>Compatibilité Excipients</h3>
      <table class="data-table">
        <thead><tr><th>Excipient</th><th>Compatibilité</th><th>Interaction</th><th>Ratio</th></tr></thead>
        <tbody>
          ${t7.excipients.map(e => `<tr class="${e.caution ? 'row-warn' : ''}">
            <td>${e.name}</td>
            <td class="${e.compatible ? 'val-ok' : 'val-bad'}">${e.compatible ? '✓ Compatible' : '✗ Incompatible'}</td>
            <td>${e.interaction}${e.caution ? ' <span class="badge-warn">⚠ CAUTION</span>' : ''}</td>
            <td>${e.ratio}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      ${simNote()}
    </div>
    <div class="info-card mt-4">
      <h3>Paramètres Critiques de Procédé (CPP)</h3>
      <table class="data-table"><tbody>
        <tr><td>Température fabrication</td><td>≤ 25°C recommandé</td><td>${flag('SIMULATED')}</td></tr>
        <tr><td>Humidité relative salle</td><td>≤ 50%RH</td><td>${flag('SIMULATED')}</td></tr>
        <tr><td>Protection lumière</td><td>Éclairage jaune/sodium requis</td><td>${flag('SIMULATED')}</td></tr>
        <tr><td>Temps mélange max</td><td>15 min (au-delà : dégradation mécanique)</td><td>${flag('SIMULATED')}</td></tr>
      </tbody></table>
    </div>
  </div>`;
}

// ─── Finance Report ───────────────────────────────────────────
export function renderFinance() {
  const tablesA = getAllTables('drugA');
  const tablesB = getAllTables('drugB');
  const infoA = getDrugInfo('drugA');
  if (!tablesA || !infoA) return `<div class="no-data">${t('common.no_data')}</div>`;
  const t5A = tablesA.T5;
  const t5B = tablesB?.T5;

  return `
  <div class="report-section">
    <h2 class="report-title">${t('rep.fin_title')}</h2>
    ${simNote()}
    <div class="info-card">
      <h3>Analyse Coûts — ${infoA.name}${t5B ? ` vs ${getDrugInfo('drugB').name}` : ''}</h3>
      <table class="data-table">
        <thead><tr><th>Route</th><th>Rendement</th><th>Coût €/g</th><th>Étapes</th><th>Faisabilité</th>${t5B ? '<th>ROI vs Drug B</th>' : ''}</tr></thead>
        <tbody>
          ${t5A.routes.map((r, i) => {
            const bRoute = t5B?.routes?.[i];
            const roi = bRoute ? ((bRoute.costPerGram - r.costPerGram) / bRoute.costPerGram * 100).toFixed(1) : null;
            return `<tr>
              <td>${r.name}</td><td>${r.yield}%</td><td class="val-ok">€${r.costPerGram}</td>
              <td>${r.steps}</td><td>${r.feasibility}%</td>
              ${t5B ? `<td class="${roi > 0 ? 'val-ok' : 'val-bad'}">${roi}%</td>` : ''}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      ${simNote()}
    </div>
    <div class="info-card mt-4">
      <h3>Recommandation Fournisseurs GMP</h3>
      <table class="data-table">
        <thead><tr><th>Fournisseur</th><th>Certification</th><th>Prix estimé</th><th>Délai</th><th>Score</th></tr></thead>
        <tbody>
          <tr><td>Fournisseur Alpha GMP</td><td>GMP EU + FDA</td><td>€${(t5A.routes[0].costPerGram * 1.1).toFixed(2)}/g</td><td>6-8 semaines</td><td>⭐⭐⭐⭐⭐</td></tr>
          <tr><td>Fournisseur Beta API</td><td>GMP EU</td><td>€${(t5A.routes[0].costPerGram * 0.9).toFixed(2)}/g</td><td>8-10 semaines</td><td>⭐⭐⭐⭐</td></tr>
          <tr><td>Fournisseur Gamma Pharma</td><td>GMP WHO</td><td>€${(t5A.routes[0].costPerGram * 0.75).toFixed(2)}/g</td><td>10-12 semaines</td><td>⭐⭐⭐</td></tr>
        </tbody>
      </table>
      ${simNote()}
    </div>
  </div>`;
}
