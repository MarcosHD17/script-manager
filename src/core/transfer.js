// Importación y exportación de scripts (JSON o userscript .js). Lógica pura, sin acceso a la UI.
import { parseMetadata } from './metadata.js';
import { normalizeMatches } from './patterns.js';

export const EXPORT_FORMAT = 'script-manager';
export const EXPORT_FORMAT_VERSION = 2; // 2 = incluye el historial de versiones (history) por script

export function buildExport(scripts, groups = [], history = {}) {
  return {
    format: EXPORT_FORMAT,
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    scripts: scripts.map(({ id, name, matches, grants, code, enabled, group }) => {
      const g = groups.find((candidate) => candidate.id === group);
      const versions = (history[id] ?? []).map(({ rev, at, note, name: vName, matches: vMatches, grants: vGrants, code: vCode }) => ({
        rev, at, note: note ?? '', name: vName, matches: vMatches ?? [], grants: vGrants ?? [], code: vCode
      }));
      return {
        id, name, matches, grants: grants ?? [], code, enabled,
        ...(versions.length ? { history: versions } : {}),
        ...(g ? { groupName: g.name, ...(g.color ? { groupColor: g.color } : {}) } : {})
      };
    })
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
      enabled: true
    },
    invalid: meta?.invalid ?? [],
    repaired: meta?.repaired ?? []
  };
}

// Valida y normaliza el contenido de un archivo. Los scripts conservan su estado (activos si el archivo no lo indica).
// Devuelve { scripts, skipped, invalid, repaired } (patrones de la cabecera descartados / corregidos).
export function parseImport(text, fileName = '') {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    if (trimmed.includes('==UserScript==') || /\.js$/i.test(fileName)) {
      const { script, invalid, repaired } = fromUserScript(text, fileName);
      return { scripts: [script], skipped: 0, invalid, repaired };
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
  const invalid = [];
  const repaired = [];
  let skipped = 0;
  for (const item of list) {
    if (!item || typeof item.code !== 'string') { skipped++; continue; }
    const rawMatches = Array.isArray(item.matches) ? item.matches.filter((m) => typeof m === 'string' && m.trim()) : [];
    const normalized = normalizeMatches(rawMatches);
    invalid.push(...normalized.invalid);
    repaired.push(...normalized.repaired);
    const matches = normalized.matches;
    const grants = Array.isArray(item.grants) ? item.grants.filter((g) => typeof g === 'string' && g.trim()).map((g) => g.trim()) : [];
    const versions = Array.isArray(item.history)
      ? item.history
        .filter((v) => v && Number.isFinite(v.rev) && typeof v.code === 'string')
        .map((v) => ({
          rev: v.rev,
          at: Number.isFinite(v.at) ? v.at : Date.now(),
          note: typeof v.note === 'string' ? v.note : '',
          name: typeof v.name === 'string' && v.name.trim() ? v.name : 'Sin nombre',
          matches: Array.isArray(v.matches) ? v.matches.filter((m) => typeof m === 'string') : [],
          grants: Array.isArray(v.grants) ? v.grants.filter((g) => typeof g === 'string') : [],
          code: v.code
        }))
        .sort((a, b) => b.rev - a.rev)
      : [];
    scripts.push({
      ...(versions.length ? { history: versions } : {}),
      id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : crypto.randomUUID(),
      name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : 'Sin nombre',
      matches: matches.length || rawMatches.length ? matches : ['<all_urls>'], // sin patrones en el archivo = global; todos inválidos = no se ejecuta
      grants,
      code: item.code,
      // v0.17.0: forma explícita — si el archivo exportado tenía enabled=false lo preserva;
      //          si no tiene el campo (versiones antiguas) queda activo por defecto.
      enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
      ...(typeof item.groupName === 'string' && item.groupName.trim()
        ? { groupName: item.groupName.trim(), ...(/^#[0-9a-f]{6}$/i.test(item.groupColor ?? '') ? { groupColor: item.groupColor } : {}) }
        : {})
    });
  }
  return { scripts, skipped, invalid, repaired };
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
