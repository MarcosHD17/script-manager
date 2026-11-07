// Formulario para crear un script nuevo desde el popup.
import { getScripts, setScripts } from '../../data/storage.js';
import { ctx } from './state.js';

export function registerNewForm() {
  const newForm = document.getElementById('newForm');
  document.getElementById('newScript').addEventListener('click', () => {
    newForm.hidden = !newForm.hidden;
    if (newForm.hidden) return;
    let origin = '';
    try { origin = new URL(ctx.activeUrl).origin; } catch { /* pestaña sin URL web */ }
    document.getElementById('newMatches').value = /^https?:/.test(origin) ? `${origin}/*` : '<all_urls>';
    document.getElementById('newCode').value = "console.log('Script Manager: script ejecutado en', location.href);";
    document.getElementById('newName').focus();
  });
  document.getElementById('newCancel').addEventListener('click', () => { newForm.hidden = true; });
  newForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const matches = document.getElementById('newMatches').value.split(/[\n,]/).map((m) => m.trim()).filter(Boolean);
    const now = Date.now();
    const script = {
      id: crypto.randomUUID(),
      name: document.getElementById('newName').value.trim() || 'Sin nombre',
      matches: matches.length ? matches : ['<all_urls>'],
      code: document.getElementById('newCode').value,
      enabled: true,
      grants: [],
      group: null,
      createdAt: now,
      updatedAt: now
    };
    await setScripts([...(await getScripts()), script]);
    document.getElementById('newName').value = '';
    newForm.hidden = true;
  });
}
