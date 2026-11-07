// Arrastre con eventos de puntero (ordenar scripts y grupos, mover entre grupos).
import { getScripts, setScripts, getGroups, setGroups, getSettings, setSettings } from '../../data/storage.js';
import { moveMany, bakeOrder, ensureGroupColors, moveGroupsTo } from '../../core/organize/index.js';
import { list } from './dom.js';

const DRAG_THRESHOLD = 5;
let drag = null;

// Inicia un arrastre pendiente; se activa al superar el umbral de movimiento.
export function beginDrag(info) {
  drag = { ...info, active: false, drop: null };
}

function clearDropMarks() {
  list.querySelectorAll('.drop-before, .drop-after, .drop-into').forEach((el) => el.classList.remove('drop-before', 'drop-after', 'drop-into'));
}

function endDragUI() {
  clearDropMarks();
  document.querySelector('.drag-ghost')?.remove();
  document.body.classList.remove('is-dragging');
  list.querySelectorAll('.dragging').forEach((el) => el.classList.remove('dragging'));
}

function updateDropTarget(e) {
  clearDropMarks();
  drag.drop = null;
  const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('li[data-id], li.group-head');
  if (!target) return;
  if (drag.kind === 'group') {
    const targetGroupId = target.dataset.id ? target.dataset.group : target.dataset.groupId;
    if (!targetGroupId || targetGroupId === drag.id) return;
    const anchor = list.querySelector(`li.group-head[data-group-id="${CSS.escape(targetGroupId)}"]`) ?? target;
    const rect = anchor.getBoundingClientRect();
    const after = e.clientY >= rect.top + rect.height / 2;
    drag.drop = { targetGroupId, where: after ? 'after' : 'before' };
    anchor.classList.add(after ? 'drop-after' : 'drop-before');
    return;
  }
  if (target.dataset.id) {
    if (target.dataset.id === drag.id) return;
    const rect = target.getBoundingClientRect();
    const after = e.clientY >= rect.top + rect.height / 2;
    drag.drop = { targetId: target.dataset.id, where: after ? 'after' : 'before', groupId: target.dataset.group || null };
    target.classList.add(after ? 'drop-after' : 'drop-before');
  } else {
    drag.drop = { targetId: null, where: 'end', groupId: target.dataset.groupId || null };
    target.classList.add('drop-into');
  }
}

function autoScroll(e) {
  const rect = list.getBoundingClientRect();
  if (e.clientY < rect.top + 30) list.scrollTop -= 12;
  else if (e.clientY > rect.bottom - 30) list.scrollTop += 12;
}

async function commitDrop({ id, drop, kind }) {
  if (!drop) return;
  if (kind === 'group') return setGroups(moveGroupsTo(await getGroups(), [id], drop.targetGroupId, drop.where));
  const [scripts, groups, settings] = await Promise.all([getScripts(), getGroups(), getSettings()]);
  let base = scripts;
  // Con un orden automático, soltar en una posición concreta pasa a Manual conservando lo que se veía.
  if (settings.sort !== 'manual' && drop.targetId) {
    base = bakeOrder(scripts, ensureGroupColors(groups).groups, settings.sort);
    await setSettings({ ...settings, sort: 'manual' });
  }
  await setScripts(moveMany(base, [id], drop));
}

// Registra los listeners globales de puntero y teclado (llamar una vez al arrancar).
export function registerDrag() {
  document.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD) return;
      drag.active = true;
      list.querySelector(drag.kind === 'group' ? `li.group-head[data-group-id="${CSS.escape(drag.id)}"]` : `li[data-id="${CSS.escape(drag.id)}"]`)?.classList.add('dragging');
      const ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      ghost.textContent = drag.kind === 'group' ? `📁 ${drag.name}` : drag.name;
      document.body.append(ghost);
      document.body.classList.add('is-dragging');
    }
    const ghost = document.querySelector('.drag-ghost');
    if (ghost) { ghost.style.left = `${e.clientX + 12}px`; ghost.style.top = `${e.clientY + 8}px`; }
    updateDropTarget(e);
    autoScroll(e);
  });
  document.addEventListener('pointerup', () => {
    if (!drag) return;
    const finished = drag;
    drag = null;
    if (!finished.active) return;
    endDragUI();
    commitDrop(finished);
  });
  document.addEventListener('pointercancel', () => { drag = null; endDragUI(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drag?.active) { drag = null; endDragUI(); } });
}
