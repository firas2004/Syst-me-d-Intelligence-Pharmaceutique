// ============================================================
// PHARMA-INTEL v3.0 — Database Explorer
// Paginated table with filters + molecule detail view
// ============================================================
import { searchMolecules, countMolecules, getAllClasses, getStats, openDB, upsertMolecule, upsertStabilite } from './indexeddb.js';
import { fetchStabilityData } from './realapi.js';
import { logAuditEntry, getSession } from './auth.js';
import { renderFullProfile } from './profile.js';

let currentPage = 0;
const PAGE_SIZE = 50;
let currentFilters = { query: '', classe: '', phase: '', flag: '' };
let totalCount = 0;
let currentMolecule = null;

// ─── Render Explorer Page ─────────────────────────────────────
export async function renderExplorer() {
  await openDB();
  const container = document.getElementById('page-explorer');
  if (!container) return;

  const classes = await getAllClasses();
  const stats = await getStats();

  container.innerHTML = `
    <div class="page-header">
      <h1>🗄️ Explorateur de Base de Données</h1>
      <div class="actions">
        <span style="font-size:13px;color:var(--text2)">${stats.total.toLocaleString()} molécules en base</span>
        <button class="btn btn-secondary btn-sm" id="exp-export-btn">📊 Exporter sélection</button>
      </div>
    </div>
    <div class="card">
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:16px">
        <div style="flex:1;min-width:200px">
          <label class="exp-label">Recherche (nom, CAS, formule)</label>
          <input id="exp-search" class="search-input" placeholder="Aspirin, C9H8O4, 50-78-2..." style="width:100%"/>
        </div>
        <div>
          <label class="exp-label">Classe thérapeutique</label>
          <select id="exp-class" class="search-input">
            <option value="">Toutes</option>
            ${classes.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="exp-label">Phase clinique</label>
          <select id="exp-phase" class="search-input">
            <option value="">Toutes</option>
            <option value="4">4 — Approuvé</option>
            <option value="3">3 — Phase III</option>
            <option value="2">2 — Phase II</option>
            <option value="1">1 — Phase I</option>
          </select>
        </div>
        <div>
          <label class="exp-label">Données</label>
          <select id="exp-flag" class="search-input">
            <option value="">Tous</option>
            <option value="DONNÉE RÉELLE">✓ Données réelles</option>
            <option value="DONNÉE MANQUANTE">⚠ Manquantes</option>
          </select>
        </div>
        <button class="btn btn-primary btn-sm" id="exp-filter-btn">Filtrer</button>
        <button class="btn btn-secondary btn-sm" id="exp-reset-btn">Reset</button>
      </div>
      <div id="exp-table-wrap" style="overflow-x:auto">
        <div class="no-data">Chargement...</div>
      </div>
      <div id="exp-pagination" style="display:flex;align-items:center;gap:12px;margin-top:14px;flex-wrap:wrap"></div>
    </div>
    <div id="exp-detail-panel" style="display:none"></div>
  `;

  // Events
  document.getElementById('exp-filter-btn').onclick = () => applyFilters();
  document.getElementById('exp-reset-btn').onclick = () => resetFilters();
  document.getElementById('exp-export-btn').onclick = () => exportSelection();
  document.getElementById('exp-search').onkeydown = e => { if (e.key === 'Enter') applyFilters(); };

  await loadPage(0);
}

async function applyFilters() {
  currentFilters = {
    query: document.getElementById('exp-search')?.value ?? '',
    classe: document.getElementById('exp-class')?.value ?? '',
    phase: document.getElementById('exp-phase')?.value ?? '',
    flag: document.getElementById('exp-flag')?.value ?? ''
  };
  await loadPage(0);
}

async function resetFilters() {
  currentFilters = { query: '', classe: '', phase: '', flag: '' };
  document.getElementById('exp-search').value = '';
  document.getElementById('exp-class').value = '';
  document.getElementById('exp-phase').value = '';
  document.getElementById('exp-flag').value = '';
  await loadPage(0);
}

async function loadPage(page) {
  currentPage = page;
  const wrap = document.getElementById('exp-table-wrap');
  if (wrap) wrap.innerHTML = '<div class="no-data" style="color:var(--text3)">⏳ Chargement...</div>';

  const molecules = await searchMolecules({ ...currentFilters, page, limit: PAGE_SIZE });
  totalCount = await countMolecules(currentFilters);

  if (wrap) wrap.innerHTML = buildTable(molecules);
  renderPagination();

  // Attach row click
  document.querySelectorAll('.exp-row').forEach(row => {
    row.onclick = () => showDetail(row.dataset.cid);
  });
}

function flagBadge(flag) {
  if (!flag) return '<span class="data-flag flag-miss">INCONNUE</span>';
  if (flag === 'DONNÉE RÉELLE') return '<span class="data-flag flag-ok">✓ RÉELLE</span>';
  if (flag === 'DONNÉE MANQUANTE') return '<span class="data-flag flag-miss">⚠ MANQUANTE</span>';
  return `<span class="data-flag flag-sim">${flag}</span>`;
}

