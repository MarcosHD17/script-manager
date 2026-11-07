// Ajustes de apariencia de la página de opciones: tamaño de letra, orden de la lista y tema.
import { getSettings, setSettings } from '../../data/storage.js';
import { SORT_MODES } from '../../core/organize/index.js';
import { THEMES, applyTheme } from '../shared/theme.js';
import { h } from '../shared/dom.js';
import { els } from './dom.js';

const FONT_SIZES = [{ px: 13, label: 'Pequeña (13)' }, { px: 15, label: 'Mediana (15)' }, { px: 17, label: 'Grande (17)' }, { px: 19, label: 'Muy grande (19)' }, { px: 22, label: 'Enorme (22)' }];
const applyFont = (px) => { document.documentElement.style.fontSize = `${px || 13}px`; els.font.value = String(px || 13); };

// Refleja los ajustes guardados en los controles (se llama al arrancar y en cada cambio de storage).
export function syncAppearance(settings) {
  els.sort.value = settings.sort;
  els.theme.value = settings.theme;
  applyFont(settings.fontSize);
}

export function registerAppearance() {
  els.font.replaceChildren(...FONT_SIZES.map((f) => h('option', { value: String(f.px), textContent: f.label })));
  els.font.addEventListener('change', async () => {
    applyFont(Number(els.font.value));
    await setSettings({ ...(await getSettings()), fontSize: Number(els.font.value) });
  });
  els.sort.replaceChildren(...SORT_MODES.map((m) => h('option', { value: m.id, textContent: m.label })));
  els.theme.replaceChildren(...THEMES.map((t) => h('option', { value: t.id, textContent: t.label })));
  els.sort.addEventListener('change', async () => setSettings({ ...(await getSettings()), sort: els.sort.value }));
  els.theme.addEventListener('change', async () => {
    applyTheme(els.theme.value);
    await setSettings({ ...(await getSettings()), theme: els.theme.value });
  });
}
