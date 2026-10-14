import { CRAB_BPM, alicanteHour, crabBeatPhase, isAfterHours } from '../characters';

/**
 * La isla del after (plan 029, T273): sólo existe de 03:00 a 07:00 de
 * Alicante (`Europe/Madrid`), sea cual sea el ambiente elegido en el menú.
 * Aparece a las 03:00 subiendo del agua y se va a las 07:00 aunque el barco
 * esté allí. Llegar la primera vez da el logro secreto «There's always an
 * after», muchas monedas y el barco del after. Aquí va lo puro: la ventana
 * horaria (con la hora de T270 y su `?hora=`), el reloj de la aparición, el
 * latido de las luces y el baile de los peces; el mar 3D lo pinta
 * (`apps/web/app/mar/engine/after.ts`, `mar3d.ts`).
 */

/** Id del lugar del mapa (`packages/world`), del logro y del barco. */
export const AFTER_PLACE_ID = 'after';
export const AFTER_ACHIEVEMENT_ID = 'siempre-hay-after';
/** Estilo del barco del after (`assetKey` del cosmético `barco-after`; `art/barco/3d/after.glb`). */
export const AFTER_SHIP_STYLE = 'after';
export const AFTER_SHIP_COSMETIC = 'barco-after';

/** Medidas de la isla del after (s, escena). muestra */
export const AFTER_TUNING = {
  /** s que tarda en salir del agua a las 03:00 y en hundirse a las 07:00. */
  fadeS: 8,
  /** Cada cuánto se mira el reloj (s). */
  checkS: 1,
  /** Pulsaciones por minuto de las luces y los peces (la de la radio del cangrejo, T270). */
  bpm: CRAB_BPM,
  /** Peces bailando alrededor de la isla y a qué radio (× el de la isla) nadan. */
  fish: 8,
  fishRadius: 1.28,
  /** Brillo mínimo del neón aunque sea de día en el menú (0..1) y cuánto late. */
  glowFloor: 0.7,
  pulse: 0.45,
} as const;

/** ¿Está abierto el after en el instante `now`? `override` es la hora de `?hora=`. */
export function afterOpen(now: Date = new Date(), override: number | null = null): boolean {
  return isAfterHours(alicanteHour(now, override));
}

export type AfterEvent =
  /** La isla sube del agua (son las 03:00, o se entra con el after abierto). */
  | { type: 'open' }
  /** La isla se hunde (son las 07:00). */
  | { type: 'close' };

/**
 * El reloj de la isla: mira la hora cada `checkS` s y lleva `fade` (0: bajo
 * el agua; 1: fuera) hacia donde toca a razón de `1 / fadeS` por segundo.
 * `step` devuelve los sucesos de este paso (lista reutilizada: vale hasta la
 * siguiente llamada). Con movimiento reducido, la isla aparece de golpe.
 */
export class AfterClock {
  /** ¿Abierto ahora (según el último vistazo al reloj)? */
  open = false;
  /** Cuánto se ve la isla (0..1). */
  fade = 0;
  private sinceCheck = Infinity;
  private readonly out: AfterEvent[] = [];
  private first = true;

  constructor(private readonly tuning: typeof AFTER_TUNING = AFTER_TUNING) {}

  step(
    dt: number,
    now: Date,
    override: number | null = null,
    reduced = false,
  ): readonly AfterEvent[] {
    this.out.length = 0;
    this.sinceCheck += dt;
    if (this.sinceCheck >= this.tuning.checkS) {
      this.sinceCheck = 0;
      const open = afterOpen(now, override);
      if (open !== this.open || this.first) {
        this.open = open;
        if (open) this.out.push({ type: 'open' });
        else if (!this.first) this.out.push({ type: 'close' });
        this.first = false;
      }
    }
    const target = this.open ? 1 : 0;
    if (reduced) this.fade = target;
    else if (this.fade < target) this.fade = Math.min(target, this.fade + dt / this.tuning.fadeS);
    else if (this.fade > target) this.fade = Math.max(target, this.fade - dt / this.tuning.fadeS);
    return this.out;
  }
}

/** Latido de las luces a los `t` s: 1 justo en el pulso, baja hasta 0 antes del siguiente. */
export function afterPulse(t: number, bpm: number = AFTER_TUNING.bpm): number {
  const phase = crabBeatPhase(t, bpm);
  const v = 1 - phase;
  return v * v;
}

/** El brillo del neón de la isla ahora: el del ambiente (o el mínimo) latiendo con la música. */
export function afterGlow(moodGlow: number, t: number, tuning = AFTER_TUNING): number {
  const base = Math.max(moodGlow, tuning.glowFloor);
  return base * (1 - tuning.pulse + tuning.pulse * afterPulse(t, tuning.bpm));
}

export interface FishPose {
  x: number;
  /** Altura sobre el agua (negativa: bajo el agua). */
  y: number;
  z: number;
  /** Rumbo (rad, como `rotation.y` de three). */
  yaw: number;
}

/**
 * Dónde está el pez `i` de `n` a los `t` s, alrededor de una isla de radio
 * `R` (escena): todos giran en corro y cada uno salta en su pulso. Puro y
 * determinista (misma `t`, misma pose), sin basura: escribe en `out`.
 */
export function fishPose(
  i: number,
  n: number,
  t: number,
  R: number,
  out: FishPose,
  tuning = AFTER_TUNING,
): FishPose {
  const r = R * tuning.fishRadius;
  const w = 0.35; // rad/s del corro
  const a = (i / Math.max(1, n)) * Math.PI * 2 + t * w;
  // Cada pez salta en un pulso distinto del compás (los pulsos van en círculo).
  const beats = (t * tuning.bpm) / 60;
  const beat = Math.floor(beats);
  const phase = beats - beat;
  const mine = ((beat % Math.max(1, n)) + n) % n === i;
  const jump = mine ? Math.sin(Math.min(1, phase * 1.6) * Math.PI) : 0;
  out.x = Math.cos(a) * r;
  out.z = Math.sin(a) * r;
  // Medio cuerpo fuera del agua; el que salta sube un buen trecho.
  out.y = 0.05 + jump * 1.6 + Math.sin(t * 2.2 + i) * 0.08;
  // Nadando en el sentido del corro (tangente), con la nariz arriba al saltar.
  out.yaw = -(a + Math.PI / 2);
  return out;
}
