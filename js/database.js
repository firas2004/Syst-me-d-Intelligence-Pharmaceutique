// ============================================================
// PHARMA-INTEL — Database Module (7 Tables, localStorage)
// ============================================================
import { logAuditEntry, getSession } from './auth.js';

const DB_KEY = 'pharma_db';
const DB_VERSION_KEY = 'pharma_db_versions';

// ─── Drug class → pre-population templates ───────────────────
const DRUG_CLASS_TEMPLATES = {
  analgesic:     { mechanism: 'COX-1/COX-2 inhibiteur', bioavail: 80, halflife: '4-6h', logp: 1.2, stabilityRisk: 'low',    shelfLife: '36 mois', whoCat: 'A' },
  antibiotic:    { mechanism: 'Inhibition synthèse paroi bactérienne', bioavail: 60, halflife: '1-2h', logp: 0.4, stabilityRisk: 'high', shelfLife: '24 mois', whoCat: 'C' },
  antidiabetic:  { mechanism: 'Biguanide — Inhibition gluconéogenèse hépatique', bioavail: 50, halflife: '6h', logp: -1.4, stabilityRisk: 'low', shelfLife: '36 mois', whoCat: 'A' },
  antihypertensive: { mechanism: 'Inhibiteur ECA / Bloqueur AT1', bioavail: 25, halflife: '11h', logp: 0.0, stabilityRisk: 'medium', shelfLife: '30 mois', whoCat: 'B' },
  statin:        { mechanism: 'Inhibiteur HMG-CoA réductase', bioavail: 20, halflife: '14h', logp: 4.3, stabilityRisk: 'medium', shelfLife: '24 mois', whoCat: 'B' },
  default:       { mechanism: 'Non déterminé [DONNÉE MANQUANTE]', bioavail: 50, halflife: '—', logp: 2.0, stabilityRisk: 'medium', shelfLife: '24 mois', whoCat: 'B' }
};

function detectDrugClass(name) {
  const n = name.toLowerCase();
  if (/aspir|ibuprof|naprox|paracetam|acetaminoph|diclofen/.test(n)) return 'analgesic';
  if (/amoxicill|penicill|cephalospor|azithromyc/.test(n)) return 'antibiotic';
  if (/metformin|glibenclamid|sitagliptin/.test(n)) return 'antidiabetic';
  if (/lisinopril|ramipril|enalapril|losartan|valsartan/.test(n)) return 'antihypertensive';
  if (/statin|lovastatin|simvastatin|atorvastatin|rosuvastatin/.test(n)) return 'statin';
  return 'default';
}

// ─── Schema builder ───────────────────────────────────────────
function buildTable1(pubchemData, drugClass) {
  const tpl = DRUG_CLASS_TEMPLATES[drugClass];
  return {
    _meta: { tableId: 'T1', tableName: 'Molécules', reliability: 95, source: 'PubChem (NIH)', flag: 'VERIFIED', timestamp: new Date().toISOString() },
    cid: pubchemData.CID ?? '[DONNÉE MANQUANTE]',
    inn: pubchemData.IUPACName?.split(' ').slice(-1)[0] ?? pubchemData.name,
    iupac: pubchemData.IUPACName ?? '[DONNÉE MANQUANTE]',
    cas: pubchemData.CanonicalSMILES ? '' : '[DONNÉE MANQUANTE]',
    formula: pubchemData.MolecularFormula ?? '[DONNÉE MANQUANTE]',
    smiles: pubchemData.CanonicalSMILES ?? '[DONNÉE MANQUANTE]',
    mw: pubchemData.MolecularWeight ?? '[DONNÉE MANQUANTE]',
    logp: pubchemData.XLogP ?? tpl.logp,
    mechanism: tpl.mechanism,
    bioavailability: tpl.bioavail,
    halflife: tpl.halflife,
    therapeuticClass: drugClass,
    name: pubchemData.name,
    sim_flags: { mechanism: 'SIMULATED', bioavailability: 'SIMULATED', halflife: 'SIMULATED' }
  };
}

