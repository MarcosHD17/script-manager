// Orden automático de scripts y construcción de las secciones visibles (grupos + "sin grupo").
// El orden manual es el orden del arreglo `scripts`; los modos de orden solo cambian la vista.
import { orderGroups } from './groups.js';

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
  const sections = orderGroups(groups).map((group) => ({
    group,
    scripts: sortScripts(scripts.filter((s) => s.group === group.id), mode)
  }));
  sections.push({ group: null, scripts: sortScripts(scripts.filter((s) => !s.group || !known.has(s.group)), mode) });
  return sections;
}

// "Congela" el orden mostrado (grupos y modo de orden) como orden manual del arreglo.
export function bakeOrder(scripts, groups, mode) {
  return buildSections(scripts, groups, mode).flatMap((section) => section.scripts);
}
