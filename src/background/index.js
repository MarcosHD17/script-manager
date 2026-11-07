// Service worker: punto de entrada. Cada responsabilidad vive en su módulo.
import { registerGMHost } from './gm-host.js';
import { registerMessages } from './listeners/messages.js';
import { registerAutoRun } from './listeners/auto-run.js';
import { registerInstall } from './listeners/install.js';

// Los listeners se registran de forma síncrona al arrancar el service worker.
registerGMHost();
registerMessages();
registerAutoRun();
registerInstall();
