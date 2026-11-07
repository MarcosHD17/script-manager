// Ajustes rápidos del popup (agrupar flotantes y detección automática) como botones ON/OFF.
import { getSettings, setSettings } from '../../data/storage.js';

const settingButtons = [['dock', 'Agrupar flotantes en una lista (si hay 2 o más)'], ['auto', 'Detectar flotantes automáticamente']];
export async function renderSettings() {
  const settings = await getSettings();
  const box = document.getElementById('opts');
  box.replaceChildren(...settingButtons.map(([key, label]) => {
    const button = document.createElement('button');
    button.className = `tgl opt-btn ${settings[key] ? 'all' : 'none'}`;
    button.textContent = `${settings[key] ? '●' : '○'} ${label}`;
    button.addEventListener('click', async () => setSettings({ ...(await getSettings()), [key]: !settings[key] }));
    return button;
  }));
}
