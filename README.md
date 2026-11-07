# Script Manager (prueba)

Extensión Manifest V3 que inyecta múltiples scripts por página, activables de forma independiente.

## Arquitectura
- `background.js`: sincroniza los scripts habilitados con `chrome.userScripts` (mundo `USER_SCRIPT`) ante cualquier cambio en storage.
- `storage.js`: acceso compartido a `chrome.storage.local` (`scripts`, `syncErrors`).
- `popup.*`: lista con interruptor por script (varios activos a la vez).
- `options.*`: CRUD de scripts (nombre, patrones de URL, código, estado).

## Instalación
1. `chrome://extensions` > activar modo desarrollador > "Cargar descomprimida".
2. En Detalles de la extensión, activar "Permitir scripts de usuario" (Chrome 138+).

## Modelo de datos
`{ id, name, matches: string[], code, enabled }`. Los patrones siguen el formato de match patterns de Chrome.
