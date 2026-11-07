// Scripts de ejemplo que se crean en la primera instalación.
const DEMO_PANEL_CODE = (letter, color) =>
  "const box = document.createElement('div');\n" +
  "box.style.cssText = 'position:fixed;top:60px;right:20px;width:200px;padding:8px;background:" + color + ";border:1px solid #5f6368;border-radius:6px;font:12px sans-serif;z-index:2147483647';\n" +
  "box.textContent = 'Componente flotante " + letter + "';\n" +
  "ScriptManager.mount(box, { title: 'Demo " + letter + "' });";

export const DEFAULT_SCRIPTS = [
  { id: 'demo-panel-a', name: 'Demo: componente flotante A', matches: ['<all_urls>'], enabled: true, code: DEMO_PANEL_CODE('A', '#e8f0fe') },
  { id: 'demo-panel-b', name: 'Demo: componente flotante B', matches: ['<all_urls>'], enabled: true, code: DEMO_PANEL_CODE('B', '#fef7e0') },
  { id: 'demo-title', name: 'Demo: prefijo en el título', matches: ['<all_urls>'], enabled: false, code: "document.title = '[SM] ' + document.title;" }
];
