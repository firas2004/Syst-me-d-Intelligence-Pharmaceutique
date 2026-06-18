// ============================================================
// PHARMA-INTEL — Exports Module (Excel + PDF)
// ============================================================
import { getAllTables, getDrugInfo, getVersionHistory } from './database.js';
import { getAuditTrail, logAuditEntry, getSession } from './auth.js';
import { getChartAsBase64 } from './dashboard.js';
import { t } from './i18n.js';

const SIM_NOTE = 'DONNÉES SIMULÉES — Vérification manuelle requise';

// ─── Excel Export (SheetJS) ───────────────────────────────────
export function exportExcel() {
  const infoA = getDrugInfo('drugA');
  if (!infoA) return alert(t('common.no_data'));

  const wb = XLSX.utils.book_new();
  const slot = 'drugA';
  const tables = getAllTables(slot);
  const infoB = getDrugInfo('drugB');
  const tablesB = getAllTables('drugB');

  // Helper: create styled sheet from array-of-arrays
  function makeSheet(data) {
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = Array(20).fill({ wch: 22 });
    return ws;
  }

  // T1 — Molecules
  const t1 = tables.T1;
  const t1Data = [
    ['PHARMA-INTEL — TABLE 1: MOLÉCULES', '', '', 'Source: PubChem (NIH)', 'Fiabilité: 95%'],
    ['Paramètre', 'Drug A: ' + infoA.name, 'Flag', infoB ? 'Drug B: ' + infoB.name : '', infoB ? 'Flag' : ''],
    ['Nom INN', t1.inn, 'VERIFIED', tablesB?.T1?.inn ?? '—', tablesB ? 'VERIFIED' : ''],
    ['Nom IUPAC', t1.iupac, 'VERIFIED', tablesB?.T1?.iupac ?? '—', tablesB ? 'VERIFIED' : ''],
    ['Formule', t1.formula, 'VERIFIED', tablesB?.T1?.formula ?? '—', tablesB ? 'VERIFIED' : ''],
    ['MW (g/mol)', t1.mw, 'VERIFIED', tablesB?.T1?.mw ?? '—', tablesB ? 'VERIFIED' : ''],
    ['LogP', t1.logp, 'VERIFIED', tablesB?.T1?.logp ?? '—', tablesB ? 'VERIFIED' : ''],
    ['SMILES', t1.smiles, 'VERIFIED', tablesB?.T1?.smiles ?? '—', tablesB ? 'VERIFIED' : ''],
    ['PubChem CID', t1.cid, 'VERIFIED', tablesB?.T1?.cid ?? '—', tablesB ? 'VERIFIED' : ''],
    ['Mécanisme', t1.mechanism, SIM_NOTE, tablesB?.T1?.mechanism ?? '—', tablesB ? SIM_NOTE : ''],
    ['Biodisponibilité (%)', t1.bioavailability, SIM_NOTE, tablesB?.T1?.bioavailability ?? '—', tablesB ? SIM_NOTE : ''],
    ['Demi-vie', t1.halflife, SIM_NOTE, tablesB?.T1?.halflife ?? '—', tablesB ? SIM_NOTE : ''],
    ['Classe', t1.therapeuticClass, 'DERIVED', tablesB?.T1?.therapeuticClass ?? '—', tablesB ? 'DERIVED' : ''],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(t1Data), 'T1-Molécules');

  // T2 — Stability
  const t2 = tables.T2;
  const t2Data = [
    ['PHARMA-INTEL — TABLE 2: STABILITÉ', '', '', '', SIM_NOTE],
    ['Condition', 'Résultat', 'Dosage (%)', 'Durée de Vie', 'Emballage', 'Zone ICH', 'Conforme'],
    ...t2.conditions.map(c => [c.condition, c.result, c.assay, c.shelfLife, c.packaging, c.ichZone, c.compliant ? 'OUI' : 'NON'])
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(t2Data), 'T2-Stabilité');

  // T3 — Degradation
  const t3 = tables.T3;
  const t3Data = [
    ['PHARMA-INTEL — TABLE 3: DÉGRADATION FORCÉE', '', '', '', SIM_NOTE],
    ['Type Stress', 'Conditions', 'Taux (%)', 'Produits Identifiés', 'Méthode Analytique', 'ICH Conforme'],
    ...t3.stressTests.map(s => [s.type, s.conditions, s.rate, s.products, s.method, s.ichCompliant ? 'OUI' : 'NON'])
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(t3Data), 'T3-Dégradation');

  // T4 — Aging
  const t4 = tables.T4;
  const t4Data = [
    ['PHARMA-INTEL — TABLE 4: VIEILLISSEMENT (Temps Réel)', '', '', '', SIM_NOTE],
    ['Point Temporel', 'Dosage (%)', 'Impuretés (%)', 'pH', 'Dissolution (%)'],
    ...t4.realTime.timePoints.map(p => [`T${p.month} mois`, p.assay, p.impurities, p.ph, p.dissolution])
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(t4Data), 'T4-Vieillissement');

  // T5 — Synthesis
  const t5 = tables.T5;
  const t5Data = [
    ['PHARMA-INTEL — TABLE 5: SYNTHÈSE', '', '', '', SIM_NOTE],
    ['Route', 'Précurseurs', 'Rendement (%)', 'Coût €/g', 'Étapes', 'Faisabilité', 'Notes'],
    ...t5.routes.map(r => [r.name, r.precursors, r.yield, r.costPerGram, r.steps, r.feasibility, r.notes])
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(t5Data), 'T5-Synthèse');

  // T6 — Regulatory
  const t6 = tables.T6;
  const t6Data = [
    ['PHARMA-INTEL — TABLE 6: RÉGLEMENTAIRE', '', SIM_NOTE],
    ['DL50', t6.ld50], ['Classe WHO', t6.whoToxicityClass], ['CTD Module 3', t6.ctdModule3Status],
    [''], ['Pays', 'Statut', 'Agence', 'CTD Module'],
    ['Tunisie', t6.approvals.TN.status, t6.approvals.TN.agency, t6.approvals.TN.ctdModule],
    ['France', t6.approvals.FR.status, t6.approvals.FR.agency, t6.approvals.FR.ctdModule],
    ['Italie', t6.approvals.IT.status, t6.approvals.IT.agency, t6.approvals.IT.ctdModule],
    ['États-Unis', t6.approvals.USA.status, t6.approvals.USA.agency, t6.approvals.USA.ctdModule],
    [''], ['ICH Guideline', 'Exigence'],
    ...Object.entries(t6.ichGuidelines).map(([k, v]) => [k, v])
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(t6Data), 'T6-Réglementaire');

  // T7 — Excipients
  const t7 = tables.T7;
  const t7Data = [
    ['PHARMA-INTEL — TABLE 7: EXCIPIENTS', '', '', SIM_NOTE],
    ['Excipient', 'Compatible', 'Interaction', 'Ratio Recommandé', 'Attention'],
    ...t7.excipients.map(e => [e.name, e.compatible ? 'OUI' : 'NON', e.interaction, e.ratio, e.caution ? '⚠ CAUTION' : '—'])
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(t7Data), 'T7-Excipients');

  // Department summary sheets
  XLSX.utils.book_append_sheet(wb, makeSheet([
    ['RAPPORT R&D', infoA.name, new Date().toISOString()],
    ['CID', t1.cid], ['MW', t1.mw], ['LogP', t1.logp],
    ['Mécanisme (SIM)', t1.mechanism], ['Biodisponibilité (SIM)', t1.bioavailability + '%'],
    ['Synthèse recommandée', t5.recommendedRoute], ['Faisabilité scale-up', t5.scaleUpScore + '%']
  ]), 'R&D');

  XLSX.utils.book_append_sheet(wb, makeSheet([
    ['RAPPORT LOGISTIQUE', infoA.name, new Date().toISOString()],
    ['Condition stockage', '25°C / 60%RH'], ['Durée de vie', t2.conditions[0].shelfLife],
    ['Emballage', t2.conditions[0].packaging], ['Code ERP', `STOR-${infoA.name.toUpperCase().slice(0,6)}-A1`]
  ]), 'Logistique');

  XLSX.utils.book_append_sheet(wb, makeSheet([
    ['RAPPORT RÉGLEMENTAIRE', infoA.name, new Date().toISOString()],
    ['DL50 (SIM)', t6.ld50], ['WHO (SIM)', t6.whoToxicityClass],
    ['TN', t6.approvals.TN.status], ['FR', t6.approvals.FR.status],
    ['IT', t6.approvals.IT.status], ['USA', t6.approvals.USA.status]
  ]), 'Réglementaire');

  XLSX.utils.book_append_sheet(wb, makeSheet([
    ['RAPPORT QUALITÉ', infoA.name, new Date().toISOString()],
    ['Type', 'Taux %', 'Méthode', 'ICH'],
    ...t3.stressTests.map(s => [s.type, s.rate, s.method, s.ichCompliant ? 'OK' : 'NC'])
  ]), 'Qualité');

  XLSX.utils.book_append_sheet(wb, makeSheet([
    ['RAPPORT PRODUCTION', infoA.name, new Date().toISOString()],
    ['Excipient', 'Compat.', 'Ratio'],
    ...t7.excipients.map(e => [e.name, e.compatible ? 'OUI' : 'NON', e.ratio])
  ]), 'Production');

  XLSX.utils.book_append_sheet(wb, makeSheet([
    ['RAPPORT FINANCE', infoA.name, new Date().toISOString()],
    ['Route', 'Coût €/g', 'Rendement %'],
    ...t5.routes.map(r => [r.name, r.costPerGram, r.yield])
  ]), 'Finance');

  // Audit trail sheet
  const audit = getAuditTrail().slice(0, 100);
  const auditData = [
    ['AUDIT TRAIL GMP', '', '', '', new Date().toISOString()],
    ['Horodatage', 'Département', 'Utilisateur', 'Action', 'Résultat', 'Session ID'],
    ...audit.map(e => [e.timestamp, e.department, e.user, e.action, e.result, e.sessionId])
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(auditData), 'Audit Trail');

  const filename = `PHARMA-INTEL_${infoA.name}_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, filename);

  logAuditEntry({ user: getSession()?.label ?? 'SYSTEM', department: getSession()?.department ?? 'system', sessionId: getSession()?.sessionId ?? 'N/A', action: `EXPORT_EXCEL — ${filename}`, result: '14 sheets generated', timestamp: new Date().toISOString() });
}

// ─── PDF Export (jsPDF) ───────────────────────────────────────
export async function exportPDF() {
  const infoA = getDrugInfo('drugA');
  if (!infoA) return alert(t('common.no_data') || "Aucune donnée à exporter.");

  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("Erreur: La librairie PDF n'a pas pu se charger.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const tables = getAllTables('drugA');
  
  // Charte Documentaire (Fond blanc)
  const RED = [192, 39, 45];        // #C0272D (Rouge Opalia)
  const TEXT_DARK = [30, 30, 30];   // Noir/Gris très foncé pour les textes
  const TEXT_LIGHT = [255, 255, 255]; // Blanc
  const GREY = [120, 120, 120];

  // 1. Charger et convertir le Logo SVG en Base64 PNG pour jsPDF
  let logoBase64 = null;
  try {
    const svgRes = await fetch('assets/recordati-logo.svg');
    if (svgRes.ok) {
      const svgText = await svgRes.text();
      const img = new Image();
      const svgDataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgText);
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
        img.src = svgDataUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.width || 300;
      canvas.height = img.height || 80;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      logoBase64 = canvas.toDataURL('image/png');
    }
  } catch (e) {
    console.warn("Logo non chargé, utilisation du texte à la place.", e);
  }

  // ════ PAGE 1 : COUVERTURE ════
  // Fond blanc pur par défaut dans jsPDF
  
  // Logo en haut à gauche
  if (logoBase64 && logoBase64.length > 50) {
    doc.addImage(logoBase64, 'PNG', 14, 20, 80, 22); // Logo grand format
  } else {
    doc.setTextColor(...RED);
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.text('OPALIA RECORDATI', 14, 30);
  }

  // Titres du document (centrés)
  doc.setTextColor(...TEXT_DARK);
  doc.setFontSize(32);
  doc.text('RAPPORT D\'INTELLIGENCE', 105, 110, { align: 'center' });
  doc.text('PHARMACEUTIQUE', 105, 125, { align: 'center' });
  
  // Nom de la Molécule
  doc.setFontSize(22);
  doc.setTextColor(...RED);
  doc.text(infoA.name.toUpperCase(), 105, 150, { align: 'center' });
  
  // Méta-données
  doc.setFontSize(11);
  doc.setTextColor(...GREY);
  doc.setFont('helvetica', 'normal');
  const t1 = tables.T1;
  doc.text(`CID PubChem: ${t1?.cid || 'N/A'} | Formule: ${t1?.formula || 'N/A'} | MW: ${t1?.mw || 'N/A'} g/mol`, 105, 165, { align: 'center' });
  
  doc.text(`Généré le : ${new Date().toLocaleString('fr-FR')}`, 105, 230, { align: 'center' });
  doc.text('CONFIDENTIEL — Usage interne Opalia Recordati uniquement', 105, 240, { align: 'center' });

  // ════ PAGE 2 : SOMMAIRE ════
  doc.addPage();
  doc.setTextColor(...TEXT_DARK);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(`Sommaire — ${infoA.name}`, 14, 30);
  
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  const sommaire = [
    "1. Profil Moléculaire (Table 1)",
    "2. Données de Stabilité & Stockage (Table 2)",
    "3. Études de Dégradation Forcée (Table 3)",
    "4. Études de Vieillissement (Table 4)",
    "5. Voies de Synthèse (Table 5)",
    "6. Réglementaire & Sécurité (Table 6)",
    "7. Compatibilité Excipients (Table 7)",
    "8. Rapports par Départements (R&D, Logistique, Qualité, Production, Finance)",
    "9. Audit Trail GMP"
  ];
  let ySommaire = 45;
  sommaire.forEach(item => {
    doc.text(item, 20, ySommaire);
    ySommaire += 12;
  });

  // Helper pour générer les tables de manière fluide sans forcer l'ajout de pages
  doc.addPage(); // Démarrer le contenu sur la page 3
  
  function createTable(title, head, body, themeColor=RED) {
    // Calculer la position Y, si doc.lastAutoTable existe, on prend sa fin + espacement
    let startY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 15 : 25;
    
    // Si la position est trop basse, on passe manuellement à la page suivante
    if (startY > 250) {
      doc.addPage();
      startY = 25;
    }

    doc.setTextColor(...TEXT_DARK);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, startY);

    doc.autoTable({
      startY: startY + 4,
      theme: 'grid',
      headStyles: { fillColor: themeColor, textColor: TEXT_LIGHT, fontStyle: 'bold' },
      bodyStyles: { textColor: [40, 40, 40], fontSize: 9 },
      alternateRowStyles: { fillColor: [245, 247, 250] }, // Alternance très douce
      head: head,
      body: body,
      margin: { top: 25, bottom: 25 } // Marge pour l'en-tête et pied de page
    });
  }

  // ════ TABLES T1 à T7 (Flux continu) ════
  createTable('1. Profil Moléculaire (T1)', [['Paramètre', 'Valeur', 'Source']], [
    ['Nom INN', t1?.inn || '', 'PubChem'],
    ['IUPAC', t1?.iupac ? t1.iupac.substring(0,60)+'...' : '', 'PubChem'],
    ['Formule', t1?.formula || '', 'PubChem'],
    ['MW', (t1?.mw || '') + ' g/mol', 'PubChem'],
    ['LogP', t1?.logp || '', 'PubChem'],
    ['CID', t1?.cid || '', 'PubChem'],
    ['Mécanisme', t1?.mechanism || '', 'SIMULÉ'],
    ['Biodisponibilité', (t1?.bioavailability || '') + '%', 'SIMULÉ'],
    ['Demi-vie', t1?.halflife || '', 'SIMULÉ'],
    ['Classe Thérapeutique', t1?.therapeuticClass || '', 'DÉRIVÉ']
  ]);

  const t2 = tables.T2;
  createTable('2. Stabilité & Stockage (T2)', [['Condition', 'Résultat', 'Dosage', 'Durée', 'Emballage', 'Conforme']], 
    t2?.conditions?.map(c => [c.condition, c.result, c.assay+'%', c.shelfLife, c.packaging, c.compliant ? 'OUI' : 'NON']) || []
  );

  const t3 = tables.T3;
  createTable('3. Dégradation Forcée (T3)', [['Stress', 'Conditions', 'Taux %', 'Produits', 'Méthode', 'ICH']], 
    t3?.stressTests?.map(s => [s.type, s.conditions, s.rate, s.products, s.method, s.ichCompliant ? 'OK' : 'NC']) || []
  );

  const t4 = tables.T4;
  createTable('4. Vieillissement (T4)', [['Mois', 'Dosage %', 'Impuretés %', 'pH', 'Dissolution %']], 
    t4?.realTime?.timePoints?.map(p => [`T${p.month}`, p.assay, p.impurities, p.ph, p.dissolution]) || []
  );

  const t5 = tables.T5;
  createTable('5. Voies de Synthèse (T5)', [['Route', 'Rendement %', 'Coût €/g', 'Étapes', 'Faisabilité']], 
    t5?.routes?.map(r => [r.name, r.yield, r.costPerGram, r.steps, r.feasibility]) || []
  );

  const t6 = tables.T6;
  const t6Data = [
    ['DL50', t6?.ld50 || ''], ['Classe Toxico', t6?.whoToxicityClass || ''],
    ['Tunisie', t6?.approvals?.TN?.status || ''],
    ['France', t6?.approvals?.FR?.status || ''],
    ['USA', t6?.approvals?.USA?.status || '']
  ];
  createTable('6. Réglementaire & Sécurité (T6)', [['Paramètre / Pays', 'Valeur / Statut']], t6Data);

  const t7 = tables.T7;
  createTable('7. Compatibilité Excipients (T7)', [['Excipient', 'Compatible', 'Interaction', 'Ratio']], 
    t7?.excipients?.map(e => [e.name, e.compatible ? 'OUI' : 'NON', e.interaction, e.ratio]) || []
  );

  // ════ RAPPORTS PAR DÉPARTEMENTS ════
  const depts = [
    { title: 'Rapport R&D', data: [['Mécanisme', t1?.mechanism], ['Biodisponibilité', t1?.bioavailability+'%'], ['Synthèse Rec.', t5?.recommendedRoute]] },
    { title: 'Rapport Logistique', data: [['Conditions Idéales', '25°C / 60%RH'], ['Durée de vie', t2?.conditions?.[0]?.shelfLife], ['Emballage', t2?.conditions?.[0]?.packaging]] },
    { title: 'Rapport Qualité', data: [['Tests Dégradation', (t3?.stressTests?.length || 0) + ' effectués'], ['Conformité', 'Voir Rapport T3 (ICH Q1B)']] },
    { title: 'Rapport Production', data: [['Excipients validés', t7?.excipients?.filter(e=>e.compatible).length || 0], ['Faisabilité Scale-up', t5?.scaleUpScore+'%']] },
    { title: 'Rapport Finance', data: [['Route optimale', t5?.routes?.[0]?.name], ['Coût estimé', t5?.routes?.[0]?.costPerGram + ' €/g']] }
  ];

  depts.forEach(d => {
    // Gris foncé pour différencier les tableaux de départements
    createTable(`8. ${d.title}`, [['Métrique Clé', 'Valeur / Résultat']], d.data, [80, 80, 80]); 
  });

  // ════ AUDIT TRAIL ════
  const audit = getAuditTrail().slice(0, 30);
  createTable('9. Audit Trail GMP', [['Date', 'Département', 'Action']], 
    audit.map(e => [e.timestamp?.substring(0,16).replace('T',' '), e.department, e.action.substring(0,60)]),
    [40, 40, 40]
  );

  // ════ INJECTION GLOBALE DES EN-TÊTES ET PIEDS DE PAGE ════
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    
    // Pied de page sur TOUTES les pages
    doc.setTextColor(...GREY);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`PHARMA-INTEL v3.0 — Confidentiel Opalia Recordati`, 14, 290);
    doc.text(`Page ${i} / ${totalPages}`, 196, 290, { align: 'right' });

    // En-tête sur toutes les pages SAUF la couverture (page 1)
    if (i > 1) {
      if (logoBase64 && logoBase64.length > 50) {
        doc.addImage(logoBase64, 'PNG', 14, 8, 35, 9); // Logo miniature
      } else {
        doc.setTextColor(...RED);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('OPALIA RECORDATI', 14, 14);
      }
      
      doc.setTextColor(...GREY);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(new Date().toLocaleDateString('fr-FR'), 196, 14, { align: 'right' });
      
      // Ligne séparatrice fine rouge
      doc.setDrawColor(...RED);
      doc.setLineWidth(0.4);
      doc.line(14, 19, 196, 19);
    }
  }

  // ════ SAUVEGARDE & TÉLÉCHARGEMENT ════
  const filename = `PHARMA-INTEL_v3_${infoA.name}_${new Date().toISOString().slice(0,10)}.pdf`;
  doc.save(filename);

  logAuditEntry({ 
    user: getSession()?.label || 'SYSTEM', 
    department: getSession()?.department || 'system', 
    sessionId: getSession()?.sessionId || 'N/A', 
    action: `EXPORT_PDF — ${filename}`, 
    result: `${totalPages} pages générées`, 
    timestamp: new Date().toISOString() 
  });
}

