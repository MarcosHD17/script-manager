// Organización de scripts: orden, grupos y movimientos. Lógica pura, sin acceso a la UI.
// El orden manual es el orden del arreglo `scripts`; los modos de orden solo cambian la vista.
export const SORT_MODES = [
  { id: 'manual', label: 'Manual' },
  { id: 'name-asc', label: 'Nombre A → Z' },
  { id: 'name-desc', label: 'Nombre Z → A' },
  { id: 'updated-desc', label: 'Modificados recientemente' },
  { id: 'created-desc', label: 'Creados recientemente' },
  { id: 'enabled-first', label: 'Activos primero' },
  { id: 'grants-first', label: 'Con permisos de extensión primero' }
];

const byName = (a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base', numeric: true });
const hasGrants = (s) => (s.grants?.length ?? 0) > 0;
const COMPARATORS = {
  'name-asc': byName,
  'name-desc': (a, b) => byName(b, a),
  'updated-desc': (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
  'created-desc': (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
  'enabled-first': (a, b) => Number(b.enabled) - Number(a.enabled),
  'grants-first': (a, b) => Number(hasGrants(b)) - Number(hasGrants(a))
};

export function sortScripts(list, mode) {
  const compare = COMPARATORS[mode];
  return compare ? [...list].sort(compare) : [...list];
}

// Secciones en el orden de los grupos; al final "sin grupo" (group: null), que incluye ids de grupo desconocidos.
export function buildSections(scripts, groups, mode) {
  const known = new Set(groups.map((g) => g.id));
  const sections = groups.map((group) => ({
    group,
    scripts: sortScripts(scripts.filter((s) => s.group === group.id), mode)
  }));
  sections.push({ group: null, scripts: sortScripts(scripts.filter((s) => !s.group || !known.has(s.group)), mode) });
  return sections;
}

// Mueve un script a un grupo y posición. where: 'before' | 'after' (respecto a targetId) | 'end' (final del grupo).
export function moveScript(scripts, id, { targetId = null, where = 'end', groupId = null } = {}) {
  const moving = scripts.find((s) => s.id === id);
  if (!moving) return scripts;
  const rest = scripts.filter((s) => s.id !== id);
  const moved = { ...moving, group: groupId };
  let index;
  if (targetId && rest.some((s) => s.id === targetId)) {
    const target = rest.findIndex((s) => s.id === targetId);
    index = where === 'before' ? target : target + 1;
  } else {
    const inGroup = rest.map((s, i) => ((s.group ?? null) === groupId ? i : -1)).filter((i) => i >= 0);
    index = inGroup.length ? inGroup[inGroup.length - 1] + 1 : rest.length;
  }
  rest.splice(index, 0, moved);
  return rest;
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

export function moveGroup(groups, id, direction) {
  const index = groups.findIndex((g) => g.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= groups.length) return groups;
  const result = [...groups];
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}

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

// Convierte `groupName` (de archivos importados) en ids de grupo, creando los que no existan.
export function assignGroupsByName(scripts, groups) {
  const result = [...groups];
  const mapped = scripts.map(({ groupName, ...script }) => {
    if (!groupName) return script;
    let group = result.find((g) => g.name.toLowerCase() === groupName.toLowerCase());
    if (!group) {
      group = { id: crypto.randomUUID(), name: groupName, collapsed: false };
      result.push(group);
    }
    return { ...script, group: group.id };
  });
  return { scripts: mapped, groups: result };
}
