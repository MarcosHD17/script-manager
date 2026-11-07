// Operaciones sobre el estado de los scripts: activación y duplicado.

export function setEnabled(scripts, ids, value) {
  const set = new Set(ids);
  return scripts.map((s) => (set.has(s.id) ? { ...s, enabled: value } : s));
}

export function enabledState(list) {
  if (!list.length) return 'none';
  const on = list.filter((s) => s.enabled).length;
  return on === list.length ? 'all' : on === 0 ? 'none' : 'some';
}

// Duplica un script justo después del original; la copia queda desactivada.
export function duplicateScript(scripts, id, now = Date.now()) {
  const index = scripts.findIndex((s) => s.id === id);
  if (index < 0) return { scripts, copy: null };
  const original = scripts[index];
  const { rev, ...rest } = original;
  const copy = { ...rest, id: crypto.randomUUID(), name: `${original.name} (copia)`, enabled: false, createdAt: now, updatedAt: now };
  const result = [...scripts];
  result.splice(index + 1, 0, copy);
  return { scripts: result, copy };
}
