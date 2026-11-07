// Temas de las ventanas de la extensión (popup y opciones). El tema vive en los ajustes.
import { getSettings, STORAGE_KEYS } from '../../data/storage.js';

export const THEMES = [
  { id: 'auto', label: 'Automático (sistema)' },
  { id: 'light', label: 'Claro' },
  { id: 'dark', label: 'Oscuro' },
  { id: 'midnight', label: 'Medianoche' },
  { id: 'forest', label: 'Bosque' },
  { id: 'sepia', label: 'Sepia' }
];

export function applyTheme(theme) {
  if (!theme || theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

export async function initTheme() {
  applyTheme((await getSettings()).theme);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[STORAGE_KEYS.SETTINGS_KEY]) applyTheme(changes[STORAGE_KEYS.SETTINGS_KEY].newValue?.theme);
  });
}
