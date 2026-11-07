// Lectura de la cabecera ==UserScript== (compatible con Tampermonkey/Greasemonkey). Lógica pura.
const MATCH_RE = /^(\*|https?|file|ftp):\/\/(\*|\*\.[^/*]+|[^/*]+)\/.*$/;

export const isValidMatchPattern = (pattern) => pattern === '<all_urls>' || MATCH_RE.test(pattern);

// Repara el error común de esquema duplicado ("*://*://*" -> "*://*/*"). Devuelve null si no tiene arreglo.
export function repairPattern(pattern) {
  const parts = pattern.split('://');
  if (parts.length !== 3) return null;
  const rest = parts[2];
  const repaired = `${parts[0]}://${rest.includes('/') ? rest : `${rest}/*`}`;
  return isValidMatchPattern(repaired) ? repaired : null;
}

// Devuelve null si no hay cabecera; si la hay: { name, version, description, matches, grants, invalid, repaired }.
export function parseMetadata(code) {
  const block = code.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/);
  if (!block) return null;
  const meta = { name: '', version: '', description: '', matches: [], grants: [], invalid: [], repaired: [] };
  for (const line of block[1].split('\n')) {
    const entry = line.match(/^\s*\/\/\s*@([\w-]+)\s+(.+?)\s*$/);
    if (!entry) continue;
    const [, key, value] = entry;
    if (key === 'name' && !meta.name) meta.name = value;
    else if (key === 'version') meta.version = value;
    else if (key === 'description') meta.description = value;
    else if (key === 'grant' && value !== 'none') meta.grants.push(value);
    else if (key === 'match' || key === 'include') {
      if (isValidMatchPattern(value)) {
        meta.matches.push(value);
      } else {
        const fixed = repairPattern(value);
        if (fixed) { meta.matches.push(fixed); meta.repaired.push(`${value} → ${fixed}`); }
        else meta.invalid.push(value);
      }
    }
  }
  meta.matches = [...new Set(meta.matches)];
  meta.grants = [...new Set(meta.grants)];
  return meta;
}

// Texto de userscript listo para copiar/pegar: cabecera regenerada desde los campos + código sin la cabecera anterior.
export function buildUserScript(script) {
  const body = script.code.replace(/^\s*\/\/\s*==UserScript==[\s\S]*?\/\/\s*==\/UserScript==\s*/, '');
  const lines = ['// ==UserScript==', `// @name         ${script.name}`];
  if (script.rev) lines.push(`// @version      ${script.rev}`);
  for (const match of script.matches ?? []) lines.push(`// @match        ${match}`);
  for (const grant of script.grants ?? []) lines.push(`// @grant        ${grant}`);
  lines.push('// ==/UserScript==', '');
  return lines.join('\n') + body;
}
