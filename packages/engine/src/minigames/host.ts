import { type EndSummary, MinigameController } from './controller';
import { minigame } from './registry';
import { type MinigameRewardSink, policyText, readBest, rewardText } from './rewards';
import { INVALID_TEXT, LocalSessionAuthority } from './session';
import { type WorldLook, minigameSkin } from './skin';
import { playCue } from './sound';
import { MINIGAME_CSS } from './styles';
import type { KeyValueStore } from '../ui/storage';
import type { MinigameInput, MinigameSim, Point } from './types';

/**
 * Anfitrión DOM de un minijuego (REQ-AVE-035, REQ-AVE-039): capa a pantalla
 * completa sobre el mar, sin React. Instrucciones breves, pausa y salida
 * claras, botón de acción grande, estado en texto, volumen, teclado,
 * movimiento reducido y pausa al ocultar la pestaña. Al salir, el barco
 * sigue donde estaba: esta capa no toca el motor del mar.
 *
 * El foco del teclado se queda en la capa y sus teclas no llegan al mar.
 */

export interface MountOptions {
  gameId: string;
  /** Mundo activo: elige el estilo del juego. */
  worldId?: string | null;
  theme?: WorldLook;
  sink?: MinigameRewardSink | null;
  records?: KeyValueStore | null;
  /** Por defecto, una autoridad por pestaña (se olvida al recargar). */
  authority?: LocalSessionAuthority;
  /** Volumen de efectos 0..1 (Ajustes). */
  volume?: number;
  reducedMotion?: boolean;
  onExit: (summary: EndSummary | null) => void;
  /** Telemetría: sólo nombres y números, nunca datos personales. */
  onEvent?: (name: string, data: Record<string, string | number | boolean | null>) => void;
}

export interface MountedMinigame {
  readonly controller: MinigameController;
  destroy(): void;
}

let tabAuthority: LocalSessionAuthority | null = null;
/** La autoridad de esta pestaña: sus sesiones mueren con la página. */
export function pageAuthority(): LocalSessionAuthority {
  tabAuthority ??= new LocalSessionAuthority();
  return tabAuthority;
}

function injectCss(doc: Document) {
  if (doc.getElementById('boia-minigame-css')) return;
  const style = doc.createElement('style');
  style.id = 'boia-minigame-css';
  style.textContent = MINIGAME_CSS;
  doc.head.append(style);
}

function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  props: Partial<Record<'className' | 'text' | 'testid' | 'type' | 'label', string>> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  if (props.className) e.className = props.className;
  if (props.text !== undefined) e.textContent = props.text;
  if (props.testid) e.dataset.testid = props.testid;
  if (props.type) e.setAttribute('type', props.type);
  if (props.label) e.setAttribute('aria-label', props.label);
  e.append(...children);
  return e;
}

