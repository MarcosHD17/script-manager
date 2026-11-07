// Movimientos de scripts en el arreglo (entre grupos, al principio, rangos).

// Mueve uno o varios scripts (conservando su orden relativo) a un grupo y posición.
// where: 'before' | 'after' (respecto a targetId) | 'end' (final del grupo).
export function moveMany(scripts, ids, { targetId = null, where = 'end', groupId = null } = {}) {
  const set = new Set(ids);
  const moving = scripts.filter((s) => set.has(s.id)).map((s) => ({ ...s, group: groupId }));
  if (!moving.length) return scripts;
  const rest = scripts.filter((s) => !set.has(s.id));
  let index;
  if (targetId && rest.some((s) => s.id === targetId)) {
    const target = rest.findIndex((s) => s.id === targetId);
    index = where === 'before' ? target : target + 1;
  } else {
    const inGroup = rest.map((s, i) => ((s.group ?? null) === groupId ? i : -1)).filter((i) => i >= 0);
    index = inGroup.length ? inGroup[inGroup.length - 1] + 1 : rest.length;
  }
  rest.splice(index, 0, ...moving);
  return rest;
}

export const moveScript = (scripts, id, options) => moveMany(scripts, [id], options);

// Ids entre dos scripts (ambos incluidos) según el orden en que se muestran.
export function rangeIds(orderedIds, fromId, toId) {
  const from = orderedIds.indexOf(fromId);
  const to = orderedIds.indexOf(toId);
  if (from < 0 || to < 0) return [];
  return orderedIds.slice(Math.min(from, to), Math.max(from, to) + 1);
}

// Sube (-1) o baja (+1) un script dentro de su grupo.
export function shiftScript(scripts, id, direction) {
  const current = scripts.find((s) => s.id === id);
  if (!current) return scripts;
  const group = current.group ?? null;
  const peers = scripts.map((s, i) => ((s.group ?? null) === group ? i : -1)).filter((i) => i >= 0);
  const position = peers.findIndex((i) => scripts[i].id === id);
  const neighbor = peers[position + direction];
  if (neighbor === undefined) return scripts;
  const result = [...scripts];
  [result[peers[position]], result[neighbor]] = [result[neighbor], result[peers[position]]];
  return result;
}

// Lleva un script al principio de su grupo (el orden del arreglo debe ser el mostrado: ver bakeOrder).
export function moveToTop(scripts, id) {
  const current = scripts.find((s) => s.id === id);
  if (!current) return scripts;
  const groupId = current.group ?? null;
  const first = scripts.find((s) => (s.group ?? null) === groupId);
  if (!first || first.id === id) return scripts;
  return moveMany(scripts, [id], { targetId: first.id, where: 'before', groupId });
}
