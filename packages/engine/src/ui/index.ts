/**
 * HUD del juego sin Pixi ni DOM: colocación, minimapa, brújula, avisos y
 * ajustes. Se importa como `@boia/engine/ui` para que la interfaz HTML no
 * arrastre el motor (que se carga aparte, con import dinámico).
 */
export * from './discovery';
export * from './hud-layout';
export * from './minimap';
export * from './notifications';
export * from './settings';
export * from './storage';
export {
  DEFAULT_KEYBOARD_MODE,
  DEFAULT_SENSITIVITY,
  KEYBOARD_MODES,
  SENSITIVITY_RANGE,
  isKeyboardMode,
  setControlSensitivity,
  type ControlSensitivity,
  type KeyboardMode,
} from '../input/controls';
// Estilos y skins del barco (T11, T12): sin Pixi, para el menú y el servidor.
export * from '../ship-style';
