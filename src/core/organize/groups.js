// Lógica pura de grupos: orden (fijados primero), colores, plegado, movimientos y asignación por nombre.

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

// Sube (-1) o baja (+1) un grupo dentro de su bloque (fijados / no fijados) según el orden mostrado.
export function moveGroup(groups, id, direction) {
  const ordered = orderGroups(groups);
  const index = ordered.findIndex((g) => g.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ordered.length || !ordered[index].pinned !== !ordered[target].pinned) return groups;
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  return ordered;
}

// Mueve uno o varios grupos (conservando su orden mostrado) antes o después de otro. Adoptan el estado de fijado del destino.
export function moveGroupsTo(groups, ids, targetId, where = 'before') {
  const ordered = orderGroups(groups);
  const set = new Set(ids);
  const moving = ordered.filter((g) => set.has(g.id));
  const target = ordered.find((g) => g.id === targetId);
  if (!moving.length || !target || set.has(targetId)) return groups;
  const rest = ordered.filter((g) => !set.has(g.id));
  const at = rest.findIndex((g) => g.id === targetId);
  rest.splice(where === 'after' ? at + 1 : at, 0, ...moving.map((g) => ({ ...g, pinned: !!target.pinned })));
  return rest;
}

export const moveGroupTo = (groups, id, targetId, where) => moveGroupsTo(groups, [id], targetId, where);

// Lleva un grupo al principio de su bloque (fijados / no fijados).
export function moveGroupToTop(groups, id) {
  const ordered = orderGroups(groups);
  const group = ordered.find((g) => g.id === id);
  if (!group) return groups;
  const first = ordered.find((g) => !g.pinned === !group.pinned);
  return first.id === id ? groups : moveGroupsTo(groups, [id], first.id, 'before');
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
