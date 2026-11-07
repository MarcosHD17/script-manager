// Importación y exportación de scripts (JSON o userscript .js). Lógica pura, sin acceso a la UI.
import { parseMetadata } from './metadata.js';

export const EXPORT_FORMAT = 'script-manager';
export const EXPORT_FORMAT_VERSION = 1;

export function buildExport(scripts) {
  return {
    format: EXPORT_FORMAT,
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    scripts: scripts.map(({ id, name, matches, grants, code, enabled }) => ({ id, name, matches, grants: grants ?? [], code, enabled }))
  };
}

// Archivo de userscript (.js con cabecera ==UserScript==): se importa con nombre, patrones y @grant de la cabecera.
function fromUserScript(text, fileName) {
  const meta = parseMetadata(text);
  const fallback = fileName.replace(/\.user\.js$|\.js$/i, '').trim();
  return {
    script: {
      id: crypto.randomUUID(),
      name: meta?.name || fallback || 'Sin nombre',
      matches: meta ? meta.matches : ['<all_urls>'], // vacío = nunca se ejecuta (patrones inválidos)
      grants: meta ? meta.grants : [],
      code: text,
      enabled: false
    },
    invalid: meta?.invalid ?? []
  };
}

// Valida y normaliza el contenido de un archivo. Los scripts importados quedan desactivados por seguridad.
// Devuelve { scripts, skipped, invalid } (invalid = patrones de la cabecera descartados).
export function parseImport(text, fileName = '') {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    if (trimmed.includes('==UserScript==') || /\.js$/i.test(fileName)) {
      const { script, invalid } = fromUserScript(text, fileName);
      return { scripts: [script], skipped: 0, invalid };
    }
    throw new Error('El archivo no es un JSON válido ni un userscript');
  }
  let data;
  try {
    data = JSON.parse(trimmed);
  } catch {
    throw new Error('El archivo no es un JSON válido');
  }
  const list = Array.isArray(data) ? data : data?.scripts;
  if (!Array.isArray(list)) throw new Error('Formato no reconocido: se esperaba una lista de scripts');

  const scripts = [];
  let skipped = 0;
  for (const item of list) {
    if (!item || typeof item.code !== 'string') { skipped++; continue; }
    const matches = Array.isArray(item.matches) ? item.matches.filter((m) => typeof m === 'string' && m.trim()) : [];
    const grants = Array.isArray(item.grants) ? item.grants.filter((g) => typeof g === 'string' && g.trim()).map((g) => g.trim()) : [];
    scripts.push({
      id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : crypto.randomUUID(),
      name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : 'Sin nombre',
      matches: matches.length ? matches.map((m) => m.trim()) : ['<all_urls>'],
      grants,
      code: item.code,
      enabled: false
    });
  }
  return { scripts, skipped, invalid: [] };
}

// Fusiona los scripts importados. Con id repetido: reemplaza (replace=true) o conserva ambos como copia.
export function mergeScripts(existing, incoming, replace) {
  const scripts = [...existing];
  let added = 0;
  let replaced = 0;
  let copied = 0;
  for (const item of incoming) {
    const index = scripts.findIndex((s) => s.id === item.id);
    if (index === -1) {
      scripts.push(item);
      added++;
    } else if (replace) {
      scripts[index] = item;
      replaced++;
    } else {
      scripts.push({ ...item, id: crypto.randomUUID(), name: `${item.name} (importado)` });
      copied++;
    }
  }
  return { scripts, added, replaced, copied };
}
