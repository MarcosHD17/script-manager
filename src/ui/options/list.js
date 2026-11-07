// Render de la lista: secciones por grupo, filas de scripts y estado de selección.
import { getScripts, getRunStatus, getGroups, getSettings } from '../../data/storage.js';
import { buildSections, ensureGroupColors } from '../../core/organize/index.js';
import { h } from '../shared/dom.js';
import { els } from './dom.js';
import { state, selected, selectedGroups } from './state.js';
import { groupHeader } from './group-header.js';
import { scriptRow } from './script-row.js';
import { updateBulkBar } from './bulk.js';

export async function renderList() {
  const [scripts, storedGroups, statuses, settings] = await Promise.all([getScripts(), getGroups(), getRunStatus(), getSettings()]);
  const groups = ensureGroupColors(storedGroups).groups;
  const query = els.search.value.trim().toLowerCase();
  const matches = (s) => !query || s.name.toLowerCase().includes(query) || s.matches.join(' ').toLowerCase().includes(query);
  const sections = buildSections(scripts, groups, settings.sort).map((s) => ({ ...s, scripts: s.scripts.filter(matches) }));

  const collapsedOf = (section) => (section.group ? section.group.collapsed : settings.ungroupedCollapsed);
  const anyOpen = groups.some((g) => !g.collapsed) || !settings.ungroupedCollapsed;
  els.toggleAll.hidden = groups.length === 0;
  els.toggleAll.textContent = anyOpen ? '⊟ Contraer todo' : '⊞ Desplegar todo';
  els.items.replaceChildren();
  state.visibleIds = [];
  for (const section of sections) {
    if (query && section.scripts.length === 0) continue;
    const container = groups.length ? h('div', { class: 'section' + (section.group ? '' : ' none') }) : els.items;
    if (groups.length) {
      if (section.group) container.style.setProperty('--gcolor', section.group.color);
      container.append(groupHeader(section, groups, collapsedOf(section)));
      els.items.append(container);
    }
    if (groups.length && collapsedOf(section)) continue;
    for (const script of section.scripts) {
      container.append(scriptRow(script, statuses));
      state.visibleIds.push(script.id);
    }
  }
  if (!scripts.length) els.items.append(h('div', { class: 'empty', textContent: 'Sin scripts. Pega uno en el editor o impórtalo.' }));
  else if (!state.visibleIds.length && query) els.items.append(h('div', { class: 'empty', textContent: 'Ningún script coincide con la búsqueda.' }));

  const existing = new Set(scripts.map((s) => s.id));
  for (const id of [...selected]) if (!existing.has(id)) selected.delete(id);
  const knownGroups = new Set(groups.map((g) => g.id));
  for (const id of [...selectedGroups]) if (!knownGroups.has(id)) selectedGroups.delete(id);
  updateBulkBar(groups);
}
