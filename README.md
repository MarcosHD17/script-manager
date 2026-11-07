# Script Manager (prueba)

Extensión Manifest V3 que inyecta múltiples scripts por página, activables de forma independiente.

## Arquitectura
- `background.js`: al completar la carga de una pestaña ejecuta los scripts activos cuyo patrón coincida (`tabs.onUpdated` + `userScripts.execute`, mundo `USER_SCRIPT`); atiende ejecución manual (`run` / `runAll`) y guarda el estado de cada ejecución.
- `storage.js`: acceso compartido a `chrome.storage.local` (`scripts`, `runStatus`).
- `popup.*`: interruptor por script (varios activos a la vez), botón ▶ por script y "Ejecutar todos los activos".
- `options.*`: CRUD de scripts (nombre, patrones de URL, código, estado).

## Instalación
1. `chrome://extensions` > activar modo desarrollador > "Cargar descomprimida".
2. Obligatorio: en Detalles de la extensión activar "Permitir scripts de usuario" (Chrome 135+). Sin él, el popup muestra una alerta y no se ejecuta nada.

## Modelo de datos
`{ id, name, matches: string[], code, enabled }`. Los patrones siguen el formato de match patterns de Chrome.

## API para componentes flotantes
```js
const box = document.createElement('div');
box.textContent = 'Mi panel';
const handle = ScriptManager.mount(box, { title: 'Mi panel', id: 'main' });
// handle.remove(); handle.setTitle('Otro título');
```
- Con 2+ componentes montados se agrupan en un contenedor tipo lista; con uno solo conserva su posición.
- Solo se agrupan los componentes montados con `mount`; elementos flotantes creados por otros medios no se detectan.
- Cada script corre en su propia función: sus variables no chocan con las de otros scripts.

## Versionado
Versión en `manifest.json` (SemVer) y historial en `CHANGELOG.md`. Incrementar `version` en cada entrega; se muestra en el popup.
