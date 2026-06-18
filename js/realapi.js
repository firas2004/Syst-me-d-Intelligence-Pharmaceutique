// ============================================================
// PHARMA-INTEL v3.0 — Real API Module
// ChEMBL + OpenFDA + PubChem pug_view
// ============================================================

const CHEMBL_BASE = 'https://www.ebi.ac.uk/chembl/api/data';
const OPENFDA_BASE = 'https://api.fda.gov/drug';
const PUBCHEM_VIEW = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound';
const PUBCHEM_BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';

// ─── Delay helper ─────────────────────────────────────────────
export const delay = ms => new Promise(r => setTimeout(r, ms));

// ─── ChEMBL: Fetch approved molecules page ────────────────────
export async function fetchChemblPage(offset = 0, maxPhase = 4, limit = 1000) {
  const url = `${CHEMBL_BASE}/molecule.json?max_phase=${maxPhase}&limit=${limit}&offset=${offset}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ChEMBL error ${res.status}`);
  const data = await res.json();
  const molecules = data.molecules ?? [];
  const total = data.page_meta?.total_count ?? 0;

  return {
    molecules: molecules.map(m => ({
      chembl_id: m.molecule_chembl_id,
      nom_inn: m.pref_name ?? null,
      max_phase: m.max_phase ?? null,
      formule_moleculaire: m.molecule_properties?.full_molformula ?? null,
      masse_moleculaire: m.molecule_properties?.mw_freebase ?? null,
      logp: m.molecule_properties?.alogp ?? null,
      tpsa: m.molecule_properties?.psa ?? null,
      ro5_violations: m.molecule_properties?.num_ro5_violations ?? null,
      classe_therapeutique: m.indication_class ?? null,
      therapeutic_flag: m.therapeutic_flag ?? null,
      molecule_type: m.molecule_type ?? null,
      cas_number: m.molecule_synonyms?.find(s => s.syn_type === 'CAS')?.molecule_synonym ?? null,
      smiles_chembl: m.molecule_structures?.canonical_smiles ?? null,
      inchikey_chembl: m.molecule_structures?.standard_inchi_key ?? null,
      source_chembl: 'ChEMBL (EMBL-EBI)',
      score_fiabilite: 88,
      flag: 'DONNÉE RÉELLE',
      date_collecte: new Date().toISOString()
    })),
    total
  };
}

// ─── ChEMBL: Get mechanism of action for a chembl_id ─────────
export async function fetchChemblMechanism(chemblId) {
  try {
    const url = `${CHEMBL_BASE}/mechanism.json?molecule_chembl_id=${chemblId}&limit=5`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const mech = data.mechanisms?.[0];
    return mech ? {
      mechanism: mech.mechanism_of_action ?? null,
      target: mech.target_pref_name ?? null,
      action_type: mech.action_type ?? null,
      source: 'ChEMBL Mechanism of Action',
      flag: 'DONNÉE RÉELLE'
    } : null;
  } catch { return null; }
}

