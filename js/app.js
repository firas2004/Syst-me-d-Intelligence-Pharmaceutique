// ============================================================
// PHARMA-INTEL v3.0 — Main Application Controller
// ============================================================
import { t, setLanguage, toggleLanguage } from './i18n.js';
import { login, logout, restoreSession, getSession, isLoggedIn, canAccess, getAuditTrail, clearAuditTrail, getAllDepts, getDeptLabel, logAuditEntry } from './auth.js';
import { initDB, populateFromPubchem, isLoaded, getDrugInfo, getAllTables } from './database.js';
import { fetchPubchem, getPubchemImageUrl } from './api.js';
import { renderDashboard, initDashboard } from './dashboard.js';
import { renderRD, renderLogistique, renderReglementaire, renderQualite, renderProduction, renderFinance } from './reports.js';
import { predictDegradation, compareDrugs, detectConflicts, generateAlertFeed } from './ai.js';
import { exportExcel, exportPDF } from './exports.js';
import { sendMessage, saveApiKey, getApiKey, hasApiKey } from './assistant.js';
// v3.0 — New modules
import { openDB, findByName } from './indexeddb.js';
import { startCollection, stopCollection, setProgressCallback, setLogCallback, isRunning, resetCollection } from './collector.js';
import { renderExplorer } from './explorer.js';
import { renderGlobalDash } from './global-dash.js';

// ─── State ────────────────────────────────────────────────────
let currentPage = 'dashboard';
let chatHistory = [];

// ─── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initDB();
  initDashboard();
  setLanguage('fr');

  if (restoreSession()) {
    hideAuthModal();
    applyAccess();
    navigateTo('dashboard');
    renderDashboard();
  } else {
    showAuthModal();
  }

  bindEvents();
  populateDeptSelector();
});

// ─── Auth ─────────────────────────────────────────────────────
function showAuthModal() {
  document.getElementById('auth-modal').style.display = 'flex';
  document.getElementById('app-shell').style.display = 'none';
}
function hideAuthModal() {
  document.getElementById('auth-modal').style.display = 'none';
  document.getElementById('app-shell').style.display = 'flex';
}

function populateDeptSelector() {
  const sel = document.getElementById('auth-dept');
  getAllDepts().forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = getDeptLabel(d);
    sel.appendChild(opt);
  });
}

async function handleLogin() {
  const dept = document.getElementById('auth-dept').value;
  const pass = document.getElementById('auth-pass').value;
  const errEl = document.getElementById('auth-error');
  const btn = document.getElementById('auth-btn');

  if (!dept) { errEl.textContent = 'Sélectionnez un département'; errEl.style.display = 'block'; return; }

  btn.textContent = t('common.loading');
  btn.disabled = true;
  const result = await login(dept, pass);
  btn.textContent = t('auth.login');
  btn.disabled = false;

  if (!result.success) {
    errEl.textContent = t('auth.error');
    errEl.style.display = 'block';
    document.getElementById('auth-pass').value = '';
    return;
  }
  errEl.style.display = 'none';
  hideAuthModal();
  applyAccess();
  updateUserBadge();
  navigateTo('dashboard');
  renderDashboard();
  showToast(`${t('auth.session')} — ${getDeptLabel(dept)}`);
}

function applyAccess() {
  const session = getSession();
  if (!session) return;
  updateUserBadge();

  // Show/hide Finance tab (hidden from non-finance, non-admin)
  const financeNav = document.querySelector('[data-page="reports-finance"]');
  if (financeNav) {
    financeNav.style.display = (session.department === 'finance' || session.department === 'admin') ? 'flex' : 'none';
  }
  // AI nav — hide from finance and logistics
  const aiNav = document.querySelector('[data-page="ai"]');
  if (aiNav) {
    aiNav.style.display = canAccess('ai') ? 'flex' : 'none';
  }
}

function updateUserBadge() {
  const session = getSession();
  const badge = document.getElementById('user-badge');
  if (badge && session) {
    badge.textContent = `${session.label} · ${session.sessionId}`;
    badge.style.display = 'block';
  }
}

