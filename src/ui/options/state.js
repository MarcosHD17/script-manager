// Estado compartido de la página de opciones y puntos de enlace entre módulos.
// Los módulos no se importan entre sí en ciclo: llaman a `hooks`, que index.js rellena al arrancar.
export const state = {
  selectedId: null, // script abierto en el editor
  lastClickedId: null, // ancla para selección por rango (Mayús + clic)
  visibleIds: [], // ids visibles en el orden mostrado
  suppressClick: false // evita abrir el editor tras soltar un arrastre
};
export const selected = new Set(); // ids de scripts seleccionados para acciones en masa
export const selectedGroups = new Set(); // ids de grupos seleccionados

export const hooks = {
  renderList: async () => {},
  select: async () => {},
  clearEditor: () => {}
};
