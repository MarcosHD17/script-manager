// Utilidades DOM compartidas por popup y opciones.
export const $ = (id) => document.getElementById(id);

export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node[key] = value;
  }
  node.append(...children);
  return node;
}

export const formatDate = (ms) => new Date(ms).toLocaleString();
