// ============================================================
// PHARMA-INTEL — AI Intelligence Module
// ============================================================
import { getAllTables, getDrugInfo } from './database.js';
import { logAuditEntry, getSession } from './auth.js';

// ─── Degradation Prediction Engine ────────────────────────────
export function predictDegradation(temp, rh, months, slot = 'drugA') {
  const tables = getAllTables(slot);
  if (!tables) return null;

  const t3 = tables.T3;
  const drugClass = getDrugInfo(slot)?.drugClass ?? 'default';

  // Arrhenius-based risk model
  const tempFactor = Math.exp((temp - 25) * 0.035);
  const rhFactor = (rh / 60) ** 1.4;
  const timeFactor = Math.sqrt(months / 6);
  const classFactor = drugClass === 'antibiotic' ? 1.4 : drugClass === 'statin' ? 1.2 : 1.0;

  // Per degradation pathway
  const stressData = t3?.stressTests ?? [];
  const pathways = [
    { name: 'Oxydation', base: stressData.find(s => s.type === 'Oxydatif')?.rate ?? 8, rhSensitive: true, tempSensitive: true },
    { name: 'Hydrolyse acide', base: stressData.find(s => s.type === 'Acide')?.rate ?? 6, rhSensitive: true, tempSensitive: true },
    { name: 'Hydrolyse basique', base: stressData.find(s => s.type === 'Base')?.rate ?? 7, rhSensitive: true, tempSensitive: false },
    { name: 'Dégradation thermique', base: stressData.find(s => s.type === 'Thermique')?.rate ?? 5, rhSensitive: false, tempSensitive: true },
    { name: 'Dégradation photolytique', base: stressData.find(s => s.type === 'Photolytique')?.rate ?? 4, rhSensitive: false, tempSensitive: false },
  ];

  const results = pathways.map(p => {
    const factor = classFactor * timeFactor *
      (p.tempSensitive ? tempFactor : 1) *
      (p.rhSensitive ? rhFactor : 1);
    const probability = Math.min(99, Math.round(p.base * factor));
    const confidence = Math.max(60, Math.min(92, 75 + Math.random() * 10));
    return { ...p, probability, confidence: Math.round(confidence) };
  });

  // Overall risk
  const maxProb = Math.max(...results.map(r => r.probability));
  const overallRisk = maxProb > 70 ? 'ÉLEVÉ' : maxProb > 40 ? 'MODÉRÉ' : 'FAIBLE';
  const riskColor = maxProb > 70 ? '#ef4444' : maxProb > 40 ? '#f59e0b' : '#22c55e';

  logAuditEntry({
    user: getSession()?.label ?? 'SYSTEM',
    department: getSession()?.department ?? 'system',
    sessionId: getSession()?.sessionId ?? 'N/A',
    action: `AI_PREDICTION — ${temp}°C / ${rh}%RH / ${months}mois — ${slot}`,
    result: `Risque global: ${overallRisk} — Max probabilité: ${maxProb}%`,
    timestamp: new Date().toISOString()
  });

  return { temp, rh, months, pathways: results, overallRisk, riskColor, maxProbability: maxProb, slot };
}

