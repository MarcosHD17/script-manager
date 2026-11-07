// Arrastre con eventos de puntero para scripts y grupos (no depende del arrastre nativo del navegador).
import { getScripts, setScripts, getGroups, setGroups, getSettings, setSettings } from '../../data/storage.js';
import { moveMany, moveGroupsTo, bakeOrder } from '../../core/organize/index.js';
import { h } from '../shared/dom.js';
import { els, showMessage } from './dom.js';
import { state, hooks, selected, selectedGroups } from './state.js';

const DRAG_THRESHOLD = 5;
let drag = null;

// Inicia un arrastre pendiente; se activa al superar el umbral de movimiento.
export function beginDrag(info) {
  drag = { ...info, active: false, drop: null, ids: [] };
}

const itemsOf = (ids) => [...els.items.querySelectorAll('.item')].filter((row) => ids.includes(row.dataset.id));

// ----- Arrastre con eventos de puntero (no depende del arrastre nativo del navegador) -----
function clearDropMarks() {
  els.items.querySelectorAll('.drop-before, .drop-after, .drop-into').forEach((el) => el.classList.remove('drop-before', 'drop-after', 'drop-into'));
  els.items.classList.remove('drop-end');
}

function endDragUI() {
  clearDropMarks();
  document.querySelector('.drag-ghost')?.remove();
  document.body.classList.remove('is-dragging');
  els.items.querySelectorAll('.dragging').forEach((el) => el.classList.remove('dragging'));
}

function startDrag() {
  drag.active = true;
  if (drag.kind === 'group') {
    drag.ids = selectedGroups.has(drag.id) && selectedGroups.size > 1 ? [...selectedGroups] : [drag.id];
    drag.ids.forEach((gid) => els.items.querySelector(`.group-row[data-group-id="${CSS.escape(gid)}"]`)?.closest('.section')?.classList.add('dragging'));
    document.body.append(h('div', { class: 'drag-ghost', textContent: drag.ids.length > 1 ? `${drag.ids.length} grupos` : `📁 ${drag.name}` }));
    document.body.classList.add('is-dragging');
    return;
  }
  drag.ids = selected.has(drag.id) && selected.size > 1 ? [...selected] : [drag.id];
  itemsOf(drag.ids).forEach((row) => row.classList.add('dragging'));
  document.body.append(h('div', { class: 'drag-ghost', textContent: drag.ids.length > 1 ? `${drag.ids.length} scripts` : drag.name }));
  document.body.classList.add('is-dragging');
}

function updateDropTarget(e) {
  clearDropMarks();
  drag.drop = null;
  const hit = document.elementFromPoint?.(e.clientX, e.clientY);
  if (drag.kind === 'group') {
    const section = hit?.closest?.('.section');
    const targetGroupId = section?.querySelector('.group-row')?.dataset.groupId;
    if (!section || !targetGroupId || drag.ids.includes(targetGroupId)) return;
    const rect = section.getBoundingClientRect();
    const after = e.clientY >= rect.top + rect.height / 2;
    drag.drop = { targetGroupId, where: after ? 'after' : 'before' };
    section.classList.add(after ? 'drop-after' : 'drop-before');
    return;
  }
  const target = hit?.closest?.('.item, .group-row');
  if (target?.classList.contains('item')) {
    if (drag.ids.includes(target.dataset.id)) return;
    const rect = target.getBoundingClientRect();
    const after = e.clientY >= rect.top + rect.height / 2;
    drag.drop = { targetId: target.dataset.id, where: after ? 'after' : 'before', groupId: target.dataset.group || null };
    target.classList.add(after ? 'drop-after' : 'drop-before');
  } else if (target?.classList.contains('group-row')) {
    drag.drop = { targetId: null, where: 'end', groupId: target.dataset.groupId || null };
    target.classList.add('drop-into');
  } else if (hit && els.items.contains(hit)) {
    drag.drop = { targetId: null, where: 'end', groupId: null };
    els.items.classList.add('drop-end');
  }
}

function autoScroll(e) {
  const rect = els.items.getBoundingClientRect();
  if (e.clientY < rect.top + 40) els.items.scrollTop -= 14;
  else if (e.clientY > rect.bottom - 40) els.items.scrollTop += 14;
}

async function commitDrop({ ids, drop, kind, id }) {
  if (kind === 'group') {
    if (drop) await setGroups(moveGroupsTo(await getGroups(), ids, drop.targetGroupId, drop.where));
    return;
  }
  if (!drop || (drop.targetId && ids.includes(drop.targetId))) return;
  const [scripts, groups, settings] = await Promise.all([getScripts(), getGroups(), getSettings()]);
  let base = scripts;
  // Soltar en una posición concreta con un orden automático: se pasa a Manual conservando lo que se veía.
  if (settings.sort !== 'manual' && drop.targetId) {
    base = bakeOrder(scripts, groups, settings.sort);
    await setSettings({ ...settings, sort: 'manual' });
    showMessage('Orden cambiado a Manual para respetar la posición donde soltaste.');
  }
  await setScripts(moveMany(base, ids, drop));
  const group = groups.find((g) => g.id === drop.groupId);
  const moved = ids.some((id) => (scripts.find((s) => s.id === id)?.group ?? null) !== drop.groupId);
  if (moved) showMessage(`${ids.length} script(s) movido(s) a ${group ? `"${group.name}"` : 'sin grupo'}.`);
}

// Registra los listeners globales de puntero y teclado (llamar una vez al arrancar).
export function registerDrag() {
  document.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD) return;
      startDrag();
    }
    const ghost = document.querySelector('.drag-ghost');
    if (ghost) { ghost.style.left = `${e.clientX + 14}px`; ghost.style.top = `${e.clientY + 10}px`; }
    updateDropTarget(e);
    autoScroll(e);
  });
  document.addEventListener('pointerup', () => {
    if (!drag) return;
    const finished = drag;
    drag = null;
    if (!finished.active) return;
    endDragUI();
    state.suppressClick = true; // evita que el clic posterior al arrastre abra el script en el editor
    setTimeout(() => { state.suppressClick = false; }, 80);
    commitDrop(finished);
  });
  document.addEventListener('pointercancel', () => { drag = null; endDragUI(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (drag?.active) { drag = null; endDragUI(); } else if (selected.size || selectedGroups.size) { selected.clear(); selectedGroups.clear(); hooks.renderList(); }
  });
  els.items.addEventListener('click', (e) => { if (state.suppressClick) { e.stopPropagation(); e.preventDefault(); } }, true);
}
