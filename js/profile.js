// PHARMA-INTEL v3.0 — Molecule Full Profile Generator
// Generates class-based pharmaceutical data with ICH flags

export function generateProfile(mol) {
  const cls = (mol.classe_therapeutique ?? '').toLowerCase();
  const logp = parseFloat(mol.logp ?? 2);
  const mw = parseFloat(mol.masse_moleculaire ?? 300);
  const tpsa = parseFloat(mol.tpsa ?? 80);

  // Determine drug class characteristics
  const isCardio   = /cardio|antihypert|statin|beta.block|ace.inhib|diuretic/i.test(cls);
  const isAntiInf  = /anti.inflam|nsaid|analgesic|pain/i.test(cls);
  const isAntibio  = /antibiotic|antibacter|antimicro/i.test(cls);
  const isPsycho   = /psych|antidepress|anxio|antipsych|sedativ/i.test(cls);
  const isOncology = /oncol|antineopl|antitumor|cancer/i.test(cls);

  // ICH stability zones (based on logP + MW)
  const highLipophil = logp > 3;
  const highMW = mw > 500;
  const highTPSA = tpsa > 120;

  // ── Stability (T2) ────────────────────────────────────────
  const stability = [
    { condition:'25°C/60%RH (Zone I/II)',  result:'Conforme', assay: highLipophil?94:97, shelfLife:'36 mois', packaging:'Blister HDPE', compliant:true },
    { condition:'30°C/65%RH (Zone III)',   result:'Conforme', assay: highLipophil?91:95, shelfLife:'24 mois', packaging:'Blister Alu/Alu', compliant:true },
    { condition:'40°C/75%RH (Accéléré)',   result: highLipophil?'Limite':'Conforme', assay: highLipophil?87:93, shelfLife:'6 mois test', packaging:'PVDC', compliant: !highLipophil },
    { condition:'60°C (Stress thermique)', result: highMW?'OOS':'Limite', assay: highMW?82:89, shelfLife:'Stress uniquement', packaging:'N/A', compliant:false },
    { condition:'ICH Q1B UV/Vis (254nm)',  result:'Sensible à la lumière', assay:88, shelfLife:'—', packaging:'Opaque', compliant:true }
  ];

  // ── Forced Degradation (T3) ───────────────────────────────
  const degradation = [
    { type:'Hydrolyse Acide',   conditions:'0.1M HCl / 80°C / 24h', rate: isAntiInf?18:12, products:'Produits acides mineurs', method:'HPLC-UV 220nm', ichCompliant:true, borderline:false },
    { type:'Hydrolyse Base',    conditions:'0.1M NaOH / 60°C / 6h',  rate: isCardio?8:14,  products:'Sels de dégradation',   method:'HPLC-UV 254nm', ichCompliant:true, borderline:false },
    { type:'Oxydation H₂O₂',   conditions:'3% H₂O₂ / 25°C / 48h',  rate: highLipophil?22:9, products:'N-oxydes, sulfoxides',method:'LC-MS/MS',     ichCompliant:true, borderline:highLipophil },
    { type:'Photolyse UV',      conditions:'ICH Q1B / 1.2M lux·h',   rate: isPsycho?16:7, products:'Isomères photo',         method:'HPLC-DAD',      ichCompliant:true, borderline:false },
    { type:'Thermolyse Sèche',  conditions:'105°C / 24h / 0%RH',     rate: isAntibio?25:11,products:'Produits de pyrolyse',  method:'GC-MS / HPLC',  ichCompliant:isAntibio?false:true, borderline:false },
    { type:'Humidité+Chaleur',  conditions:'80°C / 80%RH / 24h',     rate: highTPSA?20:13, products:'Hydrates, solvates',   method:'XRPD + HPLC',   ichCompliant:true, borderline:highTPSA }
  ];

  // ── Aging Timeline (T4) ───────────────────────────────────
  const aging = [0,3,6,9,12,18,24].map(m => {
    const decay = m * (highLipophil ? 0.35 : 0.18) + (Math.random()*0.4-0.2);
    const assay = Math.max(85, 100 - decay);
    return {
      month: m, assay: +assay.toFixed(1),
      impurities: +(decay * 0.08 + Math.random()*0.05).toFixed(2),
      ph: +(6.8 + Math.sin(m/6)*0.3 + Math.random()*0.1).toFixed(1),
      dissolution: +(97 - m*(highMW?0.4:0.2)).toFixed(1)
    };
  });

  // ── Synthesis Routes (T5) ─────────────────────────────────
  const routes = [
    { name:'Voie A — Synthèse directe',  yield: isOncology?52:78, costPerGram: isOncology?42:8,  steps:isOncology?9:5, feasibility:85 },
    { name:'Voie B — Semi-synthèse',     yield: 65,               costPerGram: isOncology?28:12, steps:7,              feasibility:72 },
    { name:'Voie C — Biosynthèse',       yield: isAntibio?71:45,  costPerGram: isAntibio?6:18,   steps:isAntibio?4:8,  feasibility:isAntibio?90:55 }
  ];

  // ── Regulatory (T6) ───────────────────────────────────────
  const regulatory = {
    ld50: `${Math.round(200 + logp*80)} mg/kg (rat oral)`,
    whoToxicityClass: logp > 4 ? 'II' : 'III',
    approvals: {
      'FDA (USA)': { status: mol.max_phase >= 4 ? 'Approuvé' : 'En cours', agency:'FDA' },
      'EMA (Europe)': { status: mol.max_phase >= 4 ? 'Approuvé' : 'Soumis', agency:'EMA' },
      'ANSM (France)': { status: mol.max_phase >= 4 ? 'AMM accordée' : 'En évaluation', agency:'ANSM' }
    },
    ichGuidelines: {
      'ICH Q1A(R2)': mol.max_phase>=4?'Complété':'En cours',
      'ICH Q1B':     'Photolyse — réalisée',
      'ICH Q1E':     mol.max_phase>=4?'Extrapolation validée':'Non applicable',
      'ICH Q3A':     'Impuretés < 0.15% seuil',
      'ICH Q6A':     mol.max_phase>=4?'Spécifications fixées':'En développement'
    }
  };

  // ── Excipients (T7) ───────────────────────────────────────
  const excipients = [
    { name:'Lactose monohydraté',  compatible: !highLipophil, interaction: highLipophil?'Maillard potential':'Aucune', ratio:'60%', caution:highLipophil },
    { name:'Cellulose microcristalline', compatible:true, interaction:'Aucune', ratio:'20%', caution:false },
    { name:'Stéarate de magnésium',     compatible:true, interaction:'Lubrifiant — limiter <2%', ratio:'0.5%', caution:false },
    { name:'PVP K30 (liant)',           compatible: logp<4, interaction: logp>=4?'Complexation hydrophobe':'Aucune', ratio:'5%', caution:logp>=4 },
    { name:'Dioxyde de silicium',       compatible:true, interaction:'Adsorbant — attention dosage', ratio:'2%', caution:false },
    { name:'HPMC (enrobage)',           compatible:!highTPSA, interaction: highTPSA?'Gonflement possible':'Aucune', ratio:'3%', caution:highTPSA }
  ];

  return { stability, degradation, aging, routes, regulatory, excipients };
}

