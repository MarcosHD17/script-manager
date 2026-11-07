// Patrones de URL: validación y normalización tolerante (estilo Tampermonkey) a match patterns de Chrome. Lógica pura.
const MATCH_RE = /^(\*|https?|file|ftp):\/\/(\*|\*\.[^/*]+|[^/*]*)(\/.*)$/;

export const isValidMatchPattern = (pattern) => pattern === '<all_urls>' || (MATCH_RE.test(pattern) && !/^(https?|\*):\/\/\//.test(pattern));

// Convierte formas habituales de userscript en un match pattern válido; devuelve null si no tiene arreglo.
//   "https://claude.com*" -> "https://claude.com/*"   "example.com" -> "*://example.com/*"
//   "http*://x.com/*" -> "*://x.com/*"                "*example.com" -> "*://*.example.com/*"
export function normalizePattern(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  if (text === '<all_urls>' || text === '*') return '<all_urls>';
  const sep = text.indexOf('://');
  let scheme = sep < 0 ? '*' : text.slice(0, sep).toLowerCase();
  let rest = sep < 0 ? text.replace(/^\/\//, '') : text.slice(sep + 3);
  if (/^https?\*$/.test(scheme)) scheme = '*';
  if (rest.includes('://')) { // esquema duplicado ("*://*://x") 
    rest = rest.slice(rest.lastIndexOf('://') + 3);
  }
  if (!['*', 'http', 'https', 'file', 'ftp'].includes(scheme)) return null;
  const slash = rest.indexOf('/');
  let host = slash < 0 ? rest : rest.slice(0, slash);
  let path = slash < 0 ? '' : rest.slice(slash);
  if (scheme === 'file') return `file://${host}${path || '/*'}`;
  if (!path && host.length > 1 && host.endsWith('*')) host = host.slice(0, -1); // "claude.com*"
  if (host.startsWith('*') && host !== '*' && !host.startsWith('*.')) host = `*.${host.slice(1)}`;
  if (!host || (host.includes('*') && host !== '*' && !/^\*\.[^*]+$/.test(host))) return null;
  const result = `${scheme}://${host}${path || '/*'}`;
  return isValidMatchPattern(result) ? result : null;
}

// Normaliza una lista: { matches (únicos y válidos), repaired: ["a → b"], invalid: [...] }.
export function normalizeMatches(list) {
  const matches = [];
  const repaired = [];
  const invalid = [];
  for (const raw of list) {
    const original = String(raw).trim();
    if (!original) continue;
    const fixed = normalizePattern(original);
    if (!fixed) { invalid.push(original); continue; }
    if (fixed !== original) repaired.push(`${original} → ${fixed}`);
    if (!matches.includes(fixed)) matches.push(fixed);
  }
  return { matches, repaired, invalid };
}