export function mountMinigame(parent: HTMLElement, o: MountOptions): MountedMinigame {
  const found = minigame(o.gameId);
  if (!found) throw new Error(`minijuego desconocido: ${o.gameId}`);
  const def = found;
  const doc = parent.ownerDocument;
  const win = doc.defaultView ?? window;
  injectCss(doc);

  const skin = minigameSkin(o.worldId, o.theme);
  const reduced =
    o.reducedMotion ?? win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const volume = Math.max(0, Math.min(1, o.volume ?? 0.8));
  let localVolume = 1;
  const records = o.records ?? null;
  const controller = new MinigameController({
    def,
    authority: o.authority ?? pageAuthority(),
    sink: o.sink ?? null,
    records,
    currentConfig: () => def.defaults,
  });
  // Escena de fondo de las instrucciones: una partida quieta.
  const preview: MinigameSim = def.create(1, def.defaults);

  // --- DOM -------------------------------------------------------------------
  const root = el(doc, 'div', { className: 'mg', testid: 'minijuego' });
  root.tabIndex = -1;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', def.title);
  root.dataset.game = def.id;
  root.dataset.style = skin.style;
  root.style.setProperty('--mg-night', skin.night);
  root.style.setProperty('--mg-accent', skin.accent);
  root.style.setProperty('--mg-on-accent', skin.onAccent);
  root.style.setProperty('--mg-good', skin.good);
  root.style.setProperty('--mg-bad', skin.bad);

  const status = el(doc, 'p', { className: 'mg-status', testid: 'minijuego-estado' });
  const pauseBtn = el(doc, 'button', {
    className: 'mg-icon',
    type: 'button',
    testid: 'minijuego-pausa',
    label: 'Pausa',
    text: 'II',
  });
  const exitBtn = el(doc, 'button', {
    className: 'mg-icon',
    type: 'button',
    testid: 'minijuego-salir',
    label: 'Volver al mar',
    text: '✕',
  });
  const bar = el(
    doc,
    'header',
    { className: 'mg-bar' },
    el(
      doc,
      'div',
      { className: 'mg-heading' },
      el(doc, 'h2', { className: 'mg-title', text: def.title }),
      status,
    ),
    pauseBtn,
    exitBtn,
  );
  const canvas = el(doc, 'canvas', { className: 'mg-canvas' });
  canvas.setAttribute('aria-hidden', 'true');
  const feedback = el(doc, 'p', { className: 'mg-feedback', testid: 'minijuego-aviso' });
  feedback.setAttribute('aria-live', 'assertive');
  const stage = el(doc, 'div', { className: 'mg-stage' }, canvas, feedback);
  const actionBtn = el(doc, 'button', {
    className: 'mg-action',
    type: 'button',
    testid: 'minijuego-accion',
    text: def.actionLabel,
  });
  const hint = el(doc, 'span', { className: 'mg-hint', text: def.hint });
  const actions = el(doc, 'footer', { className: 'mg-actions' }, actionBtn, hint);
  root.append(bar, stage, actions);
  parent.append(root);

  const opener = doc.activeElement as HTMLElement | null;

  // --- Estado de pantalla ----------------------------------------------------
  let card: HTMLElement | null = null;
  let feedbackTimer = 0;
  let lastStatus = '';

  const setFeedback = (text: string, tone: 'good' | 'bad') => {
    feedback.textContent = text;
    feedback.dataset.tone = tone;
    win.clearTimeout(feedbackTimer);
    feedbackTimer = win.setTimeout(() => (feedback.textContent = ''), 1800);
  };

  const volumeControl = () => {
    const input = el(doc, 'input', { label: 'Volumen de los efectos' });
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.value = String(Math.round(localVolume * 100));
    input.dataset.testid = 'minijuego-volumen';
    input.addEventListener('input', () => {
      localVolume = Number(input.value) / 100;
    });
    return el(doc, 'label', { className: 'mg-volume' }, 'Volumen', input);
  };

  const button = (text: string, testid: string, primary: boolean, onClick: () => void) => {
    const b = el(doc, 'button', {
      className: primary ? 'mg-btn mg-primary' : 'mg-btn',
      type: 'button',
      text,
      testid,
    });
    b.addEventListener('click', onClick);
    return b;
  };

  const showCard = (kind: string, ...children: Node[]) => {
    card?.remove();
    card = el(doc, 'div', { className: 'mg-card', testid: `minijuego-${kind}` }, ...children);
    card.setAttribute('role', 'group');
    stage.append(card);
    card.querySelector<HTMLButtonElement>('.mg-primary')?.focus();
  };
  const hideCard = () => {
    card?.remove();
    card = null;
    root.focus();
  };

  const bestLine = () => {
    const best = readBest(records, def.id);
    return el(doc, 'p', {
      className: 'mg-small',
      text: best === null ? 'Aún no tienes marca.' : `Tu mejor marca: ${best}.`,
    });
  };

  const showIntro = () => {
    showCard(
      'intro',
      el(doc, 'h3', { text: def.title }),
      el(doc, 'p', { text: def.summary }),
      el(doc, 'ul', {}, ...def.instructions.map((t) => el(doc, 'li', { text: t }))),
      el(doc, 'p', {
        className: 'mg-small',
        text: policyText(def.defaults.reward, def.defaults.goal),
      }),
      bestLine(),
      volumeControl(),
      el(
        doc,
        'div',
        { className: 'mg-row' },
        button('Volver al mar', 'minijuego-volver', false, exit),
        button('Empezar', 'minijuego-empezar', true, start),
      ),
    );
  };

  const showPause = () => {
    const hidden = controller.pauseReason === 'hidden';
    showCard(
      'pausada',
      el(doc, 'h3', { text: 'Pausa' }),
      ...(hidden
        ? [
            el(doc, 'p', {
              className: 'mg-small',
              text: 'La pestaña se ocultó: esta partida ya no da premio. Puedes seguir jugando.',
            }),
          ]
        : []),
      volumeControl(),
      el(
        doc,
        'div',
        { className: 'mg-row' },
        button('Volver al mar', 'minijuego-volver', false, exit),
        button('Seguir', 'minijuego-seguir', true, resume),
      ),
    );
  };

  const showEnd = (s: EndSummary | null) => {
    const sim = controller.sim;
    const ending = sim?.ended;
    if (!ending) return;
    const rewardLine = el(doc, 'p', { testid: 'minijuego-premio' });
    if (!s) rewardLine.textContent = 'Guardando…';
    else if (s.reward.granted) rewardLine.textContent = rewardText(s.reward, def.defaults.reward);
    else if (!s.validation.valid)
      rewardLine.textContent = `Sin premio: ${INVALID_TEXT[s.validation.reason]}`;
    else rewardLine.textContent = rewardText(s.reward, def.defaults.reward);
    showCard(
      'final',
      el(doc, 'p', { className: 'mg-kicker', text: def.title }),
      el(doc, 'h3', {
        text: ending.outcome === 'won' ? '¡Premio conseguido!' : 'Fin de la partida',
      }),
      el(doc, 'p', {
        className: 'mg-score',
        testid: 'minijuego-marca',
        text: `${sim.score} puntos`,
      }),
      el(doc, 'p', { text: def.endText(ending) }),
      el(doc, 'p', {
        className: 'mg-small',
        text: sim
          .status()
          .map((i) => `${i.label}: ${i.value}`)
          .join(' · '),
      }),
      rewardLine,
      s
        ? el(doc, 'p', {
            className: 'mg-small',
            text:
              s.best === null ? '' : `Tu mejor marca: ${s.best}${s.newBest ? ' (¡nueva!)' : ''}.`,
          })
        : bestLine(),
      el(
        doc,
        'div',
        { className: 'mg-row' },
        button('Otra vez', 'minijuego-otra', false, start),
        button('Volver al mar', 'minijuego-volver', true, exit),
      ),
    );
  };

  const renderChrome = () => {
    root.dataset.phase = controller.phase;
    const sim = controller.sim;
    root.dataset.score = String(sim?.score ?? 0);
    if (sim?.ended) root.dataset.outcome = sim.ended.outcome;
    else delete root.dataset.outcome;
    actionBtn.disabled = controller.phase !== 'playing';
    pauseBtn.disabled = controller.phase === 'intro' || controller.phase === 'ended';
    pauseBtn.textContent = controller.phase === 'paused' ? '▶' : 'II';
    pauseBtn.setAttribute('aria-label', controller.phase === 'paused' ? 'Seguir' : 'Pausa');
    const items = (sim ?? preview).status();
    const text = items.map((i) => `${i.label} ${i.value}`).join(' · ');
    if (text !== lastStatus || status.dataset.counts !== String(controller.counts())) {
      lastStatus = text;
      status.textContent = '';
      items.forEach((i, n) => {
        if (n) status.append(' · ');
        status.append(`${i.label} `, el(doc, 'b', { text: i.value }));
      });
      const playing = controller.phase === 'playing' || controller.phase === 'paused';
      status.dataset.counts = String(controller.counts());
      if (playing && !controller.counts())
        status.append(el(doc, 'span', { className: 'mg-nocount', text: 'sin premio' }));
    }
  };

  // --- Acciones ----------------------------------------------------------------
  const input: {
    aim: Point | null;
    pull: Point | null;
    turn: number;
    lift: number;
    action: boolean;
  } = {
    aim: null,
    pull: null,
    turn: 0,
    lift: 0,
    action: false,
  };
  const keys = new Set<string>();

  function start() {
    controller.start();
    input.action = false;
    input.pull = null;
    hideCard();
    renderChrome();
    o.onEvent?.('minigame_start', { game: def.id, version: def.defaults.version });
  }
  function resume() {
    controller.resume();
    hideCard();
    renderChrome();
  }
  function pause() {
    if (controller.phase !== 'playing') return;
    controller.pause('user');
    showPause();
    renderChrome();
  }
  let exited = false;
  function exit() {
    if (exited) return;
    exited = true;
    const summary = controller.summary;
    if (controller.phase === 'playing' || controller.phase === 'paused') {
      o.onEvent?.('minigame_exit', { game: def.id, phase: controller.phase });
    }
    controller.abandon();
    destroy();
    o.onExit(summary);
  }

  pauseBtn.addEventListener('click', () => (controller.phase === 'paused' ? resume() : pause()));
  exitBtn.addEventListener('click', exit);
  actionBtn.addEventListener('click', () => {
    if (controller.phase === 'playing') input.action = true;
  });

  // Puntero y dedo: el punto de la escena que se señala.
  const toScene = (e: PointerEvent): Point => {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / Math.max(1, r.width),
      y: (e.clientY - r.top) / Math.max(1, r.height),
    };
  };
  // Faro: el haz va hacia el dedo (o sigue al ratón). Cañón: se arrastra
  // desde cualquier sitio (dirección = ángulo, longitud = potencia) y al
  // soltar dispara.
  const drags = def.id === 'canon';
  let dragging = false;
  let dragFrom: Point | null = null;
  const pullTo = (p: Point): Point | null =>
    dragFrom ? { x: p.x - dragFrom.x, y: p.y - dragFrom.y } : null;
  canvas.addEventListener('pointerdown', (e) => {
    if (controller.phase !== 'playing') return;
    dragging = true;
    canvas.setPointerCapture?.(e.pointerId);
    const p = toScene(e);
    if (drags) {
      dragFrom = p;
      input.pull = null;
    } else {
      input.aim = p;
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (controller.phase !== 'playing') return;
    const p = toScene(e);
    if (drags) {
      if (dragging) input.pull = pullTo(p);
    } else if (dragging || e.pointerType === 'mouse') {
      input.aim = p;
    }
  });
  const release = (e: PointerEvent, fire: boolean) => {
    if (!dragging) return;
    dragging = false;
    const p = toScene(e);
    if (drags) {
      input.pull = pullTo(p);
      dragFrom = null;
      if (fire && controller.phase === 'playing') input.action = true;
      return;
    }
    input.aim = p;
    if (e.pointerType !== 'mouse') input.aim = null;
  };
  canvas.addEventListener('pointerup', (e) => release(e, true));
  canvas.addEventListener('pointercancel', (e) => release(e, false));
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Teclado: nada llega al mar mientras la capa está abierta.
  const GAME_KEYS = new Set([
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'a',
    'd',
    'w',
    's',
    'A',
    'D',
    'W',
    'S',
    ' ',
    'Enter',
  ]);
  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      if (controller.phase === 'playing') pause();
      else if (controller.phase === 'paused') resume();
      else exit();
      return;
    }
    const onButton = (e.target as HTMLElement | null)?.closest?.('button, input');
    if ((e.key === ' ' || e.key === 'Enter') && onButton) return;
    if (!GAME_KEYS.has(e.key) || controller.phase !== 'playing') return;
    e.preventDefault();
    if (e.key === ' ' || e.key === 'Enter') {
      if (!e.repeat) input.action = true;
      return;
    }
    keys.add(e.key.toLowerCase());
    // El teclado manda: la mira deja de seguir al puntero hasta que se mueva.
    input.aim = null;
    input.pull = null;
  };
  const onKeyUp = (e: KeyboardEvent) => {
    e.stopPropagation();
    keys.delete(e.key.toLowerCase());
  };
  root.addEventListener('keydown', onKeyDown);
  root.addEventListener('keyup', onKeyUp);

  // Pestaña oculta: pausa (y la marca deja de contar).
  const onVisibility = () => {
    if (doc.visibilityState !== 'hidden') return;
    if (controller.phase === 'playing' || controller.phase === 'paused') {
      controller.pause('hidden');
      showPause();
      renderChrome();
    }
  };
  doc.addEventListener('visibilitychange', onVisibility);
  const onPageHide = () => controller.abandon();
  win.addEventListener('pagehide', onPageHide);

  // --- Bucle -------------------------------------------------------------------
  const ctx = canvas.getContext('2d');
  let raf = 0;
  let last = 0;
  let clock = 0;
  const frame = (t: number) => {
    raf = win.requestAnimationFrame(frame);
    const dt = last ? (t - last) / 1000 : 0;
    last = t;
    clock += dt;

    if (controller.phase === 'playing') {
      const k = (a: string, b: string) => (keys.has(a) || keys.has(b) ? 1 : 0);
      const step: MinigameInput = {
        aim: input.aim,
        pull: input.pull,
        turn: k('arrowright', 'd') - k('arrowleft', 'a'),
        lift: k('arrowup', 'w') - k('arrowdown', 's'),
        action: input.action,
      };
      input.action = false;
      // Un arrastre suelto ya apuntó: no se vuelve a aplicar.
      if (!dragging) input.pull = null;
      const events = controller.tick(dt, step);
      for (const ev of events) {
        playCue(ev.kind, volume * localVolume);
        const f = def.feedback(ev);
        if (f) setFeedback(f.text, f.tone);
      }
      // `tick` puede haber terminado la partida.
      if (controller.sim?.ended) {
        showEnd(null);
        const settling = controller.settling;
        void settling?.then((s) => {
          if (exited) return;
          showEnd(s);
          renderChrome();
          o.onEvent?.('minigame_end', {
            game: def.id,
            outcome: s.ending.outcome,
            reason: s.ending.reason,
            score: s.score,
            valid: s.validation.valid,
            granted: s.reward.granted,
          });
        });
      }
      renderChrome();
    }

    if (!ctx) return;
    const dpr = Math.min(2, win.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    (controller.sim ?? preview).draw(ctx, w, h, skin, { reducedMotion: reduced, clock });
  };

  function destroy() {
    win.cancelAnimationFrame(raf);
    win.clearTimeout(feedbackTimer);
    doc.removeEventListener('visibilitychange', onVisibility);
    win.removeEventListener('pagehide', onPageHide);
    root.remove();
    opener?.focus?.();
  }

  renderChrome();
  showIntro();
  raf = win.requestAnimationFrame(frame);

  return {
    controller: controller as unknown as MinigameController,
    destroy() {
      if (exited) return;
      exited = true;
      controller.abandon();
      destroy();
    },
  };
}
