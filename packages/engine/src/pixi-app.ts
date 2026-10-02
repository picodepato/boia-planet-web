import { AccessibilitySystem, Application } from 'pixi.js';
// Sombreadores y uniforms sin `new Function`: así la CSP no necesita
// `'unsafe-eval'` en producción (REQ-ARQ-012). Todas las Application del
// motor salen de aquí, así que basta con importarlo una vez.
import 'pixi.js/unsafe-eval';

/**
 * Aplicaciones Pixi del motor (juego, entrada y la prueba de la esfera), con
 * el sistema de accesibilidad de Pixi apagado (T29).
 *
 * Ese sistema, en móvil, mete en `<body>` un `<button>` invisible («select to
 * enable accessibility for this content») que es una parada del tabulador y
 * lo anuncia el lector de pantalla; en escritorio, el Tab lo activa y pone
 * divs sobre el canvas. El camino accesible del juego es el HTML (HUD, Menú,
 * paneles), no el canvas.
 *
 * No basta con `extensions.remove(AccessibilitySystem)`: Pixi lo registra al
 * cargar su entorno de navegador y el renderer lo recoge de la cola cuando se
 * carga su propio chunk, después. Así que el sistema sigue existiendo, pero
 * sin su botón (`_createTouchHook`, privado; la e2e de `juego-hud.spec.ts`
 * avisa si Pixi lo cambia) y sin activarse con el Tab (opción pública).
 */
let accessibilityOff = false;

export function disablePixiAccessibility(): void {
  if (accessibilityOff) return;
  accessibilityOff = true;
  AccessibilitySystem.defaultOptions.activateOnTab = false;
  AccessibilitySystem.defaultOptions.enabledByDefault = false;
  (AccessibilitySystem.prototype as unknown as { _createTouchHook(): void })._createTouchHook =
    () => {};
}

export function newApplication(): Application {
  disablePixiAccessibility();
  return new Application();
}
