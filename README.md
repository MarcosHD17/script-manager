# Script Manager (prueba)

Extensión Manifest V3 que inyecta múltiples scripts por página, activables de forma independiente.

## Arquitectura
- `background.js`: al completar la carga de una pestaña ejecuta los scripts activos cuyo patrón coincida (`tabs.onUpdated` + `userScripts.execute`, mundo `USER_SCRIPT`); atiende ejecución manual (`run` / `runAll`) y guarda el estado de cada ejecución.
- `storage.js`: acceso compartido a `chrome.storage.local` (`scripts`, `runStatus`).
- `popup.*`: interruptor por script (varios activos a la vez), botón ▶ por script y "Ejecutar todos los activos".
- `options.*`: CRUD de scripts (nombre, patrones de URL, código, estado).

## Instalación
1. `chrome://extensions` > activar modo desarrollador > "Cargar descomprimida".
2. En Detalles de la extensión, activar "Permitir scripts de usuario" (Chrome 138+; requiere Chrome 135+ por `userScripts.execute`).

## Modelo de datos
`{ id, name, matches: string[], code, enabled }`. Los patrones siguen el formato de match patterns de Chrome.

## Versionado
Versión en `manifest.json` (SemVer) y historial en `CHANGELOG.md`. Incrementar `version` en cada entrega; se muestra en el popup.