// ─── PubChem: Match ChEMBL molecule to CID by name ────────────
export async function matchPubchemCID(name) {
  if (!name) return null;
  try {
    const res = await fetch(`${PUBCHEM_BASE}/compound/name/${encodeURIComponent(name)}/cids/JSON`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.IdentifierList?.CID?.[0] ?? null;
  } catch { return null; }
}

// ─── PubChem: Batch properties for up to 100 CIDs ─────────────
export async function fetchPubchemBatch(cids) {
  if (!cids?.length) return [];
  const props = 'MolecularFormula,MolecularWeight,IUPACName,CanonicalSMILES,InChI,InChIKey,XLogP,TPSA,HBondDonorCount,HBondAcceptorCount,RotatableBondCount,HeavyAtomCount';
  const chunk = cids.slice(0, 100).join(',');
  try {
    const res = await fetch(`${PUBCHEM_BASE}/compound/cid/${chunk}/property/${props}/JSON`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.PropertyTable?.Properties ?? []).map(p => ({
      pubchem_cid: p.CID,
      nom_iupac: p.IUPACName ?? null,
      formule_moleculaire: p.MolecularFormula ?? null,
      masse_moleculaire: p.MolecularWeight ?? null,
      smiles: p.CanonicalSMILES ?? null,
      inchi: p.InChI ?? null,
      inchikey: p.InChIKey ?? null,
      logp: p.XLogP ?? null,
      tpsa: p.TPSA ?? null,
      hbd: p.HBondDonorCount ?? null,
      hba: p.HBondAcceptorCount ?? null,
      rot_bonds: p.RotatableBondCount ?? null,
      heavy_atoms: p.HeavyAtomCount ?? null,
      source_pubchem: 'PubChem (NIH)',
      score_pubchem: 95,
      flag_pubchem: 'DONNÉE RÉELLE',
      date_pubchem: new Date().toISOString()
    }));
  } catch { return []; }
}

// ─── PubChem pug_view: Stability data (on demand) ─────────────
export async function fetchPugViewSection(cid, heading) {
  try {
    const url = `${PUBCHEM_VIEW}/${cid}/JSON?heading=${encodeURIComponent(heading)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return extractPugViewText(data);
  } catch { return null; }
}

function extractPugViewText(data) {
  const texts = [];
  function traverse(obj) {
    if (!obj) return;
    if (Array.isArray(obj)) { obj.forEach(traverse); return; }
    if (typeof obj === 'object') {
      if (obj.StringWithMarkup) {
        obj.StringWithMarkup.forEach(s => { if (s.String) texts.push(s.String); });
      }
      Object.values(obj).forEach(v => { if (typeof v === 'object') traverse(v); });
    }
  }
  traverse(data);
  return texts.length > 0 ? texts.join('\n') : null;
}

export async function fetchStabilityData(cid) {
  const sections = ['Stability', 'Storage+Conditions', 'Decomposition', 'Reactivity+Profile', 'Chemical+Incompatibilities'];
  const results = {};
  for (const section of sections) {
    await delay(210);
    const text = await fetchPugViewSection(cid, section);
    results[section.replace('+', '_')] = text
      ? { text, flag: 'DONNÉE RÉELLE', source: `PubChem pug_view/${section}`, url: `${PUBCHEM_VIEW}/${cid}/JSON?heading=${section}`, date: new Date().toISOString() }
      : { text: null, flag: 'DONNÉE MANQUANTE', source: 'PubChem pug_view', date: new Date().toISOString() };
  }
  return results;
}

// ─── OpenFDA: Storage and handling for a drug name ─────────────
export async function fetchFDALabel(drugName) {
  if (!drugName) return null;
  try {
    const url = `${OPENFDA_BASE}/label.json?search=openfda.generic_name:"${encodeURIComponent(drugName)}"&limit=3`;
    const res = await fetch(url);
    if (!res.ok) {
      // Try alternate field
      const url2 = `${OPENFDA_BASE}/label.json?search=openfda.substance_name:"${encodeURIComponent(drugName)}"&limit=3`;
      const res2 = await fetch(url2);
      if (!res2.ok) return null;
      const d2 = await res2.json();
      return parseFDALabel(d2?.results?.[0]);
    }
    const data = await res.json();
    return parseFDALabel(data?.results?.[0]);
  } catch { return null; }
}

function parseFDALabel(label) {
  if (!label) return null;
  const storage = label.storage_and_handling?.[0] ?? null;
  const howSupplied = label.how_supplied?.[0] ?? null;

  // Extract temperature from text using regex
  let temp = null, conditions = [];
  if (storage) {
    const t1 = storage.match(/store at (\d+)[°\s]*[cf]/i);
    const t2 = storage.match(/between (\d+)\s*[°\s]*[cf]\s*(?:and|to|-)\s*(\d+)/i);
    const refrig = /refrigerat|2[\s°]*[cto-]+[\s°]*8/i.test(storage);
    const room = /room temperature|controlled room|15[\s°]*[cto-]+[\s°]*30/i.test(storage);
    const freeze = /do not freeze/i.test(storage);
    const light = /protect from light|avoid light/i.test(storage);
    const moisture = /protect from moisture|dry place/i.test(storage);

    if (refrig) { temp = '2-8°C (Réfrigéré)'; conditions.push('Réfrigération requise'); }
    else if (room) { temp = '15-30°C'; conditions.push('Température ambiante contrôlée'); }
    else if (t2) { temp = `${t2[1]}-${t2[2]}°C`; }
    else if (t1) { temp = `${parseInt(t1[1])}°C`; }

    if (freeze) conditions.push('Ne pas congeler');
    if (light) conditions.push('Protéger de la lumière');
    if (moisture) conditions.push('Protéger de l\'humidité');
  }

  return {
    storage_text: storage,
    temperature_stockage: temp,
    conditions_speciales: conditions,
    forme_galenique: howSupplied,
    flag: 'DONNÉE RÉELLE',
    source: 'OpenFDA Drug Label (FDA)',
    source_url: 'https://api.fda.gov/drug/label.json',
    date_extraction: new Date().toISOString()
  };
}

// ─── OpenFDA: Batch search by offset ──────────────────────────
export async function fetchFDABatch(offset = 0, limit = 100) {
  try {
    const url = `${OPENFDA_BASE}/label.json?search=_exists_:storage_and_handling&limit=${limit}&skip=${offset}`;
    const res = await fetch(url);
    if (!res.ok) return { results: [], total: 0 };
    const data = await res.json();
    return { results: data.results ?? [], total: data.meta?.results?.total ?? 0 };
  } catch { return { results: [], total: 0 }; }
}