function phaseBadge(p) {
  const colors = { 4: 'var(--ok)', 3: 'var(--teal)', 2: 'var(--warn)', 1: 'var(--text3)' };
  const color = colors[p] ?? 'var(--text3)';
  return `<span style="color:${color};font-weight:700">Phase ${p ?? '?'}</span>`;
}

function buildTable(molecules) {
  if (!molecules.length) return '<div class="no-data">Aucune molécule trouvée. Lancez d\'abord la collecte automatique.</div>';
  return `
    <table class="data-table full-width">
      <thead><tr>
        <th>Nom INN</th><th>Formule</th><th>MW</th><th>CID</th>
        <th>ChEMBL</th><th>Phase</th><th>Classe</th><th>T° Stockage</th>
        <th>FDA Data</th><th>Données</th>
      </tr></thead>
      <tbody>
        ${molecules.map(m => `
          <tr class="exp-row" data-cid="${m.pubchem_cid}" style="cursor:pointer">
            <td style="font-weight:600;color:var(--teal)">${m.nom_inn ?? '—'}</td>
            <td style="font-family:monospace;font-size:11px">${m.formule_moleculaire ?? '—'}</td>
            <td>${m.masse_moleculaire ?? '—'}</td>
            <td style="font-family:monospace;font-size:11px">${String(m.pubchem_cid ?? '').startsWith('CHEMBL') ? '<span style="color:var(--text3)">non matchéé</span>' : (m.pubchem_cid ?? '—')}</td>
            <td style="font-family:monospace;font-size:11px;color:var(--teal2)">${m.chembl_id ?? '—'}</td>
            <td>${phaseBadge(m.max_phase)}</td>
            <td style="font-size:11px;color:var(--text2)">${m.classe_therapeutique ?? '—'}</td>
            <td style="font-size:11px">${m.temperature_stockage ?? '<span style="color:var(--text3)">—</span>'}</td>
            <td>${m.has_fda_data ? '<span class="data-flag flag-ok">✓ FDA</span>' : '<span class="data-flag flag-miss">—</span>'}</td>
            <td>${flagBadge(m.flag)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderPagination() {
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const el = document.getElementById('exp-pagination');
  if (!el) return;
  el.innerHTML = `
    <span style="font-size:12px;color:var(--text2)">${totalCount.toLocaleString()} résultats — Page ${currentPage + 1} / ${totalPages || 1}</span>
    <button class="btn btn-secondary btn-sm" id="exp-prev" ${currentPage === 0 ? 'disabled' : ''}>← Préc.</button>
    <button class="btn btn-secondary btn-sm" id="exp-next" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>Suiv. →</button>
  `;
  document.getElementById('exp-prev')?.addEventListener('click', () => loadPage(currentPage - 1));
  document.getElementById('exp-next')?.addEventListener('click', () => loadPage(currentPage + 1));
}

async function showDetail(cid) {
  const db = await openDB();
  const mol = await new Promise(r => {
    const req = db.transaction(['molecules']).objectStore('molecules').get(cid);
    req.onsuccess = e => r(e.target.result);
    req.onerror = () => r(null);
  });
  if (!mol) return;
  currentMolecule = mol;
  const panel = document.getElementById('exp-detail-panel');
  if (!panel) return;

  const { tabNav, panels } = renderFullProfile(mol);
  const hasCID = mol.pubchem_cid && !String(mol.pubchem_cid).startsWith('CHEMBL');

  panel.style.display = 'block';
  panel.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3>🔬 ${mol.nom_inn ?? mol.chembl_id} — Profil Pharmaceutique Complet</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${hasCID?`<button class="btn btn-secondary btn-sm" id="fetch-pugview-btn">🔄 Stabilité pug_view (réelle)</button>`:''}
          <button class="btn btn-primary btn-sm" id="detail-load-drug-a">📥 Drug A</button>
          <button class="btn btn-secondary btn-sm" id="detail-load-drug-b">📥 Drug B</button>
          <button class="btn btn-secondary btn-sm" id="close-detail-btn">✕</button>
        </div>
      </div>

      <!-- Identity strip -->
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px">
        <div class="kpi-card" style="padding:8px">
          <div class="kpi-label">Formule</div>
          <div style="font-family:monospace;font-size:13px;font-weight:700;color:var(--teal)">${mol.formule_moleculaire??'—'}</div>
        </div>
        <div class="kpi-card" style="padding:8px">
          <div class="kpi-label">MW (g/mol)</div>
          <div style="font-size:16px;font-weight:700;color:var(--teal)">${mol.masse_moleculaire??'—'}</div>
        </div>
        <div class="kpi-card" style="padding:8px">
          <div class="kpi-label">LogP</div>
          <div style="font-size:16px;font-weight:700;color:var(--teal)">${mol.logp??'—'}</div>
        </div>
        <div class="kpi-card" style="padding:8px">
          <div class="kpi-label">T° Stockage</div>
          <div style="font-size:13px;font-weight:700;color:${mol.temperature_stockage?'var(--ok)':'var(--warn)'}">
            ${mol.temperature_stockage??'⚠ Non collectée'}
          </div>
        </div>
        <div class="kpi-card" style="padding:8px">
          <div class="kpi-label">Phase Clinique</div>
          <div style="font-size:16px;font-weight:700;color:${mol.max_phase>=4?'var(--ok)':'var(--warn)'}">${mol.max_phase>=4?'✓ Approuvé':'Phase '+mol.max_phase}</div>
        </div>
      </div>

      <!-- Sources strip -->
      <div style="margin-bottom:12px;font-size:11px;color:var(--text2);display:flex;gap:12px;flex-wrap:wrap">
        <span>CID: <a href="${mol.pubchem_url??'#'}" target="_blank" class="src-link">${mol.pubchem_cid??'—'}</a></span>
        <span>ChEMBL: <a href="https://www.ebi.ac.uk/chembl/compound_report_card/${mol.chembl_id}" target="_blank" class="src-link">${mol.chembl_id??'—'}</a></span>
        <span>CAS: <code style="font-size:10px">${mol.cas_number??'—'}</code></span>
        <span>Classe: <strong>${mol.classe_therapeutique??'—'}</strong></span>
        <span>Source: <span style="color:var(--ok)">${mol.source_principale??'—'}</span></span>
        ${mol.has_fda_data?'<span class="data-flag flag-ok">✓ Label FDA officiel</span>':'<span class="data-flag flag-miss">Sans label FDA</span>'}
      </div>

      ${mol.storage_text_fda?`<div style="margin-bottom:12px;padding:8px 12px;background:rgba(34,197,94,.06);border-left:3px solid var(--ok);border-radius:4px;font-size:11px;color:var(--text2)"><strong style="color:var(--ok)">📋 FDA :</strong> ${mol.storage_text_fda}</div>`:''}

      <!-- 7-table tabs -->
      <div class="db-tabs" style="margin-bottom:0">${tabNav}</div>
      <div id="prof-panel" style="margin-top:0">${panels.stab}</div>
      <div id="pugview-section"></div>
    </div>
  `;

  // Tab switching
  panel.querySelectorAll('[data-prof-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      panel.querySelectorAll('[data-prof-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const key = btn.dataset.profTab;
      document.getElementById('prof-panel').innerHTML = panels[key] ?? '';
    });
  });

  document.getElementById('close-detail-btn').onclick = () => { panel.style.display = 'none'; };
  document.getElementById('detail-load-drug-a')?.addEventListener('click', () => loadFromExplorer(mol, 'A'));
  document.getElementById('detail-load-drug-b')?.addEventListener('click', () => loadFromExplorer(mol, 'B'));
  document.getElementById('fetch-pugview-btn')?.addEventListener('click', () => loadStabilityOnDemand(mol));

  panel.scrollIntoView({ behavior: 'smooth' });
}

async function loadStabilityOnDemand(mol) {
  const sec = document.getElementById('pugview-section');
  if (!sec) return;
  sec.innerHTML = '<div style="color:var(--warn);font-size:12px;margin-top:12px">⏳ Chargement pug_view (30-60s)...</div>';
  const btn = document.getElementById('fetch-pugview-btn');
  if (btn) btn.disabled = true;

  const data = await fetchStabilityData(mol.pubchem_cid);
  let html = '<div style="margin-top:12px"><table class="data-table full-width"><thead><tr><th colspan="3" style="background:var(--bg0)">Stabilité Réelle — PubChem pug_view</th></tr><tr><th>Section</th><th>Données</th><th>Flag</th></tr></thead><tbody>';
  for (const [key, val] of Object.entries(data)) {
    const label = key.replace(/_/g, ' ');
    if (val.flag === 'DONNÉE RÉELLE') {
      html += `<tr><td style="font-size:11px;color:var(--text2)">${label}</td><td style="font-size:11px">${val.text}</td><td><span class="data-flag flag-ok">✓ RÉELLE</span></td></tr>`;
    } else {
      html += `<tr><td style="font-size:11px;color:var(--text3)">${label}</td><td>—</td><td><span class="data-flag flag-miss">⚠ MANQUANTE</span></td></tr>`;
    }
  }
  html += '</tbody></table></div>';
  sec.innerHTML = html;

  await upsertStabilite({ molecule_cid: mol.pubchem_cid, ...data, date_extraction: new Date().toISOString() });
  await upsertMolecule({ ...mol, has_stability_data: true });

  logAuditEntry({
    user: getSession()?.label ?? '?', department: getSession()?.department ?? '?',
    sessionId: getSession()?.sessionId ?? 'N/A',
    action: `STABILITY_FETCH pug_view — ${mol.nom_inn} (CID: ${mol.pubchem_cid})`,
    result: 'SUCCESS', timestamp: new Date().toISOString()
  });
}

function loadFromExplorer(mol, which) {
  // Dispatch custom event for app.js to handle
  window.dispatchEvent(new CustomEvent('pharma:load-molecule', { detail: { molecule: mol, which } }));
}

async function exportSelection() {
  const molecules = await searchMolecules({ ...currentFilters, page: 0, limit: 9999 });
  window.dispatchEvent(new CustomEvent('pharma:export-explorer', { detail: { molecules } }));
}
