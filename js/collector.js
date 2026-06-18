// ============================================================
// PHARMA-INTEL v3.0 — Collection Engine
// Fix: tracks next_chembl_offset so each new run adds NEW molecules
// ============================================================
import { fetchChemblPage, fetchPubchemBatch, fetchFDALabel, matchPubchemCID, delay } from './realapi.js';
import { upsertMolecule, saveCollectionState, getCollectionState, clearCollectionState, openDB } from './indexeddb.js';
import { logAuditEntry, getSession } from './auth.js';

// ─── State ────────────────────────────────────────────────────
let running = false;
let paused  = false;
let progressCallback = null;
let logCallback = null;

export function setProgressCallback(fn) { progressCallback = fn; }
export function setLogCallback(fn) { logCallback = fn; }
export function isRunning() { return running; }
export function pauseCollection()  { paused = true; }
export function resumeCollection() { paused = false; }

function emit(p) { if (progressCallback) progressCallback(p); }
function log(msg, type = 'info') { if (logCallback) logCallback(msg, type); }

// ─── Main Collection Runner ───────────────────────────────────
export async function startCollection(options = {}) {
  if (running) { log('⚠ Collecte déjà en cours.', 'warn'); return; }

  const {
    maxPhase      = 4,
    limit         = null,
    collectFDA    = true,
    resumeIfPossible = true
  } = options;

  running = true;
  paused  = false;
  await openDB();

  // ── Determine start offset ────────────────────────────────
  // Always read state so we know where ChEMBL left off
  const savedState = await getCollectionState();

  let startOffset  = 0;
  let processedCIDs = new Set();

  if (resumeIfPossible && savedState && !savedState.completed) {
    // Resume an interrupted run
    startOffset   = savedState.chembl_offset  ?? 0;
    processedCIDs = new Set(savedState.processed_cids ?? []);
    log(`↩ Reprise depuis offset ChEMBL ${startOffset} (${processedCIDs.size} mol. déjà en base)`, 'warn');
  } else {
    // New run: START AFTER the last molecule collected
    // next_chembl_offset is saved at end of every successful run
    startOffset = savedState?.next_chembl_offset ?? 0;
    if (startOffset > 0) {
      log(`➕ Nouvelle collecte — départ offset ${startOffset} (molécules déjà existantes préservées)`, 'info');
    } else {
      log('🆕 Première collecte — départ offset 0', 'info');
    }
  }

  log(`🚀 Phase clinique max: ${maxPhase} | Limite: ${limit ?? 'illimitée'}`, 'info');

  let totalNew = 0;
  let offset   = startOffset;

  try {
    // ── PHASE 1: ChEMBL bulk ──────────────────────────────────
    log('📡 Phase 1/3 — Téléchargement ChEMBL...', 'info');
    let chemblDone = false;

    while (!chemblDone && running) {
      while (paused) await delay(500);
      if (limit && totalNew >= limit) break;

      try {
        const { molecules, total } = await fetchChemblPage(offset, maxPhase, 1000);

        if (!molecules.length) { chemblDone = true; break; }

        const batch = [];
        for (const mol of molecules) {
          if (limit && totalNew >= limit) { chemblDone = true; break; }
          if (!mol.nom_inn) continue;

          batch.push({
            pubchem_cid: `CHEMBL:${mol.chembl_id}`,   // temp key
            chembl_id:   mol.chembl_id,
            nom_inn:     mol.nom_inn,
            nom_iupac:   null,
            cas_number:  mol.cas_number,
            formule_moleculaire: mol.formule_moleculaire,
            masse_moleculaire:   mol.masse_moleculaire,
            smiles:    mol.smiles_chembl,
            logp:      mol.logp,
            tpsa:      mol.tpsa,
            max_phase: mol.max_phase,
            classe_therapeutique: mol.classe_therapeutique,
            molecule_type: mol.molecule_type,
            ro5_violations: mol.ro5_violations,
            mecanisme_action: null,
            temperature_stockage: null,
            conditions_stockage:  null,
            source_principale: 'ChEMBL (EMBL-EBI)',
            score_fiabilite: 88,
            flag: 'DONNÉE RÉELLE',
            has_fda_data:      false,
            has_stability_data: false,
            date_collecte: new Date().toISOString()
          });
          totalNew++;
        }

        for (const rec of batch) await upsertMolecule(rec);
        offset += molecules.length;

        emit({ phase: 1, phaseTotal: 3, phaseName: 'ChEMBL', collected: totalNew, total: total, offset });
        log(`[ChEMBL] offset ${offset}: +${batch.length} mol. — Total session: ${totalNew}`, 'info');

        await saveCollectionState({
          chembl_offset: offset,
          next_chembl_offset: savedState?.next_chembl_offset ?? 0,
          processed_cids: [...processedCIDs],
          completed: false
        });
        await delay(220);

        if (molecules.length < 1000) chemblDone = true;

      } catch (err) {
        log(`⚠ ChEMBL erreur offset ${offset}: ${err.message} — retry 2s`, 'warn');
        await delay(2000);
      }
    }

    log(`✅ Phase 1 terminée — ${totalNew} nouvelles molécules ChEMBL collectées`, 'ok');

    // ── PHASE 2: PubChem CID matching ────────────────────────
    if (running) {
      log('📡 Phase 2/3 — Correspondance PubChem CID...', 'info');

      const db = await openDB();
      // Only match records that are STILL in CHEMBL: format (unmatched)
      const unmatched = await new Promise(resolve => {
        const results = [];
        const req = db.transaction(['molecules']).objectStore('molecules').openCursor();
        req.onsuccess = e => {
          const c = e.target.result;
          if (!c) { resolve(results); return; }
          if (String(c.value.pubchem_cid ?? '').startsWith('CHEMBL:') && c.value.nom_inn) results.push(c.value);
          c.continue();
        };
        req.onerror = () => resolve([]);
      });

      log(`📋 ${unmatched.length} molécules sans CID PubChem à apparier`, 'info');
      let matched = 0;

      for (let i = 0; i < unmatched.length; i++) {
        while (paused) await delay(500);
        if (!running) break;

        const rec = unmatched[i];
        try {
          const cid = await matchPubchemCID(rec.nom_inn);
          if (cid) {
            const [props] = await fetchPubchemBatch([cid]);
            const updated = {
              ...rec,
              pubchem_cid: cid,
              nom_iupac: props?.nom_iupac ?? rec.nom_iupac,
              formule_moleculaire: props?.formule_moleculaire ?? rec.formule_moleculaire,
              masse_moleculaire:   props?.masse_moleculaire ?? rec.masse_moleculaire,
              smiles:    props?.smiles   ?? rec.smiles,
              inchi:     props?.inchi,
              inchikey:  props?.inchikey,
              logp:      props?.logp  ?? rec.logp,
              tpsa:      props?.tpsa  ?? rec.tpsa,
              hbd:  props?.hbd,
              hba:  props?.hba,
              score_fiabilite: 95,
              source_principale: 'PubChem (NIH) + ChEMBL',
              pubchem_url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`
            };
            // Delete old CHEMBL: key, insert with real CID
            await new Promise(res => {
              const r = db.transaction(['molecules'], 'readwrite').objectStore('molecules').delete(rec.pubchem_cid);
              r.onsuccess = res; r.onerror = res;
            });
            await upsertMolecule(updated);
            processedCIDs.add(cid);
            matched++;
          }
        } catch (e) { /* skip single match failure */ }

        if (i % 25 === 0) {
          const pct = Math.round(i / unmatched.length * 100);
          emit({ phase: 2, phaseTotal: 3, phaseName: 'PubChem Match', collected: matched, total: unmatched.length, progress: pct });
          log(`[PubChem] ${i}/${unmatched.length} — ${matched} matchés (${pct}%)`, 'info');
        }
        await delay(220);
      }
      log(`✅ Phase 2 terminée — ${matched}/${unmatched.length} CIDs PubChem trouvés`, 'ok');
    }

    // ── PHASE 3: OpenFDA labels ───────────────────────────────
    if (running && collectFDA) {
      log('📡 Phase 3/3 — Labels OpenFDA (conditions stockage officielles)...', 'info');

      const db = await openDB();
      const needsFDA = await new Promise(resolve => {
        const results = [];
        const req = db.transaction(['molecules']).objectStore('molecules').openCursor();
        req.onsuccess = e => {
          const c = e.target.result;
          if (!c) { resolve(results); return; }
          const m = c.value;
          // Only molecules with real CID that don't yet have FDA data
          if (!String(m.pubchem_cid ?? '').startsWith('CHEMBL:') && !m.has_fda_data && m.nom_inn) results.push(m);
          c.continue();
        };
        req.onerror = () => resolve([]);
      });

      log(`📋 ${needsFDA.length} molécules sans label FDA`, 'info');
      let fdaFound = 0;

      for (let i = 0; i < needsFDA.length; i++) {
        while (paused) await delay(500);
        if (!running) break;

        const rec = needsFDA[i];
        try {
          const fdaData = await fetchFDALabel(rec.nom_inn);
          if (fdaData) {
            await upsertMolecule({
              ...rec,
              temperature_stockage: fdaData.temperature_stockage,
              conditions_stockage:  fdaData.conditions_speciales?.join(', ') ?? null,
              storage_text_fda:     fdaData.storage_text,
              forme_galenique:      fdaData.forme_galenique,
              fda_url:              fdaData.source_url,
              has_fda_data: true
            });
            fdaFound++;
          }
        } catch (e) { /* skip */ }

        if (i % 50 === 0) {
          const pct = Math.round(i / needsFDA.length * 100);
          emit({ phase: 3, phaseTotal: 3, phaseName: 'OpenFDA', collected: fdaFound, total: needsFDA.length, progress: pct });
          log(`[FDA] ${i}/${needsFDA.length} — ${fdaFound} labels trouvés (${pct}%)`, 'info');
        }
        await delay(220);
      }
      log(`✅ Phase 3 terminée — ${fdaFound} labels FDA officiels`, 'ok');
    }

    // ── Done: save next offset for future runs ────────────────
    await saveCollectionState({
      completed: true,
      completedAt: new Date().toISOString(),
      total_session: totalNew,
      next_chembl_offset: offset,        // ← KEY FIX: next run starts HERE
      processed_cids: [...processedCIDs]
    });

    emit({ phase: 3, phaseTotal: 3, phaseName: 'Terminé', collected: totalNew, total: totalNew, done: true });
    log(`🎉 Collecte terminée — ${totalNew} nouvelles molécules ajoutées (prochain démarrage depuis offset ${offset})`, 'ok');

    logAuditEntry({
      user: getSession()?.label ?? 'SYSTEM',
      department: getSession()?.department ?? 'system',
      sessionId: getSession()?.sessionId ?? 'N/A',
      action: `COLLECTION_COMPLETE — +${totalNew} mol. — offset ChEMBL: 0→${offset}`,
      result: 'SUCCESS',
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    log(`❌ Erreur fatale: ${err.message}`, 'error');
    console.error(err);
  } finally {
    running = false;
  }
}

export function stopCollection() {
  running = false;
  log('⏹ Collecte arrêtée manuellement', 'warn');
}

// resetOffset = true → repart de 0 (recollecte tout), false → efface seulement le verrou 'completed'
export async function resetCollection(resetOffset = false) {
  if (resetOffset) {
    await clearCollectionState();
    log('🗑 Base et offset réinitialisés — la prochaine collecte repart depuis offset 0', 'warn');
  } else {
    const state = await getCollectionState();
    if (state) {
      await saveCollectionState({ ...state, completed: false });
    }
    log('🔄 Verrou "terminé" supprimé — vous pouvez lancer une nouvelle collecte', 'info');
  }
}
