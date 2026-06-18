// ============================================================
// PHARMA-INTEL — AI Assistant Module (Real API)
// ============================================================
import { getAllTables, getDrugInfo } from './database.js';
import { t } from './i18n.js';
import { logAuditEntry, getSession } from './auth.js';

const API_KEY_STORAGE = 'pharma_ai_api_key';
const API_PROVIDER_STORAGE = 'pharma_ai_provider';

export function saveApiKey(key) {
  // Basic detection of provider from key prefix
  const provider = key.startsWith('AIza') ? 'gemini' : 'openai';
  localStorage.setItem(API_KEY_STORAGE, key);
  localStorage.setItem(API_PROVIDER_STORAGE, provider);
  return provider;
}

export function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) ?? '';
}

export function getProvider() {
  return localStorage.getItem(API_PROVIDER_STORAGE) ?? 'openai';
}

export function hasApiKey() {
  return !!getApiKey();
}

// Build rich pharmaceutical context from 7 tables
function buildContext(slot = 'drugA') {
  const tables = getAllTables(slot);
  const info = getDrugInfo(slot);
  if (!tables || !info) return null;

  const t1 = tables.T1;
  const t2 = tables.T2;
  const t3 = tables.T3;
  const t4 = tables.T4;
  const t5 = tables.T5;
  const t6 = tables.T6;
  const t7 = tables.T7;

  return `
=== PHARMA-INTEL DATABASE CONTEXT ===
Drug: ${info.name} | PubChem CID: ${info.cid} | Class: ${info.drugClass}

TABLE 1 — MOLECULE:
- INN: ${t1.inn}
- IUPAC: ${t1.iupac}
- Formula: ${t1.formula}
- MW: ${t1.mw} g/mol
- SMILES: ${t1.smiles}
- LogP: ${t1.logp}
- Mechanism: ${t1.mechanism} [${t1.sim_flags?.mechanism}]
- Bioavailability: ${t1.bioavailability}% [SIMULATED]
- Half-life: ${t1.halflife} [SIMULATED]

TABLE 2 — STABILITY:
${t2?.conditions?.map(c => `- ${c.condition}: ${c.result} | Assay: ${c.assay}% | Shelf life: ${c.shelfLife} | ICH compliant: ${c.compliant}`).join('\n')}

TABLE 3 — FORCED DEGRADATION:
${t3?.stressTests?.map(s => `- ${s.type}: ${s.rate}% degradation | Products: ${s.products} | Method: ${s.method} | ICH: ${s.ichCompliant ? 'Compliant' : 'NON-COMPLIANT'}`).join('\n')}

TABLE 4 — AGING (Real-Time T0→T24):
${t4?.realTime?.timePoints?.map(tp => `T${tp.month}m: Assay ${tp.assay}%, Imp ${tp.impurities}%, pH ${tp.ph}, Diss ${tp.dissolution}%`).join(' | ')}

TABLE 5 — SYNTHESIS:
${t5?.routes?.map(r => `- ${r.name}: Yield ${r.yield}%, Cost €${r.costPerGram}/g, Feasibility ${r.feasibility}%`).join('\n')}

TABLE 6 — REGULATORY:
- LD50: ${t6?.ld50}
- WHO Toxicity: Category ${t6?.whoToxicityClass}
- ICH Q1A: ${t6?.ichGuidelines?.Q1A}
- ICH Q1B: ${t6?.ichGuidelines?.Q1B}

TABLE 7 — EXCIPIENTS:
${t7?.excipients?.map(e => `- ${e.name}: ${e.compatible ? 'COMPATIBLE' : 'INCOMPATIBLE'} | ${e.interaction}${e.caution ? ' ⚠ CAUTION' : ''}`).join('\n')}

NOTE: Data flagged [SIMULATED] requires manual verification before regulatory submission.
SOURCE: PubChem (NIH) for molecular data. ICH guidelines for stability parameters.
`;
}

// Send message to AI API
export async function sendMessage(userMessage, slot = 'drugA') {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('NO_API_KEY');

  const dbContext = buildContext(slot);
  if (!dbContext) throw new Error('NO_MOLECULE');

  const systemPrompt = `You are PHARMA-INTEL, an expert pharmaceutical AI assistant for Recordati, a pharmaceutical company. 
You have access to a structured pharmaceutical database for a specific molecule (see context below).
Your role: answer questions about this molecule — stability, degradation, synthesis, regulatory compliance, ICH guidelines, and pharmacokinetics.
Be precise, cite the data from the context, and always flag simulated data as requiring verification.
Respond in the same language as the user (French or English).
Always include ICH guideline references when relevant (Q1A, Q1B, Q1E, Q3A).

PHARMACEUTICAL DATABASE CONTEXT:
${dbContext}`;

  const provider = getProvider();

  let response;
  if (provider === 'gemini') {
    response = await callGemini(apiKey, systemPrompt, userMessage);
  } else {
    response = await callOpenAI(apiKey, systemPrompt, userMessage);
  }

  logAuditEntry({
    user: getSession()?.label ?? 'SYSTEM',
    department: getSession()?.department ?? 'system',
    sessionId: getSession()?.sessionId ?? 'N/A',
    action: `AI_ASSISTANT_QUERY — "${userMessage.substring(0, 80)}..."`,
    result: `RESPONSE — ${response.substring(0, 60)}...`,
    timestamp: new Date().toISOString()
  });

  return response;
}

async function callOpenAI(apiKey, systemPrompt, userMessage) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 1000,
      temperature: 0.3
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `OpenAI error: ${res.status}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? 'No response';
}

async function callGemini(apiKey, systemPrompt, userMessage) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: systemPrompt + '\n\nUser question: ' + userMessage }]
      }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1000 }
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Gemini error: ${res.status}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No response';
}