function buildTable2(mw, drugClass) {
  const tpl = DRUG_CLASS_TEMPLATES[drugClass];
  const riskMultiplier = tpl.stabilityRisk === 'high' ? 0.85 : tpl.stabilityRisk === 'medium' ? 0.92 : 0.97;
  return {
    _meta: { tableId: 'T2', tableName: 'Stabilité', reliability: 70, source: 'Extrapolation classe thérapeutique', flag: 'SIMULATED', timestamp: new Date().toISOString() },
    conditions: [
      { condition: '25°C / 60%RH (Ambiante)', result: 'Stable', assay: (100 * riskMultiplier).toFixed(1), shelfLife: tpl.shelfLife, packaging: 'HDPE opaque — étanche', ichZone: 'I, II', compliant: true },
      { condition: '30°C / 65%RH (Zone III/IV)', result: 'Acceptable', assay: (100 * riskMultiplier * 0.98).toFixed(1), shelfLife: `${parseInt(tpl.shelfLife) - 12} mois`, packaging: 'Blister aluminium', ichZone: 'III, IVa', compliant: true },
      { condition: '40°C / 75%RH (Accéléré)', result: tpl.stabilityRisk === 'high' ? 'Dégradation significative' : 'Légère dégradation', assay: (100 * riskMultiplier * 0.91).toFixed(1), shelfLife: '6 mois max', packaging: 'Blister Al/Al hermétique', ichZone: 'Accéléré ICH Q1A', compliant: tpl.stabilityRisk !== 'high' },
      { condition: '60°C (Stress thermique)', result: 'Dégradation rapide', assay: (100 * riskMultiplier * 0.78).toFixed(1), shelfLife: '— (stress test)', packaging: 'N/A — test uniquement', ichZone: 'Stress', compliant: false },
      { condition: 'ICH Q1B Photolytique', result: tpl.stabilityRisk === 'high' ? 'Sensible à la lumière' : 'Peu sensible', assay: (100 * riskMultiplier * 0.95).toFixed(1), shelfLife: tpl.shelfLife, packaging: 'Emballage opaque UV-protégé', ichZone: 'Q1B', compliant: true }
    ]
  };
}

function buildTable3(mw, drugClass) {
  const tpl = DRUG_CLASS_TEMPLATES[drugClass];
  const baseRate = tpl.stabilityRisk === 'high' ? 15 : tpl.stabilityRisk === 'medium' ? 8 : 4;
  return {
    _meta: { tableId: 'T3', tableName: 'Dégradation Forcée', reliability: 70, source: 'Extrapolation — ICH Q1B / classe', flag: 'SIMULATED', timestamp: new Date().toISOString() },
    stressTests: [
      { type: 'Acide', conditions: 'HCl 0.1N / 60°C / 24h', rate: baseRate * 1.2, products: 'Produit d\'hydrolyse acide (DP-01)', method: 'HPLC-UV / LC-MS', ichCompliant: true, borderline: false },
      { type: 'Base', conditions: 'NaOH 0.1N / 60°C / 24h', rate: baseRate * 1.5, products: 'Produit d\'hydrolyse basique (DP-02, DP-03)', method: 'HPLC-UV / LC-MS', ichCompliant: true, borderline: false },
      { type: 'Thermique', conditions: '105°C / air sec / 5j', rate: baseRate * 0.8, products: 'Produit de dégradation thermique (DP-04)', method: 'HPLC-UV / DSC', ichCompliant: true, borderline: false },
      { type: 'Photolytique', conditions: 'UV 254nm / 1.2M lux·h ICH Q1B', rate: tpl.stabilityRisk === 'high' ? baseRate * 2.1 : baseRate * 0.6, products: 'Photoproduit (DP-05)', method: 'HPLC-UV / LC-MS/MS', ichCompliant: tpl.stabilityRisk !== 'high', borderline: tpl.stabilityRisk === 'medium' },
      { type: 'Oxydatif', conditions: 'H₂O₂ 3% / 25°C / 24h', rate: baseRate * 1.8, products: 'Sulfoxyde (DP-06), N-oxyde (DP-07)', method: 'HPLC-UV / LC-HRMS', ichCompliant: baseRate * 1.8 < 20, borderline: baseRate * 1.8 >= 15 },
      { type: 'Humidité', conditions: '40°C / 92%RH / 1 semaine', rate: baseRate * 0.9, products: 'Produit hydrolytique (DP-08)', method: 'HPLC-UV / KF Titration', ichCompliant: true, borderline: false }
    ]
  };
}

