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

// Orden mostrado de los grupos: los fijados (pinned) primero; dentro de cada bloque, el orden del arreglo.
export function orderGroups(groups) {
  return [...groups.filter((g) => g.pinned), ...groups.filter((g) => !g.pinned)];
}

// Pliega o despliega todos los grupos.
export function setAllCollapsed(groups, collapsed) {
  return groups.map((g) => ({ ...g, collapsed }));
}

// Fija o desfija un grupo.
export function togglePinned(groups, id) {
  return groups.map((g) => (g.id === id ? { ...g, pinned: !g.pinned } : g));
}

// Secciones en el orden de los grupos; al final "sin grupo" (group: null), que incluye ids de grupo desconocidos.
export function buildSections(scripts, groups, mode) {
  const known = new Set(groups.map((g) => g.id));
  const sections = orderGroups(groups).map((group) => ({
    group,
    scripts: sortScripts(scripts.filter((s) => s.group === group.id), mode)
  }));
  sections.push({ group: null, scripts: sortScripts(scripts.filter((s) => !s.group || !known.has(s.group)), mode) });
  return sections;
}

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

// "Congela" el orden mostrado (grupos y modo de orden) como orden manual del arreglo.
export function bakeOrder(scripts, groups, mode) {
  return buildSections(scripts, groups, mode).flatMap((section) => section.scripts);
}

// Ids entre dos scripts (ambos incluidos) según el orden en que se muestran.
export function rangeIds(orderedIds, fromId, toId) {
  const from = orderedIds.indexOf(fromId);
  const to = orderedIds.indexOf(toId);
  if (from < 0 || to < 0) return [];
  return orderedIds.slice(Math.min(from, to), Math.max(from, to) + 1);
}

// Colores de grupo (se ven bien en todos los temas).
export const GROUP_COLORS = ['#1a73e8', '#e8710a', '#188038', '#a142f4', '#d93025', '#00897b', '#c2185b', '#5f6368'];

export function nextGroupColor(groups) {
  const used = new Set(groups.map((g) => g.color));
  return GROUP_COLORS.find((c) => !used.has(c)) ?? GROUP_COLORS[groups.length % GROUP_COLORS.length];
}

// Asigna color a los grupos que no lo tienen (determinista: opciones y popup obtienen el mismo resultado).
export function ensureGroupColors(groups) {
  const used = new Set(groups.map((g) => g.color).filter(Boolean));
  let changed = false;
  const result = groups.map((group, index) => {
    if (group.color) return group;
    changed = true;
    const color = GROUP_COLORS.find((c) => !used.has(c)) ?? GROUP_COLORS[index % GROUP_COLORS.length];
    used.add(color);
    return { ...group, color };
  });
  return { groups: result, changed };
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

// Sube (-1) o baja (+1) un grupo dentro de su bloque (fijados / no fijados) según el orden mostrado.
export function moveGroup(groups, id, direction) {
  const ordered = orderGroups(groups);
  const index = ordered.findIndex((g) => g.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ordered.length || !ordered[index].pinned !== !ordered[target].pinned) return groups;
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  return ordered;
}

// Mueve un grupo antes o después de otro (al arrastrar). Adopta el estado de fijado del grupo destino.
export function moveGroupTo(groups, id, targetId, where = 'before') {
  const ordered = orderGroups(groups);
  const moving = ordered.find((g) => g.id === id);
  const target = ordered.find((g) => g.id === targetId);
  if (!moving || !target || id === targetId) return groups;
  const rest = ordered.filter((g) => g.id !== id);
  const at = rest.findIndex((g) => g.id === targetId);
  rest.splice(where === 'after' ? at + 1 : at, 0, { ...moving, pinned: !!target.pinned });
  return rest;
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
  const mapped = scripts.map(({ groupName, groupColor, ...script }) => {
    if (!groupName) return script;
    let group = result.find((g) => g.name.toLowerCase() === groupName.toLowerCase());
    if (!group) {
      group = { id: crypto.randomUUID(), name: groupName, collapsed: false, color: groupColor || nextGroupColor(result) };
      result.push(group);
    }
    return { ...script, group: group.id };
  });
  return { scripts: mapped, groups: result };
}
