# PHARMA-INTEL v3.0

**Système d'Intelligence Pharmaceutique — Opalia Recordati**

PHARMA-INTEL est une plateforme avancée de gestion et d'analyse de données pharmaceutiques. Conçue pour optimiser le flux de travail des différents départements (R&D, Logistique, Qualité, Réglementaire, Production, Finance), elle offre une vue unifiée et prédictive sur le cycle de vie des molécules.

## 🚀 Fonctionnalités Principales

- **Dashboard Global (Vue Hélicoptère)** : Indicateurs clés de performance (KPIs), suivi des molécules actives, et alertes de conformité en temps réel.
- **Base de Données Intelligente** : Intégration simulée avec les bases de données mondiales (PubChem, OpenFDA) pour l'extraction automatique des profils moléculaires.
- **Génération de Rapports par Département** : Vues spécifiques et extrapolations de données pour :
  - 🧬 **R&D** (Mécanismes, Biodisponibilité, Synthèse)
  - 🚚 **Logistique** (Conditions de stockage, Stabilité)
  - 📜 **Réglementaire** (Toxico, Directives ICH, Approbations)
  - ✅ **Qualité** (Dégradation forcée, Vieillissement)
  - ⚙️ **Production** (Compatibilité des excipients)
  - 💰 **Finance** (Coûts de synthèse, Rendements)
- **Exports Professionnels et Conformité GMP** :
  - Export PDF formaté (Charte graphique Opalia Recordati, Sommaire automatique).
  - Export Excel (14 onglets structurés, compatibles ERP).
  - Audit Trail complet garantissant la traçabilité des actions.
- **Génération Automatique de Présentations** : Script Python intégré (`generate_pptx.py`) permettant de générer instantanément un Pitch Deck PowerPoint haut de gamme, formaté à 80% visuel / 20% texte.

## 🛠️ Stack Technique

- **Frontend** : HTML5, Vanilla JavaScript (ES6+), CSS3 (Thème Opalia Precision Dark).
- **Stockage Local** : IndexedDB & LocalStorage pour la gestion de l'état et la persistance des données.
- **Exports & Génération Documentaire** :
  - `jsPDF` et `jsPDF-AutoTable` (PDF)
  - `SheetJS` (Excel)
  - `python-pptx` (PowerPoint)

## 📦 Installation & Démarrage

### Lancer l'Application Web
L'application fonctionne entièrement côté client. Aucun serveur complexe n'est requis pour l'interface principale.
1. Clonez ce dépôt sur votre machine locale.
2. Ouvrez simplement le fichier `index.html` dans un navigateur moderne (Chrome, Edge, Firefox, Safari).

### Générer le Pitch Deck (PowerPoint)
Assurez-vous d'avoir Python 3.x installé sur votre machine.
```bash
# 1. Installez la dépendance requise
pip install python-pptx

# 2. Exécutez le script
python generate_pptx.py
```
Le fichier `PHARMA_INTEL_v3_Pitch.pptx` sera généré à la racine du projet.

## 🔒 Confidentialité & Sécurité
Ce projet intègre un module de traçabilité des sessions utilisateur et conserve un historique immuable des exports et modifications de la base de données (Audit Trail).

---
*Projet développé dans le cadre de la compétition d'innovation pour Opalia Recordati.*
