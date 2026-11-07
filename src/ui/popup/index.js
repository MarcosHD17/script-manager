// Punto de entrada del popup: conecta los módulos y arranca.
import { $ } from '../shared/dom.js';
import { initTheme } from '../shared/theme.js';
import { ctx } from './state.js';
import { checkStatus, getActiveTabId } from './status.js';
import { render } from './list.js';
import { registerDrag } from './drag.js';
import { registerTools } from './tools.js';
import { registerNewForm } from './new-form.js';
import { renderSettings } from './settings.js';
import { openOptions } from './actions.js';

$('title').textContent = `Script Manager v${chrome.runtime.getManifest().version}`;

registerDrag();
registerTools();
registerNewForm();
$('runAll').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'runAll', tabId: await getActiveTabId() });
});
$('openOptions').addEventListener('click', () => openOptions());

chrome.storage.onChanged.addListener(render);
chrome.storage.onChanged.addListener(renderSettings);
renderSettings();

initTheme();
chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => { ctx.activeUrl = tab?.url ?? ''; }).catch(() => {})
  .finally(() => checkStatus().then(render));
