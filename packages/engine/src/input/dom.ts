import { isControlKey, type KeyboardControls, type TouchControls } from './controls';

/**
 * Conecta los controles puros al DOM. Todo lo que puede dejar un dedo o una
 * tecla "pegados" (cancelación del puntero, pérdida de captura, cambio de
 * pestaña, pérdida de foco) suelta todo: nunca queda el acelerador bloqueado.
 */
export function bindInput(
  canvas: HTMLCanvasElement,
  touch: TouchControls,
  keys: KeyboardControls,
  /** Si devuelve true, el toque es de la interfaz del mundo (p. ej. un bocadillo) y no crea joystick. */
  claim?: (x: number, y: number) => boolean,
): () => void {
  const local = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onDown = (e: PointerEvent) => {
    e.preventDefault();
    const p = local(e);
    if (claim?.(p.x, p.y)) return;
    touch.down(e.pointerId, p.x, p.y);
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Sin captura el pointerup sigue llegando al canvas; no es crítico.
    }
  };
  const onMove = (e: PointerEvent) => {
    const p = local(e);
    touch.move(e.pointerId, p.x, p.y);
  };
  const onUp = (e: PointerEvent) => touch.up(e.pointerId);

  const onKeyDown = (e: KeyboardEvent) => {
    if (!isControlKey(e.code)) return;
    e.preventDefault();
    keys.down(e.code);
  };
  const onKeyUp = (e: KeyboardEvent) => keys.up(e.code);

  const releaseAll = () => {
    touch.releaseAll();
    keys.releaseAll();
  };
  const onVisibility = () => {
    if (document.visibilityState !== 'visible') releaseAll();
  };
  const noMenu = (e: Event) => e.preventDefault();

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('lostpointercapture', onUp);
  canvas.addEventListener('contextmenu', noMenu);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('lostpointercapture', onUp);
    canvas.removeEventListener('contextmenu', noMenu);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', releaseAll);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
