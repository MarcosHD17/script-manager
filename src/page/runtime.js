// Runtime inyectado en el mundo USER_SCRIPT de cada página.
// Debe ser autocontenido: se serializa con toString() y se ejecuta antes de cada script.
export function bootstrap(config) {
  const g = globalThis;
  if (g.__ScriptManager && g.__ScriptManager.version === config.version) {
    g.__ScriptManager.configure(config);
    return;
  }
  g.__smRestore?.();
  document.getElementById('__sm-dock')?.remove();

  const CSS = [
    '.dock{position:fixed;top:12px;right:12px;width:320px;max-height:calc(100vh - 24px);display:flex;flex-direction:column;background:var(--sm-surface,#fff);color:var(--sm-text,#202124);border:1px solid var(--sm-border,#dadce0);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.25);font:12px system-ui,sans-serif;z-index:2147483647}',
    '.head{display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:var(--sm-accent,#1a73e8);color:var(--sm-accent-text,#fff);border-radius:8px 8px 0 0}',
    '.list{overflow:auto;display:flex;flex-direction:column;gap:6px;padding:6px}',
    '.list[hidden]{display:none}',
    '.card{border:1px solid var(--sm-border,#e0e0e0);border-radius:6px;overflow:hidden}',
    '.card-head{display:flex;justify-content:space-between;align-items:center;padding:4px 6px;background:var(--sm-surface2,#f1f3f4);font-weight:600}',
    '.card-body{padding:6px}',
    '.card.collapsed .card-body{display:none}',
    'button{cursor:pointer;border:0;background:transparent;font-size:14px;color:inherit;padding:0 4px}'
  ].join('');
  const NEUTRAL = [
    ['position', 'static'], ['top', 'auto'], ['right', 'auto'], ['bottom', 'auto'], ['left', 'auto'],
    ['z-index', 'auto'], ['margin', '0'], ['transform', 'none'], ['max-width', '100%']
  ];

  // Paletas del contenedor (las mismas que los temas de las ventanas de la extensión).
  const PALETTES = {
    light: { surface: '#ffffff', surface2: '#f1f3f4', text: '#202124', border: '#dadce0', accent: '#1a73e8', accentText: '#ffffff', scheme: 'light' },
    dark: { surface: '#26262b', surface2: '#303036', text: '#e8eaed', border: '#3c4043', accent: '#8ab4f8', accentText: '#202124', scheme: 'dark' },
    midnight: { surface: '#111a2e', surface2: '#18243d', text: '#dbe6ff', border: '#26365a', accent: '#5b9dff', accentText: '#06101f', scheme: 'dark' },
    forest: { surface: '#17231d', surface2: '#1f3027', text: '#dcefe3', border: '#2c4538', accent: '#5fcf8a', accentText: '#06150d', scheme: 'dark' },
    sepia: { surface: '#fbf5e6', surface2: '#eadfc4', text: '#433422', border: '#d6c8a6', accent: '#a0522d', accentText: '#ffffff', scheme: 'light' }
  };

  const panels = new Map();
  const owners = new WeakMap(); // elemento -> id del script que lo creó
  const state = { dock: config.dock, auto: config.auto, theme: config.theme ?? 'auto' };
  let host = null;
  let listEl = null;
  let depth = 0; // >0 mientras el propio runtime manipula el DOM (evita auto-detectarse)
  let current = null; // script en ejecución síncrona (atribución de componentes auto-detectados)
  const churn = new Map(); // clave -> { n, t }: registros recientes (freno anti-bucle)

  // Si un script recrea su componente en cuanto lo movemos al contenedor (porque ya no lo encuentra con
  // document.getElementById), se formaría un bucle infinito que congela la página: tras 8 registros en 1 s se deja de intervenir.
  function tooChurny(key) {
    const now = Date.now();
    const rec = churn.get(key) ?? { n: 0, t: now };
    if (now - rec.t > 1000) { rec.n = 0; rec.t = now; }
    rec.n++;
    churn.set(key, rec);
    return rec.n > 8;
  }

  // "auto" sigue el tema claro/oscuro del sistema.
  function applyDockTheme() {
    if (!host) return;
    const prefersDark = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
    const name = PALETTES[state.theme] ? state.theme : (prefersDark ? 'dark' : 'light');
    const p = PALETTES[name];
    host.style.setProperty('--sm-surface', p.surface);
    host.style.setProperty('--sm-surface2', p.surface2);
    host.style.setProperty('--sm-text', p.text);
    host.style.setProperty('--sm-border', p.border);
    host.style.setProperty('--sm-accent', p.accent);
    host.style.setProperty('--sm-accent-text', p.accentText);
    host.style.setProperty('color-scheme', p.scheme);
  }

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
      // Si un script elimina su componente mientras está en el contenedor, se limpia la tarjeta.
      new MutationObserver(() => render()).observe(listEl, { childList: true, subtree: true });
    }
    applyDockTheme();
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
    depth++;
    try {
      for (const [key, item] of panels) {
        if (item.auto && !item.el.isConnected) { item.card?.remove(); panels.delete(key); }
      }
      const items = [...panels.values()];
      if (state.dock && items.length >= 2) {
        ensureHost();
        items.forEach((item) => { if (!item.docked) dock(item); });
      } else {
        items.forEach(free);
        host?.remove();
      }
    } finally {
      depth--;
    }
  }

  function remove(key) {
    const item = panels.get(key);
    if (!item) return;
    panels.delete(key);
    depth++;
    try {
      item.card?.remove();
      item.el.remove();
    } finally {
      depth--;
    }
    render();
  }

  function register(key, el, title, auto, owner) {
    remove(key); // re-ejecutar un script reemplaza su componente anterior
    if (owner) owners.set(el, owner);
    const item = {
      key, el, title, auto,
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

  // Auto-detección: elementos flotantes (position:fixed) que un script añade directamente a <body>/<html>.
  function maybeAutoMount(node) {
    if (!state.auto || depth > 0 || !(node instanceof Element)) return;
    if (node === host || node.hasAttribute('data-sm-ignore') || !node.isConnected) return;
    for (const item of panels.values()) if (item.el === node) return;
    if (getComputedStyle(node).position !== 'fixed') return;
    const rect = node.getBoundingClientRect();
    if (rect.width > innerWidth * 0.6 || rect.height > innerHeight * 0.6) return; // overlays/modales grandes se ignoran
    const label = node.getAttribute('aria-label') || node.id || node.textContent.trim().slice(0, 24) || node.tagName.toLowerCase();
    const suffix = node.id || (current ? current.count++ : label);
    const key = current ? `${current.id}:auto:${suffix}` : `auto:${suffix}`;
    if (tooChurny(key)) return; // el componente queda flotante donde el script lo puso
    register(key, node, current ? current.name : label, true, current?.id);
  }

  // Parches limitados a este mundo aislado: solo afectan a llamadas hechas por los scripts de usuario, no a la página.
  const patches = [];
  function patch(proto, name, pick) {
    const original = proto[name];
    if (typeof original !== 'function') return;
    proto[name] = function (...args) {
      const result = original.apply(this, args);
      if (depth === 0 && (this === document.body || this === document.documentElement)) {
        try { pick(args).forEach(maybeAutoMount); } catch { /* nunca romper al script de usuario */ }
      }
      return result;
    };
    patches.push([proto, name, original]);
  }
  patch(Node.prototype, 'appendChild', (a) => [a[0]]);
  patch(Node.prototype, 'insertBefore', (a) => [a[0]]);
  patch(Element.prototype, 'append', (a) => a);
  patch(Element.prototype, 'prepend', (a) => a);
  patch(Element.prototype, 'insertAdjacentElement',
    (a) => (['beforeend', 'afterbegin'].includes(String(a[0]).toLowerCase()) ? [a[1]] : []));
  // Aislamiento: mientras corre un script, getElementById no devuelve componentes creados por otro script.
  // Evita que scripts que reutilizan el mismo id (p. ej. "limpiar botón anterior") se borren entre sí.
  const originalGetById = Document.prototype.getElementById;
  Document.prototype.getElementById = function (id) {
    const found = originalGetById.call(this, id);
    if (found && current) {
      const owner = owners.get(found);
      if (owner && owner !== current.id) {
        const selector = '[id="' + String(id).replace(/["\\]/g, '\\$&') + '"]';
        for (const candidate of this.querySelectorAll(selector)) {
          const candidateOwner = owners.get(candidate);
          if (!candidateOwner || candidateOwner === current.id) return candidate;
        }
        return null;
      }
    }
    return found;
  };
  patches.push([Document.prototype, 'getElementById', originalGetById]);
  g.__smRestore = () => patches.forEach(([proto, name, original]) => { proto[name] = original; });

  g.__ScriptManager = {
    version: config.version,
    configure(cfg) { state.dock = cfg.dock; state.auto = cfg.auto; state.theme = cfg.theme ?? state.theme; render(); applyDockTheme(); },
    begin(id, name) { current = { id, name, count: 0 }; },
    end() { current = null; },
    forScript(scriptId, scriptName) {
      return {
        mount: (el, opts = {}) => register(`${scriptId}:${opts.id ?? 'main'}`, el, opts.title ?? scriptName, false, scriptId)
      };
    }
  };
}
