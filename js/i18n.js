// ============================================================
// PHARMA-INTEL — i18n Module (FR/EN)
// ============================================================

const TRANSLATIONS = {
  fr: {
    'app.title': 'PHARMA-INTEL', 'app.subtitle': 'Système d\'Intelligence Pharmaceutique', 'app.gmp': 'Conforme GMP',
    'auth.title': 'Accès Sécurisé GMP', 'auth.department': 'Département', 'auth.password': 'Mot de passe',
    'auth.login': 'Se connecter', 'auth.error': 'Mot de passe incorrect', 'auth.select': '— Sélectionner —',
    'auth.session': 'Session ouverte', 'auth.logout': 'Déconnexion',
    'dept.rd': 'R&D', 'dept.logistique': 'Logistique', 'dept.reglementaire': 'Réglementaire',
    'dept.qualite': 'Qualité', 'dept.production': 'Production', 'dept.finance': 'Finance', 'dept.admin': 'Admin',
    'nav.dashboard': 'Tableau de Bord', 'nav.search': 'Recherche', 'nav.database': 'Base de Données',
    'nav.reports': 'Rapports', 'nav.ai': 'Intelligence IA', 'nav.exports': 'Exports',
    'nav.audit': 'Audit Trail', 'nav.assistant': 'Assistant IA',
    'search.title': 'Recherche de Molécule', 'search.drug_a': 'Drug A (Référence)',
    'search.drug_b': 'Drug B (Candidat)', 'search.placeholder': 'Nom du médicament (ex: Aspirin, Metformin...)',
    'search.btn': 'Rechercher sur PubChem', 'search.loading': 'Interrogation PubChem en cours...',
    'search.success': 'Données récupérées — Source: PubChem (NIH)',
    'search.error': 'Molécule introuvable sur PubChem', 'search.no_query': 'Veuillez entrer un nom de molécule',
    'search.loaded': 'Chargé', 'search.not_loaded': 'Non chargé',
    'table.t1': 'Molécules', 'table.t2': 'Stabilité', 'table.t3': 'Dégradation Forcée',
    'table.t4': 'Vieillissement', 'table.t5': 'Synthèse', 'table.t6': 'Réglementaire', 'table.t7': 'Excipients',
    'flag.verified': '✓ VÉRIFIÉ', 'flag.simulated': '⚠ DONNÉES SIMULÉES — Vérification manuelle requise',
    'flag.missing': '✗ DONNÉE MANQUANTE', 'flag.conflict': '⚡ CONFLIT DÉTECTÉ',
    'flag.pubchem': 'Source: PubChem (NIH) — Fiabilité 95%',
    'dash.heatmap': 'Heatmap de Stabilité', 'dash.degradation': 'Dégradation par Type de Stress',
    'dash.aging': 'Timeline Vieillissement T0 → T24 mois', 'dash.risk': 'Matrice de Risque',
    'dash.kpi_shelf': 'Durée de Vie', 'dash.kpi_risk': 'Risque Dégradation',
    'dash.kpi_sources': 'Sources Citées', 'dash.kpi_version': 'Version DB',
    'dash.months': 'mois', 'dash.no_data': 'Chargez une molécule pour afficher le tableau de bord',
    'ai.comparator': 'Comparateur Drug A vs B', 'ai.prediction': 'Prédiction de Dégradation IA',
    'ai.alerts': 'Alertes Temps Réel', 'ai.conflicts': 'Conflits Détectés',
    'ai.score': 'Score de Similarité', 'ai.confidence': 'Confiance IA',
    'ai.run_prediction': 'Lancer la Prédiction', 'ai.temperature': 'Température (°C)',
    'ai.humidity': 'Humidité (%RH)', 'ai.duration': 'Durée (mois)',
    'export.excel': 'Exporter Excel (14 onglets)', 'export.pdf': 'Exporter PDF Recordati',
    'export.both': 'Exporter Excel + PDF', 'export.generating': 'Génération en cours...',
    'export.done': 'Export terminé avec succès', 'export.audit_logged': 'Enregistré dans l\'Audit Trail',
    'assistant.title': 'Assistant Pharmaceutique IA', 'assistant.placeholder': 'Question sur la molécule chargée...',
    'assistant.send': 'Envoyer', 'assistant.config_api': 'Configurer Clé API',
    'assistant.api_label': 'Clé API (OpenAI sk-... ou Gemini AIza...)',
    'assistant.save_key': 'Enregistrer', 'assistant.thinking': 'Analyse en cours...',
    'assistant.no_molecule': 'Veuillez d\'abord charger une molécule (Drug A).',
    'assistant.no_key': 'Veuillez configurer votre clé API.',
    'audit.title': 'Audit Trail GMP', 'audit.user': 'Utilisateur', 'audit.dept': 'Département',
    'audit.action': 'Action', 'audit.timestamp': 'Horodatage', 'audit.result': 'Résultat',
    'audit.session': 'Session ID', 'audit.clear': 'Effacer l\'historique',
    'common.drug_a': 'Drug A', 'common.drug_b': 'Drug B', 'common.vs': 'vs',
    'common.no_data': 'Aucune donnée. Recherchez une molécule.', 'common.loading': 'Chargement...',
    'common.validate': '✓ Valider', 'common.reject': '✗ Rejeter', 'common.annotate': '✏ Annoter',
    'common.save': 'Enregistrer', 'common.cancel': 'Annuler', 'common.close': 'Fermer',
    'common.reliability': 'Fiabilité', 'common.source': 'Source', 'common.version': 'Version',
    'mol.inn': 'Nom INN', 'mol.iupac': 'Nom IUPAC', 'mol.cas': 'N° CAS', 'mol.formula': 'Formule',
    'mol.smiles': 'SMILES', 'mol.mw': 'Masse Mol. (g/mol)', 'mol.mechanism': 'Mécanisme d\'Action',
    'mol.bioavailability': 'Biodisponibilité (%)', 'mol.halflife': 'Demi-vie', 'mol.logp': 'LogP',
    'mol.class': 'Classe Thérapeutique', 'mol.cid': 'PubChem CID',
    'stab.condition': 'Condition', 'stab.temp': 'Température', 'stab.rh': '%RH', 'stab.light': 'Lumière',
    'stab.result': 'Résultat', 'stab.shelf': 'Durée de Vie', 'stab.packaging': 'Emballage',
    'deg.type': 'Type Stress', 'deg.conditions': 'Conditions', 'deg.products': 'Produits Identifiés',
    'deg.method': 'Méthode', 'deg.rate': 'Taux (%)', 'deg.ich': 'Conformité ICH',
    'age.type': 'Type Étude', 'age.zone': 'Zone ICH', 'age.timepoint': 'Point Temporel',
    'age.assay': 'Dosage (%)', 'age.impurities': 'Impuretés (%)', 'age.ph': 'pH', 'age.dissolution': 'Dissolution (%)',
    'reg.ld50': 'DL50', 'reg.who': 'Classe WHO', 'reg.countries': 'Pays Approuvés', 'reg.ctd': 'CTD Module 3',
    'exc.excipient': 'Excipient', 'exc.compat': 'Compatibilité', 'exc.interaction': 'Interaction', 'exc.ratio': 'Ratio',
    'rep.rd_title': 'Rapport R&D', 'rep.log_title': 'Rapport Logistique', 'rep.reg_title': 'Rapport Réglementaire',
    'rep.qual_title': 'Rapport Qualité', 'rep.prod_title': 'Rapport Production', 'rep.fin_title': 'Rapport Finance',
  },
  en: {
    'app.title': 'PHARMA-INTEL', 'app.subtitle': 'Pharmaceutical Intelligence System', 'app.gmp': 'GMP Compliant',
    'auth.title': 'GMP Secure Access', 'auth.department': 'Department', 'auth.password': 'Password',
    'auth.login': 'Login', 'auth.error': 'Incorrect password', 'auth.select': '— Select —',
    'auth.session': 'Session open', 'auth.logout': 'Logout',
    'dept.rd': 'R&D', 'dept.logistique': 'Logistics', 'dept.reglementaire': 'Regulatory',
    'dept.qualite': 'Quality', 'dept.production': 'Production', 'dept.finance': 'Finance', 'dept.admin': 'Admin',
    'nav.dashboard': 'Dashboard', 'nav.search': 'Search', 'nav.database': 'Database',
    'nav.reports': 'Reports', 'nav.ai': 'AI Intelligence', 'nav.exports': 'Exports',
    'nav.audit': 'Audit Trail', 'nav.assistant': 'AI Assistant',
    'search.title': 'Molecule Search', 'search.drug_a': 'Drug A (Reference)',
    'search.drug_b': 'Drug B (Candidate)', 'search.placeholder': 'Drug name (e.g. Aspirin, Metformin...)',
    'search.btn': 'Search PubChem', 'search.loading': 'Querying PubChem...',
    'search.success': 'Data retrieved — Source: PubChem (NIH)',
    'search.error': 'Molecule not found on PubChem', 'search.no_query': 'Please enter a molecule name',
    'search.loaded': 'Loaded', 'search.not_loaded': 'Not loaded',
    'table.t1': 'Molecules', 'table.t2': 'Stability', 'table.t3': 'Forced Degradation',
    'table.t4': 'Aging Study', 'table.t5': 'Synthesis', 'table.t6': 'Regulatory', 'table.t7': 'Excipients',
    'flag.verified': '✓ VERIFIED', 'flag.simulated': '⚠ SIMULATED DATA — Manual verification required',
    'flag.missing': '✗ MISSING DATA', 'flag.conflict': '⚡ CONFLICT DETECTED',
    'flag.pubchem': 'Source: PubChem (NIH) — Reliability 95%',
    'dash.heatmap': 'Stability Heatmap', 'dash.degradation': 'Degradation by Stress Type',
    'dash.aging': 'Aging Timeline T0 → T24 months', 'dash.risk': 'Risk Matrix',
    'dash.kpi_shelf': 'Shelf Life', 'dash.kpi_risk': 'Degradation Risk',
    'dash.kpi_sources': 'Sources Cited', 'dash.kpi_version': 'DB Version',
    'dash.months': 'months', 'dash.no_data': 'Load a molecule to display the dashboard',
    'ai.comparator': 'Drug A vs B Comparator', 'ai.prediction': 'AI Degradation Prediction',
    'ai.alerts': 'Real-time Alerts', 'ai.conflicts': 'Detected Conflicts',
    'ai.score': 'Similarity Score', 'ai.confidence': 'AI Confidence',
    'ai.run_prediction': 'Run Prediction', 'ai.temperature': 'Temperature (°C)',
    'ai.humidity': 'Humidity (%RH)', 'ai.duration': 'Duration (months)',
    'export.excel': 'Export Excel (14 sheets)', 'export.pdf': 'Export PDF Recordati',
    'export.both': 'Export Excel + PDF', 'export.generating': 'Generating...',
    'export.done': 'Export completed successfully', 'export.audit_logged': 'Logged in Audit Trail',
    'assistant.title': 'Pharmaceutical AI Assistant', 'assistant.placeholder': 'Ask about the loaded molecule...',
    'assistant.send': 'Send', 'assistant.config_api': 'Configure API Key',
    'assistant.api_label': 'API Key (OpenAI sk-... or Gemini AIza...)',
    'assistant.save_key': 'Save', 'assistant.thinking': 'Analyzing...',
    'assistant.no_molecule': 'Please load a molecule (Drug A) first.',
    'assistant.no_key': 'Please configure your API key.',
    'audit.title': 'GMP Audit Trail', 'audit.user': 'User', 'audit.dept': 'Department',
    'audit.action': 'Action', 'audit.timestamp': 'Timestamp', 'audit.result': 'Result',
    'audit.session': 'Session ID', 'audit.clear': 'Clear History',
    'common.drug_a': 'Drug A', 'common.drug_b': 'Drug B', 'common.vs': 'vs',
    'common.no_data': 'No data. Search for a molecule first.', 'common.loading': 'Loading...',
    'common.validate': '✓ Validate', 'common.reject': '✗ Reject', 'common.annotate': '✏ Annotate',
    'common.save': 'Save', 'common.cancel': 'Cancel', 'common.close': 'Close',
    'common.reliability': 'Reliability', 'common.source': 'Source', 'common.version': 'Version',
    'mol.inn': 'INN Name', 'mol.iupac': 'IUPAC Name', 'mol.cas': 'CAS Number', 'mol.formula': 'Formula',
    'mol.smiles': 'SMILES', 'mol.mw': 'Mol. Weight (g/mol)', 'mol.mechanism': 'Mechanism of Action',
    'mol.bioavailability': 'Bioavailability (%)', 'mol.halflife': 'Half-life', 'mol.logp': 'LogP',
    'mol.class': 'Therapeutic Class', 'mol.cid': 'PubChem CID',
    'stab.condition': 'Condition', 'stab.temp': 'Temperature', 'stab.rh': '%RH', 'stab.light': 'Light',
    'stab.result': 'Result', 'stab.shelf': 'Shelf Life', 'stab.packaging': 'Packaging',
    'deg.type': 'Stress Type', 'deg.conditions': 'Conditions', 'deg.products': 'Identified Products',
    'deg.method': 'Method', 'deg.rate': 'Rate (%)', 'deg.ich': 'ICH Compliance',
    'age.type': 'Study Type', 'age.zone': 'ICH Zone', 'age.timepoint': 'Time Point',
    'age.assay': 'Assay (%)', 'age.impurities': 'Impurities (%)', 'age.ph': 'pH', 'age.dissolution': 'Dissolution (%)',
    'reg.ld50': 'LD50', 'reg.who': 'WHO Class', 'reg.countries': 'Approved Countries', 'reg.ctd': 'CTD Module 3',
    'exc.excipient': 'Excipient', 'exc.compat': 'Compatibility', 'exc.interaction': 'Interaction', 'exc.ratio': 'Ratio',
    'rep.rd_title': 'R&D Report', 'rep.log_title': 'Logistics Report', 'rep.reg_title': 'Regulatory Report',
    'rep.qual_title': 'Quality Report', 'rep.prod_title': 'Production Report', 'rep.fin_title': 'Finance Report',
  }
};

export let currentLang = 'fr';

export function t(key) {
  return TRANSLATIONS[currentLang]?.[key] ?? TRANSLATIONS['fr']?.[key] ?? key;
}

export function setLanguage(lang) {
  currentLang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      if (el.hasAttribute('placeholder')) el.placeholder = val;
      else el.value = val;
    } else {
      el.textContent = val;
    }
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-ph'));
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.getAttribute('data-i18n-title'));
  });
  const btn = document.getElementById('lang-toggle');
  if (btn) btn.textContent = lang === 'fr' ? 'EN' : 'FR';
  document.documentElement.lang = lang;
  document.dispatchEvent(new CustomEvent('langChanged', { detail: { lang } }));
}

export function toggleLanguage() {
  setLanguage(currentLang === 'fr' ? 'en' : 'fr');
}
