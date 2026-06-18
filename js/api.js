// ============================================================
// PHARMA-INTEL — PubChem API Module
// ============================================================
import { logAuditEntry, getSession } from './auth.js';

const PUBCHEM_BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
const PUBCHEM_VIEW = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug_view';

export async function fetchPubchem(drugName) {
  if (!drugName?.trim()) throw new Error('NO_QUERY');

  const name = drugName.trim();

  try {
    // Step 1: Get CID
    const cidRes = await fetch(`${PUBCHEM_BASE}/compound/name/${encodeURIComponent(name)}/cids/JSON`);
    if (!cidRes.ok) throw new Error('NOT_FOUND');
    const cidData = await cidRes.json();
    const CID = cidData?.IdentifierList?.CID?.[0];
    if (!CID) throw new Error('NOT_FOUND');

    // Step 2: Get properties
    const props = ['IUPACName', 'MolecularFormula', 'MolecularWeight', 'CanonicalSMILES', 'XLogP', 'InChI', 'InChIKey', 'HBondDonorCount', 'HBondAcceptorCount', 'RotatableBondCount', 'TPSA'];
    const propRes = await fetch(`${PUBCHEM_BASE}/compound/cid/${CID}/property/${props.join(',')}/JSON`);
    if (!propRes.ok) throw new Error('PROPS_FAILED');
    const propData = await propRes.json();
    const properties = propData?.PropertyTable?.Properties?.[0] ?? {};

    const result = {
      name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
      CID,
      IUPACName: properties.IUPACName ?? null,
      MolecularFormula: properties.MolecularFormula ?? null,
      MolecularWeight: properties.MolecularWeight ?? null,
      CanonicalSMILES: properties.CanonicalSMILES ?? null,
      XLogP: properties.XLogP ?? null,
      InChI: properties.InChI ?? null,
      InChIKey: properties.InChIKey ?? null,
      HBondDonors: properties.HBondDonorCount ?? null,
      HBondAcceptors: properties.HBondAcceptorCount ?? null,
      RotatableBonds: properties.RotatableBondCount ?? null,
      TPSA: properties.TPSA ?? null,
      source: 'PubChem (NIH)',
      sourceUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${CID}`,
      reliability: 95,
      fetchedAt: new Date().toISOString()
    };

    // Log to audit trail
    const session = getSession();
    logAuditEntry({
      user: session?.label ?? 'SYSTEM',
      department: session?.department ?? 'system',
      sessionId: session?.sessionId ?? 'N/A',
      action: `PUBCHEM_FETCH — "${name}" → CID: ${CID}`,
      result: `SUCCESS — MW: ${properties.MolecularWeight}, Formula: ${properties.MolecularFormula}`,
      timestamp: new Date().toISOString()
    });

    return result;
  } catch (err) {
    const session = getSession();
    logAuditEntry({
      user: session?.label ?? 'SYSTEM',
      department: session?.department ?? 'system',
      sessionId: session?.sessionId ?? 'N/A',
      action: `PUBCHEM_FETCH — "${name}"`,
      result: `FAILURE — ${err.message}`,
      timestamp: new Date().toISOString()
    });
    throw err;
  }
}

export function getPubchemImageUrl(cid) {
  return `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG`;
}

export function getPubchemUrl(cid) {
  return `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`;
}
