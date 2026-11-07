// Control de versiones por script: historial de instantáneas y diferencias. Lógica pura.
// El historial vive aparte de los scripts: { [scriptId]: Version[] } con la más reciente primero.
export const MAX_VERSIONS = 30;

// Los patrones de URL NO forman parte de una versión: cambiarlos no crea versiones.
export const snapshotOf = (script) => ({
  name: script.name,
  grants: [...(script.grants ?? [])],
  code: script.code
});

const lf = (text) => String(text).replace(/\r\n/g, '\n'); // el editor normaliza los saltos de línea

export const sameContent = (a, b) =>
  a.name === b.name && lf(a.code) === lf(b.code) &&
  JSON.stringify(a.grants ?? []) === JSON.stringify(b.grants ?? []);

// Añade una versión si el contenido cambió. Devuelve { history, version } (version = null si no hubo cambios).
export function addVersion(history, script, note = '', now = Date.now()) {
  const list = history[script.id] ?? [];
  const snapshot = snapshotOf(script);
  if (list[0] && sameContent(list[0], snapshot)) return { history, version: null };
  const version = { rev: (list[0]?.rev ?? 0) + 1, at: now, note, ...snapshot };
  return { history: { ...history, [script.id]: [version, ...list].slice(0, MAX_VERSIONS) }, version };
}

// Elimina una versión y renumera el resto de forma contigua (1..N, la más antigua es v1).
// Devuelve { history, rev } con la revisión vigente (la más reciente) del script.
export function removeVersion(history, scriptId, rev) {
  const kept = (history[scriptId] ?? []).filter((v) => v.rev !== rev);
  const renumbered = kept.map((v, index) => ({ ...v, rev: kept.length - index }));
  return { history: { ...history, [scriptId]: renumbered }, rev: renumbered[0]?.rev ?? 0 };
}

// Garantiza una versión vigente y marcas de tiempo para cada script (migración y importaciones).
export function ensureVersions(scripts, history, now = Date.now(), note = 'Versión inicial') {
  let current = history;
  let changed = false;
  const result = scripts.map((script) => {
    const next = { ...script };
    if (next.createdAt === undefined) { next.createdAt = now; changed = true; }
    if (next.updatedAt === undefined) { next.updatedAt = next.createdAt; changed = true; }
    const added = addVersion(current, next, note, now);
    current = added.history;
    const rev = current[next.id]?.[0]?.rev;
    if (added.version) { next.updatedAt = now; changed = true; }
    if (next.rev !== rev) { next.rev = rev; changed = true; }
    return next;
  });
  return { scripts: result, history: current, changed };
}

// Diferencias línea a línea (LCS). Devuelve [{ type: 'same' | 'add' | 'del', text }].
export function diffLines(before, after) {
  const a = before.split('\n');
  const b = after.split('\n');
  if (a.length * b.length > 4_000_000) {
    return [...a.map((text) => ({ type: 'del', text })), ...b.map((text) => ({ type: 'add', text }))];
  }
  const n = a.length;
  const m = b.length;
  const table = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push({ type: 'same', text: a[i] }); i++; j++; }
    else if (table[i + 1][j] >= table[i][j + 1]) { ops.push({ type: 'del', text: a[i++] }); }
    else { ops.push({ type: 'add', text: b[j++] }); }
  }
  while (i < n) ops.push({ type: 'del', text: a[i++] });
  while (j < m) ops.push({ type: 'add', text: b[j++] });
  return ops;
}

// Oculta tramos sin cambios dejando `context` líneas alrededor de cada diferencia.
export function collapseContext(ops, context = 3) {
  const keep = ops.map(() => false);
  ops.forEach((op, index) => {
    if (op.type === 'same') return;
    for (let k = Math.max(0, index - context); k <= Math.min(ops.length - 1, index + context); k++) keep[k] = true;
  });
  const result = [];
  let skipped = 0;
  ops.forEach((op, index) => {
    if (keep[index]) {
      if (skipped) { result.push({ type: 'skip', count: skipped }); skipped = 0; }
      result.push(op);
    } else {
      skipped++;
    }
  });
  if (skipped) result.push({ type: 'skip', count: skipped });
  return result;
}

// Texto comparable de un script (metadatos + código) para mostrar diferencias.
export const comparableText = (s) =>
  [`# nombre: ${s.name}`, `# permisos: ${(s.grants ?? []).join(', ')}`, '', s.code].join('\n');
