// Disponibilidad de la API userScripts y configuración de su mundo.
// Comprueba que la API userScripts esté disponible y el permiso de usuario activado.
export async function isAvailable() {
  try {
    await chrome.userScripts.getScripts();
    return typeof chrome.userScripts.execute === 'function';
  } catch {
    return false;
  }
}

// El mundo USER_SCRIPT necesita messaging para hablar con el background (API GM_*).
let worldReady = false;
export async function ensureWorld() {
  if (worldReady) return;
  await chrome.userScripts.configureWorld({ messaging: true });
  worldReady = true;
}