// ─── Navigation ───────────────────────────────────────────────
function navigateTo(page) {
  if (!isLoggedIn()) return;
  currentPage = page;

  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.style.display = 'flex';
  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');

  switch (page) {
    case 'dashboard': renderDashboard(); break;
    case 'reports': renderReports(); break;
    case 'reports-rd': renderReport('rd'); break;
    case 'reports-logistique': renderReport('logistique'); break;
    case 'reports-reglementaire': renderReport('reglementaire'); break;
    case 'reports-qualite': renderReport('qualite'); break;
    case 'reports-production': renderReport('production'); break;
    case 'reports-finance': renderReport('finance'); break;
    case 'database': renderDatabase(); break;
    case 'ai': renderAI(); break;
    case 'audit': renderAuditTrail(); break;
    // v3.0 new pages
    case 'collector': renderCollector(); break;
    case 'explorer': renderExplorer(); break;
    case 'global-dash': renderGlobalDash(); break;
  }
}

// ─── Drug Search — Hybrid: IndexedDB first, then PubChem live ─
async function searchDrug(slot) {
  const inputId = slot === 'drugA' ? 'search-a-input' : 'search-b-input';
  const statusId = slot === 'drugA' ? 'search-a-status' : 'search-b-status';
  const imgId = slot === 'drugA' ? 'struct-img-a' : 'struct-img-b';
  const query = document.getElementById(inputId)?.value?.trim();
  if (!query) return setStatus(statusId, t('search.no_query'), 'warn');

  setStatus(statusId, '🔍 Recherche en base locale...', 'loading');

  // 1️⃣ Try IndexedDB first (instant)
  try {
    await openDB();
    const localMol = await findByName(query);
    if (localMol && !String(localMol.pubchem_cid ?? '').startsWith('CHEMBL:')) {
      // Found in local DB — build data object compatible with existing system
      const data = {
        name: localMol.nom_inn ?? query,
        CID: localMol.pubchem_cid,
        iupacName: localMol.nom_iupac,
        molecularFormula: localMol.formule_moleculaire,
        molecularWeight: localMol.masse_moleculaire,
        smiles: localMol.smiles,
        xlogp: localMol.logp,
        tpsa: localMol.tpsa,
        hBondDonorCount: localMol.hbd,
        hBondAcceptorCount: localMol.hba,
        // Real data from ChEMBL/FDA
        mecanisme_action: localMol.mecanisme_action,
        temperature_stockage: localMol.temperature_stockage,
        conditions_stockage: localMol.conditions_stockage,
        classe_therapeutique: localMol.classe_therapeutique,
        has_fda_data: localMol.has_fda_data,
        source: 'BASE LOCALE (IndexedDB) — ' + (localMol.source_principale ?? 'ChEMBL+PubChem')
      };
      populateFromPubchem(slot, data);
      const sourceTag = localMol.has_fda_data ? '📋 BASE LOCALE + FDA' : '📦 BASE LOCALE';
      setStatus(statusId, `${sourceTag} — ${data.name} (CID: ${data.CID}) — Données ${localMol.flag}`, 'ok');
      updateDrugBadge(slot, data, 'local');
      if (currentPage === 'dashboard') renderDashboard();
      showToast(`${data.name} chargé depuis la base locale`);
      return;
    }
  } catch (e) { /* IndexedDB not ready, fall through */ }

  // 2️⃣ Fallback: PubChem live search
  setStatus(statusId, '🌐 Non trouvé en local — Recherche PubChem en temps réel...', 'loading');
  try {
    const data = await fetchPubchem(query);
    populateFromPubchem(slot, data);
    setStatus(statusId, `🔴 TEMPS RÉEL — ${data.name} (CID: ${data.CID}) — Source: PubChem (NIH)`, 'ok');
    updateDrugBadge(slot, data, 'live');
    if (currentPage === 'dashboard') renderDashboard();
    showToast(`${data.name} chargé depuis PubChem (temps réel)`);
  } catch (err) {
    const msg = err.message === 'NOT_FOUND' ? t('search.error') : `Erreur: ${err.message}`;
    setStatus(statusId, msg, 'error');
  }
}

function setStatus(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = `search-status status-${type}`;
}

