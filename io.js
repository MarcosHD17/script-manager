// Importar y exportar compartido por el popup y la página de opciones.
import { getScripts, setScripts, getGroups, setGroups, getHistory, setHistory } from './storage.js';
import { buildExport, parseImport, mergeScripts } from './transfer.js';
import { assignGroupsByName } from './organize.js';
import { ensureVersions } from './versions.js';

export const today = () => new Date().toISOString().slice(0, 10);
export const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'script';

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Exporta todos los scripts (con su grupo y color). Devuelve la cantidad exportada.
export async function exportAll() {
  const [scripts, groups] = await Promise.all([getScripts(), getGroups()]);
  if (scripts.length) downloadJson(`script-manager-${today()}.json`, buildExport(scripts, groups));
  return scripts.length;
}

// Importa archivos (JSON o userscript .js). Devuelve { ok, message }.
export async function importFiles(files) {
  const incoming = [];
  let skipped = 0;
  const errors = [];
  const invalidPatterns = [];
  const repairedPatterns = [];
  for (const file of files) {
    try {
      const result = parseImport(await file.text(), file.name);
      incoming.push(...result.scripts);
      skipped += result.skipped;
      invalidPatterns.push(...result.invalid);
      repairedPatterns.push(...result.repaired);
    } catch (error) {
      errors.push(`${file.name}: ${error.message}`);
    }
  }
  if (!incoming.length) return { ok: false, message: errors.length ? errors.join(' | ') : 'No se encontraron scripts válidos.' };

  const [existing, groups, history] = await Promise.all([getScripts(), getGroups(), getHistory()]);
  const duplicates = incoming.filter((item) => existing.some((s) => s.id === item.id)).length;
  const replace = duplicates > 0 && confirm(`${duplicates} script(s) ya existen con el mismo id.\nAceptar = reemplazarlos. Cancelar = importarlos como copia.`);
  const merged = mergeScripts(existing, incoming, replace);
  const grouped = assignGroupsByName(merged.scripts, groups);
  const versioned = ensureVersions(grouped.scripts, history, Date.now(), 'Importado');
  await setHistory(versioned.history);
  await setGroups(grouped.groups);
  await setScripts(versioned.scripts);
  const notes = [`Importados: ${merged.added} nuevos, ${merged.replaced} reemplazados, ${merged.copied} copias`];
  if (skipped) notes.push(`${skipped} omitidos por formato inválido`);
  if (repairedPatterns.length) notes.push(`Patrones corregidos: ${repairedPatterns.join('; ')}`);
  if (invalidPatterns.length) notes.push(`Patrones @match inválidos omitidos: ${invalidPatterns.join(', ')}`);
  if (errors.length) notes.push(errors.join(' | '));
  return { ok: true, message: `${notes.join('. ')}. Quedan desactivados: revísalos y actívalos.` };
}
