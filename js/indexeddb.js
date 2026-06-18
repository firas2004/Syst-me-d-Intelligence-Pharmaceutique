// ============================================================
// PHARMA-INTEL v3.0 — IndexedDB Layer
// ============================================================

const DB_NAME = 'pharma_intel_v3';
const DB_VERSION = 1;

let _db = null;

export async function openDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      // molecules store
      if (!db.objectStoreNames.contains('molecules')) {
        const mol = db.createObjectStore('molecules', { keyPath: 'pubchem_cid' });
        mol.createIndex('chembl_id', 'chembl_id', { unique: false });
        mol.createIndex('nom_inn', 'nom_inn', { unique: false });
        mol.createIndex('classe_therapeutique', 'classe_therapeutique', { unique: false });
        mol.createIndex('max_phase', 'max_phase', { unique: false });
        mol.createIndex('flag', 'flag', { unique: false });
      }
      // stabilite store
      if (!db.objectStoreNames.contains('stabilite')) {
        const st = db.createObjectStore('stabilite', { keyPath: 'molecule_cid' });
        st.createIndex('flag', 'flag', { unique: false });
      }
      // degradation store
      if (!db.objectStoreNames.contains('degradation')) {
        const dg = db.createObjectStore('degradation', { keyPath: 'molecule_cid' });
      }
      // vieillissement store
      if (!db.objectStoreNames.contains('vieillissement')) {
        db.createObjectStore('vieillissement', { keyPath: 'molecule_cid' });
      }
      // reglementaire store
      if (!db.objectStoreNames.contains('reglementaire')) {
        db.createObjectStore('reglementaire', { keyPath: 'molecule_cid' });
      }
      // collection_state store
      if (!db.objectStoreNames.contains('collection_state')) {
        db.createObjectStore('collection_state', { keyPath: 'id' });
      }
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror = e => reject(e.target.error);
  });
}

function tx(storeName, mode = 'readonly') {
  return _db.transaction([storeName], mode).objectStore(storeName);
}

function promisify(req) {
  return new Promise((res, rej) => { req.onsuccess = e => res(e.target.result); req.onerror = e => rej(e.target.error); });
}

// ─── Molecules ────────────────────────────────────────────────
export async function upsertMolecule(data) {
  const db = await openDB();
  return promisify(tx('molecules', 'readwrite').put(data));
}

export async function getMolecule(cid) {
  const db = await openDB();
  return promisify(tx('molecules').get(cid));
}

export async function searchMolecules({ query = '', classe = '', phase = '', flag = '', page = 0, limit = 50 } = {}) {
  const db = await openDB();
  return new Promise((resolve) => {
    const results = [];
    const q = query.toLowerCase();
    const req = tx('molecules').openCursor();
    req.onsuccess = e => {
      const cursor = e.target.result;
      if (!cursor) { resolve(results.slice(page * limit, page * limit + limit)); return; }
      const m = cursor.value;
      const matchQuery = !q || (m.nom_inn ?? '').toLowerCase().includes(q) || (m.nom_iupac ?? '').toLowerCase().includes(q) || (m.formule_moleculaire ?? '').toLowerCase().includes(q) || String(m.pubchem_cid ?? '').includes(q) || (m.cas_number ?? '').includes(q);
      const matchClasse = !classe || (m.classe_therapeutique ?? '') === classe;
      const matchPhase = !phase || String(m.max_phase ?? '') === phase;
      const matchFlag = !flag || (m.flag ?? '') === flag;
      if (matchQuery && matchClasse && matchPhase && matchFlag) results.push(m);
      cursor.continue();
    };
    req.onerror = () => resolve([]);
  });
}

export async function countMolecules(filters = {}) {
  const all = await searchMolecules({ ...filters, page: 0, limit: 999999 });
  return all.length;
}

export async function getAllClasses() {
  const db = await openDB();
  return new Promise(resolve => {
    const classes = new Set();
    const req = tx('molecules').openCursor();
    req.onsuccess = e => {
      const c = e.target.result;
      if (!c) { resolve([...classes].filter(Boolean).sort()); return; }
      if (c.value.classe_therapeutique) classes.add(c.value.classe_therapeutique);
      c.continue();
    };
    req.onerror = () => resolve([]);
  });
}

export async function getStats() {
  const db = await openDB();
  return new Promise(resolve => {
    const stats = { total: 0, byClass: {}, byPhase: {}, byFlag: {}, withStability: 0 };
    const req = tx('molecules').openCursor();
    req.onsuccess = e => {
      const c = e.target.result;
      if (!c) { resolve(stats); return; }
      const m = c.value;
      stats.total++;
      const cl = m.classe_therapeutique || 'Non classifié';
      stats.byClass[cl] = (stats.byClass[cl] || 0) + 1;
      const ph = String(m.max_phase ?? 'Inconnu');
      stats.byPhase[ph] = (stats.byPhase[ph] || 0) + 1;
      const fl = m.flag || 'INCONNUE';
      stats.byFlag[fl] = (stats.byFlag[fl] || 0) + 1;
      if (m.has_stability_data) stats.withStability++;
      c.continue();
    };
    req.onerror = () => resolve(stats);
  });
}

export async function findByName(name) {
  const q = name.toLowerCase().trim();
  const db = await openDB();
  return new Promise(resolve => {
    const results = [];
    const req = tx('molecules').openCursor();
    req.onsuccess = e => {
      const c = e.target.result;
      if (!c) { resolve(results[0] ?? null); return; }
      const m = c.value;
      if ((m.nom_inn ?? '').toLowerCase().includes(q) || (m.nom_iupac ?? '').toLowerCase().includes(q)) {
        results.push(m);
      }
      c.continue();
    };
    req.onerror = () => resolve(null);
  });
}

// ─── Stabilite ────────────────────────────────────────────────
export async function upsertStabilite(data) {
  const db = await openDB();
  return promisify(tx('stabilite', 'readwrite').put(data));
}
export async function getStabilite(cid) {
  const db = await openDB();
  return promisify(tx('stabilite').get(cid));
}

// ─── Dégradation ─────────────────────────────────────────────
export async function upsertDegradation(data) {
  const db = await openDB();
  return promisify(tx('degradation', 'readwrite').put(data));
}
export async function getDegradation(cid) {
  const db = await openDB();
  return promisify(tx('degradation').get(cid));
}

// ─── Collection State ─────────────────────────────────────────
export async function saveCollectionState(state) {
  const db = await openDB();
  return promisify(tx('collection_state', 'readwrite').put({ id: 'main', ...state }));
}
export async function getCollectionState() {
  const db = await openDB();
  return promisify(tx('collection_state').get('main'));
}
export async function clearCollectionState() {
  const db = await openDB();
  return promisify(tx('collection_state', 'readwrite').delete('main'));
}

export async function clearAll() {
  const db = await openDB();
  const stores = ['molecules', 'stabilite', 'degradation', 'vieillissement', 'reglementaire'];
  for (const s of stores) {
    await promisify(tx(s, 'readwrite').clear());
  }
}