// ─── Drug A vs B Comparator ───────────────────────────────────
export function compareDrugs() {
  const aInfo = getDrugInfo('drugA');
  const bInfo = getDrugInfo('drugB');
  if (!aInfo || !bInfo) return null;

  const aT = getAllTables('drugA');
  const bT = getAllTables('drugB');

  // Molecular similarity (Tanimoto-like based on available descriptors)
  const mwA = parseFloat(aT.T1?.mw ?? 300);
  const mwB = parseFloat(bT.T1?.mw ?? 300);
  const logpA = parseFloat(aT.T1?.logp ?? 2);
  const logpB = parseFloat(bT.T1?.logp ?? 2);

  const mwSim = 1 - Math.abs(mwA - mwB) / Math.max(mwA, mwB);
  const logpSim = 1 - Math.abs(logpA - logpB) / (Math.abs(logpA) + Math.abs(logpB) + 0.001);
  const classSim = aInfo.drugClass === bInfo.drugClass ? 1 : 0.3;
  const similarityScore = Math.round((mwSim * 0.4 + logpSim * 0.3 + classSim * 0.3) * 100);

  // Stability comparison
  const aStab = aT.T2?.conditions?.[0]?.assay ?? 97;
  const bStab = bT.T2?.conditions?.[0]?.assay ?? 97;

  // Degradation risk comparison
  const aDeg = aT.T3?.stressTests?.reduce((acc, s) => acc + s.rate, 0) / (aT.T3?.stressTests?.length ?? 1);
  const bDeg = bT.T3?.stressTests?.reduce((acc, s) => acc + s.rate, 0) / (bT.T3?.stressTests?.length ?? 1);

  // Cost comparison
  const aCost = aT.T5?.routes?.[0]?.costPerGram ?? 5;
  const bCost = bT.T5?.routes?.[0]?.costPerGram ?? 5;

  const categories = [
    { name: 'Stabilité (T25/60%RH)', scoreA: parseFloat(aStab), scoreB: parseFloat(bStab), unit: '% dosage', higherBetter: true },
    { name: 'Risque Dégradation', scoreA: Math.round(aDeg), scoreB: Math.round(bDeg), unit: '% moyen', higherBetter: false },
    { name: 'Biodisponibilité', scoreA: aT.T1?.bioavailability ?? 50, scoreB: bT.T1?.bioavailability ?? 50, unit: '%', higherBetter: true },
    { name: 'Masse Moléculaire', scoreA: mwA, scoreB: mwB, unit: 'g/mol', higherBetter: false },
    { name: 'Coût Synthèse', scoreA: aCost, scoreB: bCost, unit: '€/g', higherBetter: false },
    { name: 'Faisabilité Synthèse', scoreA: aT.T5?.routes?.[0]?.feasibility ?? 75, scoreB: bT.T5?.routes?.[0]?.feasibility ?? 75, unit: '%', higherBetter: true },
    { name: 'Durée de Vie (mois)', scoreA: parseInt(aT.T2?.conditions?.[0]?.shelfLife ?? 36), scoreB: parseInt(bT.T2?.conditions?.[0]?.shelfLife ?? 36), unit: 'mois', higherBetter: true },
  ];

  // Winner per category
  const withWinners = categories.map(cat => {
    const aWins = cat.higherBetter ? cat.scoreA >= cat.scoreB : cat.scoreA <= cat.scoreB;
    return { ...cat, winner: cat.scoreA === cat.scoreB ? 'ÉGALITÉ' : aWins ? 'A' : 'B' };
  });

  const aWins = withWinners.filter(c => c.winner === 'A').length;
  const bWins = withWinners.filter(c => c.winner === 'B').length;
  const recommendation = aWins > bWins ? 'Drug A' : bWins > aWins ? 'Drug B' : 'Équivalents';

  return { aInfo, bInfo, similarityScore, categories: withWinners, aWins, bWins, recommendation, timestamp: new Date().toISOString() };
}

// ─── Conflict Detector ────────────────────────────────────────
export function detectConflicts(slot) {
  const tables = getAllTables(slot);
  if (!tables) return [];
  const conflicts = [];

  // Check stability vs degradation consistency
  const stabAssay = parseFloat(tables.T2?.conditions?.find(c => c.condition.includes('40°C'))?.assay ?? 100);
  const oxidRate = tables.T3?.stressTests?.find(s => s.type === 'Oxydatif')?.rate ?? 0;
  if (stabAssay > 98 && oxidRate > 20) {
    conflicts.push({ severity: 'HIGH', desc: 'Incohérence T2/T3: Stabilité élevée à 40°C mais taux d\'oxydation élevé', tables: ['T2', 'T3'], flag: 'CONFLIT' });
  }

  // Check shelf life vs ICH compliance
  const shelfLife = parseInt(tables.T2?.conditions?.[0]?.shelfLife ?? 36);
  const agingLast = tables.T4?.realTime?.timePoints?.slice(-1)[0];
  if (agingLast && agingLast.assay < 90 && shelfLife > 24) {
    conflicts.push({ severity: 'MEDIUM', desc: 'Incohérence T2/T4: Dosage < 90% à T24 mais durée de vie > 24 mois revendiquée', tables: ['T2', 'T4'], flag: 'CONFLIT' });
  }

  return conflicts;
}

// ─── Real-time Alert Feed (Simulated) ─────────────────────────
export function generateAlertFeed(drugName) {
  const alerts = [
    { source: 'EMA', type: 'Guideline', title: `ICH Q1A(R2): Mise à jour études stabilité`, date: '2025-11-12', severity: 'INFO', url: 'https://www.ema.europa.eu' },
    { source: 'FDA', type: 'Safety', title: `Safety alert: Impuretés nitrosamines — surveillance renforcée`, date: '2025-10-03', severity: 'WARNING', url: 'https://www.fda.gov' },
    { source: 'PubMed', type: 'Publication', title: `Dégradation photolytique des principes actifs similaires à ${drugName}`, date: '2026-01-18', severity: 'INFO', url: 'https://pubmed.ncbi.nlm.nih.gov' },
    { source: 'WHO', type: 'Guideline', title: `Révision classification toxicité WHO — Catégorie B`, date: '2026-02-05', severity: 'INFO', url: 'https://www.who.int' },
    { source: 'ICH', type: 'Guideline', title: `ICH Q3A: Seuils impuretés substances apparentées — addendum`, date: '2026-03-22', severity: 'WARNING', url: 'https://www.ich.org' },
  ];
  return alerts;
}