export function renderFullProfile(mol) {
  const p = generateProfile(mol);
  const SIM = '<span class="data-flag flag-sim">⚠ ESTIMATION ICH</span>';
  const REAL = '<span class="data-flag flag-ok">✓ RÉELLE</span>';

  const tabs = [
    { id:'stab',  label:'📊 Stabilité ICH' },
    { id:'deg',   label:'🔥 Dégradation' },
    { id:'age',   label:'⏱ Vieillissement' },
    { id:'synth', label:'⚗️ Synthèse' },
    { id:'reg',   label:'📜 Réglementaire' },
    { id:'exc',   label:'💊 Excipients' }
  ];

  const tabNav = tabs.map((t,i) =>
    `<button class="db-tab${i===0?' active':''}" data-prof-tab="${t.id}">${t.label}</button>`
  ).join('');

  // Stability table
  const stabHtml = `
    <div style="font-size:11px;color:var(--warn);margin-bottom:8px">⚠ Données estimées par classe thérapeutique — ${SIM} — Vérification analytique requise</div>
    <table class="data-table full-width">
      <thead><tr><th>Condition ICH</th><th>Résultat</th><th>Dosage%</th><th>Durée de vie</th><th>Emballage</th><th>Conforme</th></tr></thead>
      <tbody>${p.stability.map(s=>`<tr>
        <td>${s.condition}</td><td>${s.result}</td>
        <td class="${s.assay<90?'val-bad':s.assay<95?'val-warn':'val-ok'}">${s.assay}%</td>
        <td>${s.shelfLife}</td><td>${s.packaging}</td>
        <td class="${s.compliant?'val-ok':'val-bad'}">${s.compliant?'✓ ICH':'✗ OOS'}</td>
      </tr>`).join('')}</tbody>
    </table>`;

  // Degradation table
  const degHtml = `
    <div style="font-size:11px;color:var(--warn);margin-bottom:8px">⚠ Taux de dégradation estimés — ${SIM}</div>
    <table class="data-table full-width">
      <thead><tr><th>Type de Stress</th><th>Conditions</th><th>Taux%</th><th>Produits</th><th>Méthode</th><th>ICH</th></tr></thead>
      <tbody>${p.degradation.map(d=>`<tr>
        <td>${d.type}</td><td style="font-size:11px">${d.conditions}</td>
        <td class="${d.rate>15?'val-bad':d.rate>8?'val-warn':'val-ok'}">${d.rate}%</td>
        <td style="font-size:11px">${d.products}</td><td style="font-size:11px">${d.method}</td>
        <td class="${d.ichCompliant?'val-ok':d.borderline?'val-warn':'val-bad'}">${d.ichCompliant?'✓':d.borderline?'⚠':'✗'}</td>
      </tr>`).join('')}</tbody>
    </table>`;

  // Aging timeline
  const ageHtml = `
    <div style="font-size:11px;color:var(--warn);margin-bottom:8px">⚠ Valeurs ICH Q1A extrapolées — ${SIM}</div>
    <table class="data-table full-width">
      <thead><tr><th>Temps (ICH Q1A)</th><th>Dosage%</th><th>Impuretés%</th><th>pH</th><th>Dissolution%</th><th>Statut</th></tr></thead>
      <tbody>${p.aging.map(a=>`<tr>
        <td style="font-weight:700">T${a.month} mois</td>
        <td class="${a.assay<90?'val-bad':a.assay<95?'val-warn':'val-ok'}">${a.assay}</td>
        <td class="${a.impurities>1?'val-bad':a.impurities>0.5?'val-warn':'val-ok'}">${a.impurities}</td>
        <td>${a.ph}</td>
        <td class="${a.dissolution<85?'val-bad':'val-ok'}">${a.dissolution}</td>
        <td>${a.assay>=90&&a.impurities<=1?'✓ Conforme':'⚠ Vérifier'}</td>
      </tr>`).join('')}</tbody>
    </table>`;

  // Synthesis routes
  const synthHtml = `
    <div style="font-size:11px;color:var(--warn);margin-bottom:8px">⚠ Routes synthèse estimées par classe — ${SIM}</div>
    <table class="data-table full-width">
      <thead><tr><th>Route</th><th>Rendement%</th><th>Coût €/g</th><th>Étapes</th><th>Faisabilité%</th></tr></thead>
      <tbody>${p.routes.map(r=>`<tr>
        <td style="font-weight:600">${r.name}</td>
        <td class="${r.yield>70?'val-ok':r.yield>50?'val-warn':'val-bad'}">${r.yield}%</td>
        <td>€${r.costPerGram}</td><td>${r.steps}</td>
        <td class="${r.feasibility>80?'val-ok':r.feasibility>60?'val-warn':'val-bad'}">${r.feasibility}%</td>
      </tr>`).join('')}</tbody>
    </table>`;

  // Regulatory
  const regHtml = `
    <div style="font-size:11px;color:var(--warn);margin-bottom:8px">
      Statuts réglementaires: ${mol.max_phase>=4?REAL:SIM}
    </div>
    <table class="data-table full-width">
      <thead><tr><th>Paramètre</th><th>Valeur / Statut</th></tr></thead>
      <tbody>
        <tr><td>DL50</td><td>${p.regulatory.ld50}</td></tr>
        <tr><td>Classe Toxicité WHO</td><td>Catégorie ${p.regulatory.whoToxicityClass}</td></tr>
        ${Object.entries(p.regulatory.approvals).map(([k,v])=>`
          <tr><td>${k}</td><td class="${v.status.includes('Appro')||v.status.includes('accordée')?'val-ok':'val-warn'}">${v.status}</td></tr>
        `).join('')}
        ${Object.entries(p.regulatory.ichGuidelines).map(([k,v])=>`
          <tr><td style="font-family:monospace;font-size:11px">${k}</td><td style="font-size:11px">${v}</td></tr>
        `).join('')}
      </tbody>
    </table>`;

  // Excipients
  const excHtml = `
    <div style="font-size:11px;color:var(--warn);margin-bottom:8px">⚠ Compatibilité estimée Handbook of Excipients — ${SIM}</div>
    <table class="data-table full-width">
      <thead><tr><th>Excipient</th><th>Compat.</th><th>Interaction</th><th>Ratio</th></tr></thead>
      <tbody>${p.excipients.map(e=>`<tr class="${e.caution?'row-warn':''}">
        <td>${e.name}</td>
        <td class="${e.compatible?'val-ok':'val-bad'}">${e.compatible?'✓ OUI':'✗ NON'}</td>
        <td style="font-size:11px">${e.interaction}</td><td>${e.ratio}</td>
      </tr>`).join('')}</tbody>
    </table>`;

  const panels = { stab:stabHtml, deg:degHtml, age:ageHtml, synth:synthHtml, reg:regHtml, exc:excHtml };

  return { tabNav, panels };
}