function updateDrugBadge(slot, data, sourceType = 'live') {
  const id = slot === 'drugA' ? 'drug-a-badge' : 'drug-b-badge';
  const el = document.getElementById(id);
  const icon = sourceType === 'local' ? '📦' : '🔴';
  if (el) { el.textContent = `${icon} ${data.name} (CID: ${data.CID})`; el.className = 'drug-badge loaded'; }
  // Update structure image
  const imgId = slot === 'drugA' ? 'struct-img-a' : 'struct-img-b';
  const img = document.getElementById(imgId);
  if (img && data.CID && !String(data.CID).startsWith('CHEMBL')) { img.src = getPubchemImageUrl(data.CID); img.style.display = 'block'; }
}

// ─── Reports ─────────────────────────────────────────────────
function renderReports() {
  // Show report index with all department buttons
}

function renderReport(dept) {
  const container = document.getElementById(`page-reports-${dept}`)?.querySelector('.report-content');
  if (!container) return;
  const renderers = { rd: renderRD, logistique: renderLogistique, reglementaire: renderReglementaire, qualite: renderQualite, production: renderProduction, finance: renderFinance };
  if (renderers[dept]) container.innerHTML = renderers[dept]();
}

// ─── Database View ────────────────────────────────────────────
function renderDatabase() {
  const container = document.getElementById('db-content');
  if (!container) return;
  const loaded = isLoaded('drugA');
  if (!loaded) { container.innerHTML = `<div class="no-data">${t('common.no_data')}</div>`; return; }

  // Show current active table
  const activeTab = document.querySelector('.db-tab.active')?.dataset?.table ?? 'T1';
  renderDBTable(activeTab);
}

function renderDBTable(tableId) {
  const slot = document.getElementById('db-slot-toggle')?.dataset?.slot ?? 'drugA';
  const tables = getAllTables(slot);
  const container = document.getElementById('db-content');
  if (!tables || !container) return;

  const tbl = tables[tableId];
  if (!tbl) return;

  let html = `<div class="db-meta">
    <span class="db-tag">${tbl._meta?.tableName}</span>
    <span class="db-reliability">Fiabilité: ${tbl._meta?.reliability}%</span>
    <span class="db-source">Source: ${tbl._meta?.source}</span>
    <span class="data-flag ${tbl._meta?.flag === 'VERIFIED' ? 'flag-ok' : 'flag-sim'}">${tbl._meta?.flag === 'VERIFIED' ? '✓ VÉRIFIÉ' : '⚠ DONNÉES SIMULÉES'}</span>
    <span class="db-ts">${tbl._meta?.timestamp?.slice(0,19)}</span>
  </div>`;

  html += renderTableContent(tableId, tbl);
  container.innerHTML = html;
}

