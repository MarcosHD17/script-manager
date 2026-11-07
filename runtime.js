// Runtime inyectado en el mundo USER_SCRIPT de cada página.
// Debe ser autocontenido: se serializa con toString() y se ejecuta antes de cada script.
export function bootstrap(config) {
  const g = globalThis;
  if (g.__ScriptManager && g.__ScriptManager.version === config.version) {
    g.__ScriptManager.configure(config);
    return;
  }
  document.getElementById('__sm-dock')?.remove();

  const CSS = [
    '.dock{position:fixed;top:12px;right:12px;width:320px;max-height:calc(100vh - 24px);display:flex;flex-direction:column;background:#fff;color:#202124;border:1px solid #dadce0;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.25);font:12px system-ui,sans-serif;z-index:2147483647}',
    '.head{display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:#1a73e8;color:#fff;border-radius:8px 8px 0 0}',
    '.list{overflow:auto;display:flex;flex-direction:column;gap:6px;padding:6px}',
    '.list[hidden]{display:none}',
    '.card{border:1px solid #e0e0e0;border-radius:6px;overflow:hidden}',
    '.card-head{display:flex;justify-content:space-between;align-items:center;padding:4px 6px;background:#f1f3f4;font-weight:600}',
    '.card-body{padding:6px}',
    '.card.collapsed .card-body{display:none}',
    'button{cursor:pointer;border:0;background:transparent;font-size:14px;color:inherit;padding:0 4px}'
  ].join('');
  const NEUTRAL = [
    ['position', 'static'], ['top', 'auto'], ['right', 'auto'], ['bottom', 'auto'], ['left', 'auto'],
    ['z-index', 'auto'], ['margin', '0'], ['transform', 'none'], ['max-width', '100%']
  ];

  const panels = new Map();
  const state = { dock: config.dock };
  let host = null;
  let listEl = null;

  function makeButton(label, title) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.title = title;
    return btn;
  }

  function ensureHost() {
    if (!host) {
      host = document.createElement('div');
      host.id = '__sm-dock';
      const shadow = host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = CSS;
      const dockEl = document.createElement('div');
      dockEl.className = 'dock';
      const head = document.createElement('div');
      head.className = 'head';
      const title = document.createElement('b');
      title.textContent = 'Script Manager';
      const min = makeButton('–', 'Minimizar');
      listEl = document.createElement('div');
      listEl.className = 'list';
      min.addEventListener('click', () => { listEl.hidden = !listEl.hidden; });
      head.append(title, min);
      dockEl.append(head, listEl);
      shadow.append(style, dockEl);
    }
    if (!host.isConnected) document.documentElement.appendChild(host);
  }

  function buildCard(item) {
    const card = document.createElement('div');
    card.className = 'card';
    const head = document.createElement('div');
    head.className = 'card-head';
    const title = document.createElement('span');
    title.textContent = item.title;
    const actions = document.createElement('span');
    const fold = makeButton('–', 'Plegar');
    const close = makeButton('✕', 'Cerrar');
    fold.addEventListener('click', () => card.classList.toggle('collapsed'));
    close.addEventListener('click', () => remove(item.key));
    actions.append(fold, close);
    head.append(title, actions);
    const body = document.createElement('div');
    body.className = 'card-body';
    card.append(head, body);
    item.titleEl = title;
    item.card = card;
    item.body = body;
  }

  // Mueve el componente al contenedor y anula su posicionamiento flotante.
  function dock(item) {
    if (!item.card) buildCard(item);
    for (const [prop, value] of NEUTRAL) item.el.style.setProperty(prop, value, 'important');
    item.body.append(item.el);
    listEl.append(item.card);
    item.docked = true;
  }

  // Devuelve el componente a su estado flotante original.
  function free(item) {
    if (!item.docked) {
      if (!item.el.isConnected) document.documentElement.append(item.el);
      return;
    }
    item.card.remove();
    item.docked = false;
    item.el.style.cssText = item.savedCss;
    const parent = item.savedParent && item.savedParent.isConnected ? item.savedParent : document.documentElement;
    parent.append(item.el);
  }

  // El contenedor solo aplica con 2+ componentes; con uno solo se respeta su posición original.
  function render() {
    const items = [...panels.values()];
    if (state.dock && items.length >= 2) {
      ensureHost();
      items.forEach((item) => { if (!item.docked) dock(item); });
    } else {
      items.forEach(free);
      host?.remove();
    }
  }

  function remove(key) {
    const item = panels.get(key);
    if (!item) return;
    panels.delete(key);
    item.card?.remove();
    item.el.remove();
    render();
  }

  function mount(scriptId, scriptName, el, opts = {}) {
    const key = `${scriptId}:${opts.id ?? 'main'}`;
    remove(key); // re-ejecutar un script reemplaza su componente anterior
    const item = {
      key, el, title: opts.title ?? scriptName,
      savedCss: el.style.cssText, savedParent: el.parentNode, docked: false, card: null
    };
    panels.set(key, item);
    render();
    return {
      element: el,
      remove: () => remove(key),
      setTitle: (text) => { item.title = text; if (item.titleEl) item.titleEl.textContent = text; }
    };
  }

  g.__ScriptManager = {
    version: config.version,
    configure(cfg) { state.dock = cfg.dock; render(); },
    forScript(scriptId, scriptName) {
      return { mount: (el, opts) => mount(scriptId, scriptName, el, opts) };
    }
  };
}
