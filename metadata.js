// Lectura de la cabecera ==UserScript== (compatible con Tampermonkey/Greasemonkey). Lógica pura.
const MATCH_RE = /^(\*|https?|file|ftp):\/\/(\*|\*\.[^/*]+|[^/*]+)\/.*$/;

export const isValidMatchPattern = (pattern) => pattern === '<all_urls>' || MATCH_RE.test(pattern);

// Devuelve null si no hay cabecera; si la hay: { name, version, description, matches, grants, invalid }.
export function parseMetadata(code) {
  const block = code.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/);
  if (!block) return null;
  const meta = { name: '', version: '', description: '', matches: [], grants: [], invalid: [] };
  for (const line of block[1].split('\n')) {
    const entry = line.match(/^\s*\/\/\s*@([\w-]+)\s+(.+?)\s*$/);
    if (!entry) continue;
    const [, key, value] = entry;
    if (key === 'name' && !meta.name) meta.name = value;
    else if (key === 'version') meta.version = value;
    else if (key === 'description') meta.description = value;
    else if (key === 'grant' && value !== 'none') meta.grants.push(value);
    else if (key === 'match' || key === 'include') {
      (isValidMatchPattern(value) ? meta.matches : meta.invalid).push(value);
    }
  }
  meta.matches = [...new Set(meta.matches)];
  meta.grants = [...new Set(meta.grants)];
  return meta;
}