function renderTableContent(id, data) {
  if (id === 'T1') {
    const fields = ['inn','iupac','cas','formula','smiles','mw','logp','mechanism','bioavailability','halflife','therapeuticClass','cid'];
    return `<table class="data-table full-width"><tbody>${fields.map(f => `<tr><td>${f.toUpperCase()}</td><td>${data[f] ?? '—'}</td></tr>`).join('')}</tbody></table>`;
  }
  if (id === 'T2') {
    return `<table class="data-table full-width"><thead><tr><th>Condition</th><th>Résultat</th><th>Dosage</th><th>Durée de Vie</th><th>Emballage</th><th>ICH</th></tr></thead><tbody>${data.conditions.map(c=>`<tr><td>${c.condition}</td><td>${c.result}</td><td>${c.assay}%</td><td>${c.shelfLife}</td><td>${c.packaging}</td><td class="${c.compliant?'val-ok':'val-bad'}">${c.compliant?'✓':'✗'}</td></tr>`).join('')}</tbody></table>`;
  }
  if (id === 'T3') {
    return `<table class="data-table full-width"><thead><tr><th>Stress</th><th>Conditions</th><th>Taux%</th><th>Produits</th><th>Méthode</th><th>ICH</th></tr></thead><tbody>${data.stressTests.map(s=>`<tr><td>${s.type}</td><td>${s.conditions}</td><td class="${s.rate>15?'val-bad':s.rate>8?'val-warn':'val-ok'}">${s.rate}</td><td>${s.products}</td><td>${s.method}</td><td class="${s.ichCompliant?'val-ok':'val-bad'}">${s.ichCompliant?'✓':s.borderline?'⚠':'✗'}</td></tr>`).join('')}</tbody></table>`;
  }
  if (id === 'T4') {
    const pts = data.realTime?.timePoints ?? [];
    return `<table class="data-table full-width"><thead><tr><th>Point</th><th>Dosage%</th><th>Impuretés%</th><th>pH</th><th>Dissolution%</th><th>Statut</th></tr></thead><tbody>${pts.map(p=>`<tr><td>T${p.month}m</td><td class="${p.assay<90?'val-bad':p.assay<95?'val-warn':'val-ok'}">${p.assay}</td><td class="${p.impurities>1?'val-bad':p.impurities>0.5?'val-warn':'val-ok'}">${p.impurities}</td><td>${p.ph}</td><td class="${p.dissolution<85?'val-bad':'val-ok'}">${p.dissolution}</td><td>${p.assay>=90&&p.impurities<=1?'✓':'⚠ OOS'}</td></tr>`).join('')}</tbody></table>`;
  }
  if (id === 'T5') {
    return `<table class="data-table full-width"><thead><tr><th>Route</th><th>Rendement</th><th>Coût€/g</th><th>Étapes</th><th>Faisabilité</th></tr></thead><tbody>${data.routes.map(r=>`<tr><td>${r.name}</td><td>${r.yield}%</td><td>€${r.costPerGram}</td><td>${r.steps}</td><td>${r.feasibility}%</td></tr>`).join('')}</tbody></table>`;
  }
  if (id === 'T6') {
    return `<table class="data-table full-width"><tbody><tr><td>DL50</td><td>${data.ld50}</td></tr><tr><td>WHO</td><td>Cat. ${data.whoToxicityClass}</td></tr>${Object.entries(data.approvals).map(([k,v])=>`<tr><td>${k}</td><td>${v.status} — ${v.agency}</td></tr>`).join('')}${Object.entries(data.ichGuidelines).map(([k,v])=>`<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</tbody></table>`;
  }
  if (id === 'T7') {
    return `<table class="data-table full-width"><thead><tr><th>Excipient</th><th>Compat.</th><th>Interaction</th><th>Ratio</th></tr></thead><tbody>${data.excipients.map(e=>`<tr class="${e.caution?'row-warn':''}"><td>${e.name}</td><td class="${e.compatible?'val-ok':'val-bad'}">${e.compatible?'✓ OUI':'✗ NON'}</td><td>${e.interaction}</td><td>${e.ratio}</td></tr>`).join('')}</tbody></table>`;
  }
  return '<p>Données non disponibles</p>';
}

// ─── AI Panel ─────────────────────────────────────────────────
function renderAI() {
  // Comparator
  const compDiv = document.getElementById('ai-comparator-result');
  if (compDiv) {
    const cmp = compareDrugs();
    if (!cmp) { compDiv.innerHTML = `<div class="no-data">Chargez Drug A et Drug B pour la comparaison.</div>`; }
    else {
      compDiv.innerHTML = `
        <div class="compare-header">
          <div class="compare-score">Score Similarité: <strong>${cmp.similarityScore}%</strong></div>
          <div class="compare-reco">Recommandation: <strong class="teal">${cmp.recommendation}</strong></div>
        </div>
        <table class="data-table full-width">
          <thead><tr><th>Critère</th><th>${cmp.aInfo.name}</th><th>${cmp.bInfo.name}</th><th>Gagnant</th></tr></thead>
          <tbody>${cmp.categories.map(c=>`<tr>
            <td>${c.name}</td>
            <td class="${c.winner==='A'?'val-ok':''}">${c.scoreA} ${c.unit}</td>
            <td class="${c.winner==='B'?'val-ok':''}">${c.scoreB} ${c.unit}</td>
            <td class="${c.winner==='A'?'val-ok':c.winner==='B'?'val-bad':''}"><strong>${c.winner}</strong></td>
          </tr>`).join('')}</tbody>
        </table>`;
    }
  }
  // Conflicts
  const confDiv = document.getElementById('ai-conflicts-result');
  if (confDiv && isLoaded('drugA')) {
    const conflicts = detectConflicts('drugA');
    confDiv.innerHTML = conflicts.length === 0
      ? '<div class="no-conflict">✓ Aucun conflit détecté</div>'
      : conflicts.map(c=>`<div class="conflict-item severity-${c.severity.toLowerCase()}"><span class="conf-sev">${c.severity}</span><span>${c.desc}</span><span class="conf-tables">[${c.tables.join(', ')}]</span></div>`).join('');
  }
  // Alerts
  const alertDiv = document.getElementById('ai-alerts-result');
  if (alertDiv && isLoaded('drugA')) {
    const drug = getDrugInfo('drugA');
    const alerts = generateAlertFeed(drug?.name ?? 'molécule');
    alertDiv.innerHTML = alerts.map(a=>`<div class="alert-item alert-${a.severity.toLowerCase()}">
      <span class="alert-src">${a.source}</span><span class="alert-type">${a.type}</span>
      <span class="alert-title"><a href="${a.url}" target="_blank">${a.title}</a></span>
      <span class="alert-date">${a.date}</span>
    </div>`).join('');
  }
}

function runPrediction() {
  const temp = parseFloat(document.getElementById('pred-temp')?.value ?? 40);
  const rh = parseFloat(document.getElementById('pred-rh')?.value ?? 75);
  const months = parseFloat(document.getElementById('pred-months')?.value ?? 18);
  if (!isLoaded('drugA')) return;
  const result = predictDegradation(temp, rh, months);
  const div = document.getElementById('prediction-result');
  if (!div || !result) return;
  div.innerHTML = `
    <div class="pred-header" style="color:${result.riskColor}">Risque Global: ${result.overallRisk} (Max: ${result.maxProbability}%)</div>
    <div class="pred-grid">
      ${result.pathways.map(p=>`<div class="pred-item">
        <div class="pred-name">${p.name}</div>
        <div class="pred-bar-wrap"><div class="pred-bar" style="width:${p.probability}%;background:${p.probability>70?'#ef4444':p.probability>40?'#f59e0b':'#22c55e'}"></div></div>
        <div class="pred-vals">${p.probability}% <small>(confiance: ${p.confidence}%)</small></div>
      </div>`).join('')}
    </div>
    <div class="pred-note">⚠ Données SIMULÉES — ${t('flag.simulated')}</div>`;
}

// ─── Audit Trail ──────────────────────────────────────────────
function renderAuditTrail() {
  const tbody = document.getElementById('audit-tbody');
  if (!tbody) return;
  const trail = getAuditTrail();
  tbody.innerHTML = trail.length === 0
    ? '<tr><td colspan="6" class="no-data">Aucune entrée</td></tr>'
    : trail.map(e=>`<tr>
        <td class="audit-ts">${e.timestamp?.slice(0,19)??'—'}</td>
        <td><span class="dept-chip">${e.department??'—'}</span></td>
        <td>${e.user??'—'}</td>
        <td class="audit-action">${e.action??'—'}</td>
        <td class="${e.result?.includes('SUCCESS')?'val-ok':e.result?.includes('FAIL')?'val-bad':''}">${e.result??'—'}</td>
        <td class="audit-sid">${e.sessionId??'—'}</td>
      </tr>`).join('');
}

// ─── AI Assistant Chat ────────────────────────────────────────
async function sendChat() {
  const input = document.getElementById('chat-input');
  const msg = input?.value?.trim();
  if (!msg) return;
  if (!isLoaded('drugA')) { appendChat('system', t('assistant.no_molecule')); return; }
  if (!hasApiKey()) { appendChat('system', t('assistant.no_key')); return; }

  input.value = '';
  appendChat('user', msg);
  appendChat('thinking', t('assistant.thinking'));

  try {
    const response = await sendMessage(msg);
    removeThinking();
    appendChat('assistant', response);
  } catch (err) {
    removeThinking();
    appendChat('error', `Erreur API: ${err.message}`);
  }
}

function appendChat(role, text) {
  const box = document.getElementById('chat-messages');
  if (!box) return;
  const div = document.createElement('div');
  div.className = `chat-msg chat-${role}`;
  div.id = role === 'thinking' ? 'chat-thinking' : '';
  div.innerHTML = role === 'thinking'
    ? `<div class="thinking-dots"><span></span><span></span><span></span></div>`
    : `<div class="chat-bubble">${text.replace(/\n/g, '<br>')}</div>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function removeThinking() {
  document.getElementById('chat-thinking')?.remove();
}

// ─── Collector Page ───────────────────────────────────────────
function renderCollector() {
  const page = document.getElementById('page-collector');
  if (!page) return;
  page.innerHTML = `
    <div class="page-header">
      <h1>🚀 Collecte Automatique de Molécules</h1>
    </div>
    <div class="card">
      <h3>Options de collecte</h3>
      <div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:16px">
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
          <input type="radio" name="coll-mode" value="approved" checked id="coll-approved"/> Molécules approuvées seulement (max_phase=4) — ~13,000
        </label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
          <input type="radio" name="coll-mode" value="all" id="coll-all"/> Toutes les phases cliniques — ~50,000
        </label>
      </div>
      <div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;margin-bottom:16px">
        <div class="pred-field">
          <label>Limite (0 = illimitée)</label>
          <input id="coll-limit" type="number" value="500" min="0" style="width:100px"/>
        </div>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px">
          <input type="checkbox" id="coll-fda" checked/> Collecter labels OpenFDA (conditions stockage réelles)
        </label>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button id="coll-start" class="btn btn-primary">▶ Lancer la collecte</button>
        <button id="coll-pause" class="btn btn-secondary" disabled>⏸ Pause</button>
        <button id="coll-stop" class="btn btn-danger btn-sm" disabled>⏹ Arrêter</button>
        <button id="coll-reset" class="btn btn-secondary btn-sm" title="Efface seulement le verrou, garde les molécules déjà collectées">🔄 Nouveau batch</button>
        <button id="coll-reset-full" class="btn btn-danger btn-sm" title="Repart de offset 0 et efface l'état de collecte">🗑 Effacer + offset 0</button>
      </div>
    </div>
    <div class="card" id="coll-progress-card" style="display:none">
      <h3>Progression</h3>
      <div id="coll-phase-info" style="font-size:13px;color:var(--teal);margin-bottom:10px">—</div>
      <div style="height:12px;background:var(--bg4);border-radius:6px;overflow:hidden;margin-bottom:16px">
        <div id="coll-bar" style="height:100%;background:linear-gradient(90deg,var(--teal),#0099cc);border-radius:6px;transition:width .3s;width:0%"></div>
      </div>
      <div id="coll-stats" style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:16px;font-size:13px">
        <span>Collectées: <strong id="coll-collected" style="color:var(--teal)">0</strong></span>
        <span>Total: <strong id="coll-total" style="color:var(--text2)">?</strong></span>
        <span>Phase: <strong id="coll-phase-num" style="color:var(--ok)">—</strong></span>
      </div>
      <div id="coll-log" style="background:var(--bg4);border-radius:6px;padding:12px;height:240px;overflow-y:auto;font-family:monospace;font-size:11px;color:var(--text2)">
        <div style="color:var(--text3)">En attente de démarrage...</div>
      </div>
    </div>
    <div class="card" style="margin-top:0">
      <h3>ℹ️ À propos de la collecte</h3>
      <table class="data-table">
        <thead><tr><th>Phase</th><th>Source</th><th>Données collectées</th><th>Durée estimée</th></tr></thead>
        <tbody>
          <tr><td>1/3</td><td>ChEMBL (EMBL-EBI)</td><td>Nom INN, formule, LogP, classe thérapeutique, phase clinique</td><td>~30 secondes</td></tr>
          <tr><td>2/3</td><td>PubChem (NIH)</td><td>CID, IUPAC, SMILES, InChI, TPSA, HBD, HBA</td><td>~5 minutes</td></tr>
          <tr><td>3/3</td><td>OpenFDA (FDA)</td><td>Texte label FDA — conditions stockage RÉELLES</td><td>~5-15 minutes</td></tr>
          <tr style="color:var(--text3)"><td>À la demande</td><td>PubChem pug_view</td><td>Stabilité, décomposition, réactivité — depuis explorateur</td><td>~30s / molécule</td></tr>
        </tbody>
      </table>
    </div>
  `;

  // Bind collector events
  setProgressCallback(progress => updateCollectorProgress(progress));
  setLogCallback((msg, type) => appendCollectorLog(msg, type));

  document.getElementById('coll-start').onclick = async () => {
    const limit = parseInt(document.getElementById('coll-limit').value ?? '500');
    const maxPhase = document.getElementById('coll-all').checked ? 1 : 4;
    const collectFDA = document.getElementById('coll-fda').checked;
    document.getElementById('coll-progress-card').style.display = 'block';
    document.getElementById('coll-start').disabled = true;
    document.getElementById('coll-stop').disabled = false;
    document.getElementById('coll-pause').disabled = false;
    await startCollection({ maxPhase, limit: limit > 0 ? limit : null, collectFDA, resumeIfPossible: true });
    document.getElementById('coll-start').disabled = false;
    document.getElementById('coll-stop').disabled = true;
    document.getElementById('coll-pause').disabled = true;
    showToast('Collecte terminée — voir Explorateur');
  };
  document.getElementById('coll-stop').onclick = () => stopCollection();
  document.getElementById('coll-reset').onclick = async () => { await resetCollection(false); showToast('Prêt pour un nouveau batch — offset conservé'); };
  document.getElementById('coll-reset-full').onclick = async () => {
    if (confirm('Effacer l\'offset et repartir depuis le début (offset 0) ?')) {
      await resetCollection(true); showToast('Offset réinitialisé — prochaine collecte repart de 0');
    }
  };
}

function updateCollectorProgress(p) {
  const pct = p.done ? 100 : (p.total > 0 ? Math.round(p.collected / p.total * 100) : (p.progress ?? 0));
  const bar = document.getElementById('coll-bar');
  if (bar) bar.style.width = pct + '%';
  const phase = document.getElementById('coll-phase-info');
  if (phase) phase.textContent = `Phase ${p.phase}/${p.phaseTotal} — ${p.phaseName}`;
  const col = document.getElementById('coll-collected');
  if (col) col.textContent = (p.collected ?? 0).toLocaleString();
  const tot = document.getElementById('coll-total');
  if (tot) tot.textContent = (p.total ?? '?').toLocaleString();
  const pnum = document.getElementById('coll-phase-num');
  if (pnum) pnum.textContent = `${p.phase}/${p.phaseTotal}`;
}

function appendCollectorLog(msg, type = 'info') {
  const log = document.getElementById('coll-log');
  if (!log) return;
  const colors = { info: 'var(--text2)', ok: 'var(--ok)', warn: 'var(--warn)', error: 'var(--bad)' };
  const ts = new Date().toLocaleTimeString('fr-FR');
  const div = document.createElement('div');
  div.style.color = colors[type] ?? 'var(--text2)';
  div.textContent = `[${ts}] ${msg}`;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

// ─── Event Bindings ───────────────────────────────────────────
function bindEvents() {
  // Auth
  document.getElementById('auth-btn')?.addEventListener('click', handleLogin);
  document.getElementById('auth-pass')?.addEventListener('keypress', e => { if (e.key === 'Enter') handleLogin(); });
  document.getElementById('logout-btn')?.addEventListener('click', () => { logout(); showAuthModal(); });

  // Language
  document.getElementById('lang-toggle')?.addEventListener('click', toggleLanguage);

  // Navigation
  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.page));
  });

  // Search
  document.getElementById('search-a-btn')?.addEventListener('click', () => searchDrug('drugA'));
  document.getElementById('search-b-btn')?.addEventListener('click', () => searchDrug('drugB'));
  document.getElementById('search-a-input')?.addEventListener('keypress', e => { if(e.key==='Enter') searchDrug('drugA'); });
  document.getElementById('search-b-input')?.addEventListener('keypress', e => { if(e.key==='Enter') searchDrug('drugB'); });

  // DB tabs
  document.querySelectorAll('.db-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.db-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderDBTable(tab.dataset.table);
    });
  });

  // AI
  document.getElementById('run-prediction-btn')?.addEventListener('click', runPrediction);

  // Exports
  document.getElementById('export-excel-btn')?.addEventListener('click', exportExcel);
  document.getElementById('export-pdf-btn')?.addEventListener('click', exportPDF);
  document.getElementById('export-both-btn')?.addEventListener('click', async () => { exportExcel(); await exportPDF(); });

  // Assistant
  document.getElementById('chat-send-btn')?.addEventListener('click', sendChat);
  document.getElementById('chat-input')?.addEventListener('keypress', e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });
  document.getElementById('save-api-key-btn')?.addEventListener('click', () => {
    const key = document.getElementById('api-key-input')?.value?.trim();
    if (key) { const prov = saveApiKey(key); showToast(`Clé API ${prov} enregistrée`); document.getElementById('api-config-panel').style.display = 'none'; }
  });
  document.getElementById('config-api-btn')?.addEventListener('click', () => {
    const panel = document.getElementById('api-config-panel');
    if (panel) { panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; document.getElementById('api-key-input').value = getApiKey(); }
  });

  // Audit
  document.getElementById('audit-clear-btn')?.addEventListener('click', () => { clearAuditTrail(); renderAuditTrail(); });

  // Report department buttons
  ['rd', 'logistique', 'reglementaire', 'qualite', 'production', 'finance'].forEach(d => {
    document.getElementById(`open-report-${d}`)?.addEventListener('click', () => navigateTo(`reports-${d}`));
  });

  // Language change → re-render current page
  document.addEventListener('langChanged', () => navigateTo(currentPage));

  // v3.0 — Explorer integration events
  window.addEventListener('pharma:navigate', e => navigateTo(e.detail));
  window.addEventListener('pharma:load-molecule', async e => {
    const { molecule, which } = e.detail;
    const slot = which === 'A' ? 'drugA' : 'drugB';
    const inputId = which === 'A' ? 'search-a-input' : 'search-b-input';
    const inp = document.getElementById(inputId);
    if (inp) inp.value = molecule.nom_inn ?? '';
    populateFromPubchem(slot, {
      name: molecule.nom_inn ?? molecule.chembl_id,
      CID: molecule.pubchem_cid,
      iupacName: molecule.nom_iupac,
      molecularFormula: molecule.formule_moleculaire,
      molecularWeight: molecule.masse_moleculaire,
      smiles: molecule.smiles,
      xlogp: molecule.logp,
      tpsa: molecule.tpsa,
      mecanisme_action: molecule.mecanisme_action,
      temperature_stockage: molecule.temperature_stockage,
      classe_therapeutique: molecule.classe_therapeutique,
      source: 'BASE LOCALE (IndexedDB)'
    });
    updateDrugBadge(slot, { name: molecule.nom_inn, CID: molecule.pubchem_cid }, 'local');
    navigateTo('search');
    showToast(`${molecule.nom_inn} chargé comme Drug ${which}`);
  });
  window.addEventListener('pharma:export-explorer', e => {
    const { molecules } = e.detail;
    if (!molecules?.length) { showToast('Aucune molécule à exporter'); return; }
    // Build workbook from molecules array
    const ws = window.XLSX?.utils?.json_to_sheet(molecules.map(m => ({
      'Nom INN': m.nom_inn, 'CID PubChem': m.pubchem_cid, 'ChEMBL ID': m.chembl_id,
      'CAS': m.cas_number, 'Formule': m.formule_moleculaire, 'MW (g/mol)': m.masse_moleculaire,
      'LogP': m.logp, 'TPSA': m.tpsa, 'Phase Clinique': m.max_phase,
      'Classe Thérapeutique': m.classe_therapeutique, 'T° Stockage': m.temperature_stockage,
      'Conditions Stockage': m.conditions_stockage, 'Données FDA': m.has_fda_data ? 'OUI' : 'NON',
      'Source': m.source_principale, 'Score Fiabilité': m.score_fiabilite, 'Flag': m.flag,
      'Date Collecte': m.date_collecte
    })));
    if (ws) {
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Molécules');
      window.XLSX.writeFile(wb, `PHARMA-INTEL_Export_${new Date().toISOString().slice(0,10)}.xlsx`);
      showToast(`${molecules.length} molécules exportées`);
    }
  });
}

// ─── Toast ────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
