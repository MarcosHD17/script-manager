// Acciones del popup sobre scripts y navegación.
import { getScripts, setScripts, getGroups, getSettings, setSettings } from '../../data/storage.js';
import { bakeOrder, moveToTop, ensureGroupColors } from '../../core/organize/index.js';

export async function sendToTop(id) {
  const [scripts, groups, settings] = await Promise.all([getScripts(), getGroups(), getSettings()]);
  let base = scripts;
  if (settings.sort !== 'manual') {
    base = bakeOrder(scripts, ensureGroupColors(groups).groups, settings.sort);
    await setSettings({ ...settings, sort: 'manual' });
  }
  await setScripts(moveToTop(base, id));
}

export function openOptions(hash = '') {
  chrome.tabs.create({ url: chrome.runtime.getURL('pages/options.html') + hash });
}
