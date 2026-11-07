// Importación y exportación de scripts (JSON). Lógica pura, sin acceso a la UI.
export const EXPORT_FORMAT = 'script-manager';
export const EXPORT_FORMAT_VERSION = 1;

export function buildExport(scripts) {
  return {
    format: EXPORT_FORMAT,
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    scripts: scripts.map(({ id, name, matches, code, enabled }) => ({ id, name, matches, code, enabled }))
  };
}

// Valida y normaliza el contenido de un archivo. Los scripts importados quedan desactivados por seguridad.
export function parseImport(text) {
  let data;
  try {
    data = JSON.parse(text);
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
    scripts.push({
      id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : crypto.randomUUID(),
      name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : 'Sin nombre',
      matches: matches.length ? matches.map((m) => m.trim()) : ['<all_urls>'],
      code: item.code,
      enabled: false
    });
  }
  return { scripts, skipped };
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
