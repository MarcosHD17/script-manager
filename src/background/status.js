// Estado de la última ejecución por script (persistido en storage).
import { getRunStatus, setRunStatus } from '../data/storage.js';

// Escrituras de estado serializadas para evitar pisarse entre ejecuciones concurrentes.
let statusQueue = Promise.resolve();
export function saveStatus(id, entry) {
  statusQueue = statusQueue.then(async () => {
    const all = await getRunStatus();
    all[id] = entry;
    await setRunStatus(all);
  }).catch((error) => console.error('Error guardando estado:', error));
  return statusQueue;
}
