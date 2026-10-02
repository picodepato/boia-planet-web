/**
 * Bucle de paso fijo: la simulación avanza siempre en pasos de `step`
 * segundos, sea cual sea la tasa de imágenes; el render interpola entre el
 * último estado y el anterior con `alpha`.
 */
export class FixedStepLoop {
  readonly step: number;
  /** Tope por imagen para no entrar en espiral tras una pausa larga. */
  readonly maxFrame: number;
  private acc = 0;

  constructor(hz = 60, maxFrame = 0.25) {
    this.step = 1 / hz;
    this.maxFrame = maxFrame;
  }

  /** Avanza `frameDt` segundos y devuelve alpha ∈ [0, 1) para interpolar. */
  advance(frameDt: number, update: (dt: number) => void): number {
    this.acc += Math.min(Math.max(frameDt, 0), this.maxFrame);
    // Tolerancia para que 60 imágenes de 1/60 s den exactamente 60 pasos.
    const eps = this.step * 1e-6;
    while (this.acc >= this.step - eps) {
      update(this.step);
      this.acc -= this.step;
    }
    if (this.acc < 0) this.acc = 0;
    return this.acc / this.step;
  }

  reset(): void {
    this.acc = 0;
  }
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