function buildTable4(mw, drugClass) {
  const tpl = DRUG_CLASS_TEMPLATES[drugClass];
  const decay = tpl.stabilityRisk === 'high' ? 0.35 : tpl.stabilityRisk === 'medium' ? 0.18 : 0.09;
  const timePoints = [0, 1, 3, 6, 9, 12, 18, 24];
  return {
    _meta: { tableId: 'T4', tableName: 'Étude de Vieillissement', reliability: 70, source: 'Modèle Arrhenius — ICH Q1A/Q1E', flag: 'SIMULATED', timestamp: new Date().toISOString() },
    accelerated: {
      zone: 'ICH Q1A — Accéléré (40°C/75%RH)',
      timePoints: timePoints.map(t => ({
        month: t,
        assay: parseFloat((100 - (t * decay * 1.8)).toFixed(2)),
        impurities: parseFloat((0.05 + t * 0.04 * 1.8).toFixed(3)),
        ph: parseFloat((6.8 - t * 0.015 * 1.5).toFixed(2)),
        dissolution: parseFloat((99 - t * decay * 1.2).toFixed(1))
      }))
    },
    realTime: {
      zone: 'ICH Q1A — Temps Réel (25°C/60%RH)',
      timePoints: timePoints.map(t => ({
        month: t,
        assay: parseFloat((100 - (t * decay)).toFixed(2)),
        impurities: parseFloat((0.05 + t * 0.04).toFixed(3)),
        ph: parseFloat((6.8 - t * 0.015).toFixed(2)),
        dissolution: parseFloat((99 - t * decay * 0.6).toFixed(1))
      }))
    }
  };
}

function buildTable5(pubchemData, drugClass) {
  const mw = parseFloat(pubchemData.MolecularWeight ?? 300);
  const costPerGram = (mw / 150 * (drugClass === 'antibiotic' ? 8 : 3)).toFixed(2);
  return {
    _meta: { tableId: 'T5', tableName: 'Voies de Synthèse', reliability: 65, source: 'Estimation — SciFinder / Reaxys classe', flag: 'SIMULATED', timestamp: new Date().toISOString() },
    routes: [
      { name: 'Route A — Synthèse directe', precursors: `Précurseur P1 (MW ~${(mw*0.6).toFixed(0)}), Précurseur P2`, steps: 4, yield: 72, costPerGram: parseFloat(costPerGram), feasibility: 82, notes: 'Route préférentielle — rendement satisfaisant' },
      { name: 'Route B — Semi-synthèse', precursors: `Intermédiaire I1 (MW ~${(mw*0.8).toFixed(0)}), Réactif B1`, steps: 2, yield: 85, costPerGram: parseFloat(costPerGram) * 1.4, feasibility: 91, notes: 'Coût plus élevé — moins d\'étapes' },
      { name: 'Route C — Biosynthèse fermentative', precursors: 'Souche microbienne certifiée + substrats', steps: 1, yield: 45, costPerGram: parseFloat(costPerGram) * 0.7, feasibility: 55, notes: 'Coût faible — rendement limité' }
    ],
    recommendedRoute: 'Route A',
    scaleUpScore: 78
  };
}

function buildTable6(pubchemData, drugClass) {
  return {
    _meta: { tableId: 'T6', tableName: 'Réglementaire & Sécurité', reliability: 70, source: 'WHO / EMA — extrapolation classe', flag: 'SIMULATED', timestamp: new Date().toISOString() },
    ld50: `>2000 mg/kg (rat, oral) [estimation classe ${drugClass}]`,
    whoToxicityClass: DRUG_CLASS_TEMPLATES[drugClass].whoCat,
    ghsHazards: ['H302 (Nocif par ingestion)', 'H315 (Irritant cutané)', 'H319 (Irritant oculaire)'],
    approvals: {
      TN: { status: 'Vérification requise', agency: 'DPCM Tunisie', ctdModule: '3.2.S', flag: 'SIMULATED' },
      FR: { status: 'Vérification requise', agency: 'ANSM / EMA', ctdModule: '3.2.S + 3.2.P', flag: 'SIMULATED' },
      IT: { status: 'Vérification requise', agency: 'AIFA / EMA', ctdModule: '3.2.S + 3.2.P', flag: 'SIMULATED' },
      USA: { status: 'Vérification requise', agency: 'FDA (NDA/ANDA)', ctdModule: 'CTD 3.2.S', flag: 'SIMULATED' }
    },
    ichGuidelines: {
      Q1A: 'Étude stabilité temps réel requise', Q1B: 'Test photostabilité obligatoire',
      Q1E: 'Extrapolation durée de vie permise si tendance linéaire', Q3A: 'Seuil impuretés ≤ 0.10%',
      Q6A: 'Spécifications API libération et durée de vie'
    },
    ctdModule3Status: 'Pré-rempli partiellement — complétion requise'
  };
}

