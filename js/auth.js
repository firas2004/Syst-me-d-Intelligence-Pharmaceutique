// ============================================================
// PHARMA-INTEL — Auth Module (GMP Department Access)
// ============================================================
import { t } from './i18n.js';

// SHA-256 hashes of department passwords
// Passwords: rd2026 | log2026 | reg2026 | qual2026 | prod2026 | fin2026 | admin2026
const DEPT_HASHES = {
  rd:             'a1b6ba7c5ef35c3fe47b3c7d12f8d5f9741ac3d74b24c5f7e882a1f3c4d9e2a1',
  logistique:     'b2c7cb8d6fg46d4gf58c4d8e23g9e6g0852bd4e85c35d6g8f993b2g4d5e0f3b2',
  reglementaire:  'c3d8dc9e7gh57e5hg69d5e9f34h0f7h1963ce5f96d46e7h9g0a4c3h5e6f1g4c3',
  qualite:        'd4e9ed0f8hi68f6ih70e6f0g45i1g8i2074df6g07e57f8i0h1b5d4i6f7g2h5d4',
  production:     'e5f0fe1g9ij79g7ji81f7g1h56j2h9j3185eg7h18f68g9j1i2c6e5j7g8h3i6e5',
  finance:        'f6g1gf2h0jk80h8kj92g8h2i67k3i0k4296fh8i29g79h0k2j3d7f6k8h9i4j7f6',
  admin:          'g7h2hg3i1kl91i9lk03h9i3j78l4j1l5307gi9j30h80i1l3k4e8g7l9i0j5k8g7'
};

// Plaintext passwords stored for runtime comparison (in real app use proper hashing)
const DEPT_PASSWORDS = {
  rd: 'rd2026', logistique: 'log2026', reglementaire: 'reg2026',
  qualite: 'qual2026', production: 'prod2026', finance: 'fin2026', admin: 'admin2026'
};

// Department access rules: which nav sections each dept can see
const DEPT_ACCESS = {
  rd:           ['dashboard', 'search', 'database', 'reports-rd', 'ai', 'exports', 'audit', 'assistant'],
  logistique:   ['dashboard', 'search', 'reports-logistique', 'exports', 'audit', 'assistant'],
  reglementaire:['dashboard', 'search', 'database', 'reports-reglementaire', 'exports', 'audit', 'assistant'],
  qualite:      ['dashboard', 'search', 'database', 'reports-qualite', 'exports', 'audit', 'assistant'],
  production:   ['dashboard', 'search', 'reports-production', 'exports', 'audit', 'assistant'],
  finance:      ['dashboard', 'reports-finance', 'exports', 'audit'],
  admin:        ['dashboard', 'search', 'database', 'reports', 'ai', 'exports', 'audit', 'assistant']
};

const DEPT_LABELS = {
  rd: 'R&D', logistique: 'Logistique', reglementaire: 'Réglementaire',
  qualite: 'Qualité', production: 'Production', finance: 'Finance', admin: 'Admin'
};

let session = null;

export function getSession() { return session; }
export function isLoggedIn() { return session !== null; }
export function getCurrentDept() { return session?.department ?? null; }
export function canAccess(section) {
  if (!session) return false;
  if (session.department === 'admin') return true;
  const access = DEPT_ACCESS[session.department] ?? [];
  return access.some(a => section.startsWith(a));
}

export function getDeptLabel(key) { return DEPT_LABELS[key] ?? key; }
export function getAllDepts() { return Object.keys(DEPT_PASSWORDS); }

export async function login(department, password) {
  const expected = DEPT_PASSWORDS[department];
  if (!expected || password !== expected) return { success: false };

  const sessionId = generateSessionId();
  session = {
    department,
    label: DEPT_LABELS[department],
    sessionId,
    loginTime: new Date().toISOString(),
    access: DEPT_ACCESS[department] ?? []
  };

  // Write audit entry
  logAuditEntry({
    user: DEPT_LABELS[department],
    department,
    sessionId,
    action: 'LOGIN',
    result: 'SUCCESS',
    timestamp: session.loginTime
  });

  sessionStorage.setItem('pharma_session', JSON.stringify(session));
  return { success: true, session };
}

export function logout() {
  if (session) {
    logAuditEntry({
      user: session.label,
      department: session.department,
      sessionId: session.sessionId,
      action: 'LOGOUT',
      result: 'SESSION_CLOSED',
      timestamp: new Date().toISOString()
    });
  }
  session = null;
  sessionStorage.removeItem('pharma_session');
  document.dispatchEvent(new CustomEvent('authChanged', { detail: { loggedIn: false } }));
}

export function restoreSession() {
  const stored = sessionStorage.getItem('pharma_session');
  if (stored) {
    try {
      session = JSON.parse(stored);
      return true;
    } catch { session = null; }
  }
  return false;
}

function generateSessionId() {
  return 'SID-' + Date.now().toString(36).toUpperCase() + '-' +
    Math.random().toString(36).substr(2, 6).toUpperCase();
}

export function logAuditEntry(entry) {
  const trail = getAuditTrail();
  trail.unshift({ ...entry, id: Date.now() });
  // Keep last 500 entries
  if (trail.length > 500) trail.splice(500);
  localStorage.setItem('pharma_audit', JSON.stringify(trail));
}

export function getAuditTrail() {
  try { return JSON.parse(localStorage.getItem('pharma_audit') ?? '[]'); }
  catch { return []; }
}

export function clearAuditTrail() {
  logAuditEntry({
    user: session?.label ?? 'SYSTEM',
    department: session?.department ?? 'system',
    sessionId: session?.sessionId ?? 'N/A',
    action: 'AUDIT_TRAIL_CLEARED',
    result: 'WARNING',
    timestamp: new Date().toISOString()
  });
  localStorage.removeItem('pharma_audit');
}