function buildTable7(drugClass) {
  return {
    _meta: { tableId: 'T7', tableName: 'Compatibilité Excipients', reliability: 68, source: 'Handbook of Excipients — extrapolation', flag: 'SIMULATED', timestamp: new Date().toISOString() },
    excipients: [
      { name: 'Cellulose microcristalline (MCC)', compatible: true, interaction: 'Aucune interaction connue', ratio: '20-50%', caution: false },
      { name: 'Lactose monohydraté', compatible: drugClass !== 'analgesic', interaction: drugClass === 'analgesic' ? 'Réaction de Maillard possible — test requis' : 'Aucune interaction significative', ratio: '10-30%', caution: drugClass === 'analgesic' },
      { name: 'Stéarate de magnésium', compatible: true, interaction: 'Lubrification acceptable — temps mélange critique', ratio: '0.25-1%', caution: false },
      { name: 'Dioxyde de silicium (Aérosil)', compatible: true, interaction: 'Fluidifiant — aucune réaction', ratio: '0.1-0.5%', caution: false },
      { name: 'Polyvinylpyrrolidone (PVP K30)', compatible: true, interaction: 'Liant compatible', ratio: '2-5%', caution: false },
      { name: 'Hydroxypropylméthylcellulose (HPMC)', compatible: true, interaction: 'Film coating — compatible', ratio: '2-8%', caution: false },
      { name: 'Amidon de maïs', compatible: true, interaction: 'Délitant efficace', ratio: '5-15%', caution: false },
      { name: 'Talc', compatible: drugClass !== 'antibiotic', interaction: drugClass === 'antibiotic' ? 'Adsorption possible — réduction biodisponibilité' : 'Aucune interaction', ratio: '1-2%', caution: drugClass === 'antibiotic' }
    ]
  };
}

// ─── Main Database API ────────────────────────────────────────
export function initDB() {
  if (!localStorage.getItem(DB_KEY)) {
    const empty = { drugA: null, drugB: null, tables: {}, metadata: { created: new Date().toISOString(), version: 1 } };
    localStorage.setItem(DB_KEY, JSON.stringify(empty));
  }
}

export function getDB() {
  try { return JSON.parse(localStorage.getItem(DB_KEY) ?? '{}'); }
  catch { return {}; }
}

export function saveDB(db) {
  const versions = getVersionHistory();
  const current = getDB();
  if (current.tables) {
    versions.unshift({ snapshot: current, savedAt: new Date().toISOString(), version: current.metadata?.version ?? 1 });
    if (versions.length > 10) versions.splice(10);
    localStorage.setItem(DB_VERSION_KEY, JSON.stringify(versions));
  }
  db.metadata = { ...db.metadata, updated: new Date().toISOString(), version: (db.metadata?.version ?? 1) + 1 };
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function getVersionHistory() {
  try { return JSON.parse(localStorage.getItem(DB_VERSION_KEY) ?? '[]'); }
  catch { return []; }
}

export function populateFromPubchem(slot, pubchemData) {
  const db = getDB();
  const drugClass = detectDrugClass(pubchemData.name ?? '');
  const mw = parseFloat(pubchemData.MolecularWeight ?? 300);

  const tables = {
    T1: buildTable1(pubchemData, drugClass),
    T2: buildTable2(mw, drugClass),
    T3: buildTable3(mw, drugClass),
    T4: buildTable4(mw, drugClass),
    T5: buildTable5(pubchemData, drugClass),
    T6: buildTable6(pubchemData, drugClass),
    T7: buildTable7(drugClass)
  };

  db[slot] = { name: pubchemData.name, cid: pubchemData.CID, drugClass, loadedAt: new Date().toISOString() };
  if (!db.tables) db.tables = {};
  db.tables[slot] = tables;

  saveDB(db);

  const session = getSession();
  logAuditEntry({
    user: session?.label ?? 'SYSTEM',
    department: session?.department ?? 'system',
    sessionId: session?.sessionId ?? 'N/A',
    action: `MOLECULE_LOADED — ${slot.toUpperCase()}: ${pubchemData.name} (CID: ${pubchemData.CID})`,
    result: 'SUCCESS — 7 tables populated',
    timestamp: new Date().toISOString()
  });

  return tables;
}

export function getTableData(slot, tableId) {
  const db = getDB();
  return db.tables?.[slot]?.[tableId] ?? null;
}

export function getAllTables(slot) {
  const db = getDB();
  return db.tables?.[slot] ?? null;
}

export function getDrugInfo(slot) {
  const db = getDB();
  return db[slot] ?? null;
}

export function isLoaded(slot) {
  const info = getDrugInfo(slot);
  return info !== null;
}

export function clearDB() {
  localStorage.removeItem(DB_KEY);
  localStorage.removeItem(DB_VERSION_KEY);
  initDB();
}
