import { clamp, wrapAngle } from './math';

export interface WakeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
}

export interface WakeConfig {
  /** Partículas por segundo a velocidad máxima sin drift. muestra */
  rate: number;
  /** Multiplicador de intensidad durante el drift. muestra */
  driftBoost: number;
  /** Bajo esta velocidad (u/s) no se emite. muestra */
  minSpeed: number;
  maxParticles: number;
  /** rad/s de giro del casco a partir del cual la estela da todo su extra. muestra */
  turnRef: number;
  /** Intensidad que se suma girando a `turnRef` o más. muestra */
  turnBoost: number;
  /** Intensidad que se suma por cada `maxSpeed` de más (boost). muestra */
  speedBoost: number;
  /**
   * u/s² que el barco puede perder sin chocar (frenada y giro normales); lo
   * que pierde de más en un paso es golpe. muestra
   */
  normalDecel: number;
  /** u/s de golpe por debajo de los cuales no salpica. muestra */
  impactMin: number;
  /** Partículas de la salpicadura con un golpe de `maxSpeed`. muestra */
  splashParticles: number;
  /** s que dura el extra de estela después de un golpe. muestra */
  splashTime: number;
}

export const DEFAULT_WAKE: WakeConfig = {
  rate: 70,
  driftBoost: 1.7,
  minSpeed: 8,
  maxParticles: 500,
  turnRef: 2.4,
  turnBoost: 0.6,
  speedBoost: 1.2,
  normalDecel: 600,
  impactMin: 24,
  splashParticles: 36,
  splashTime: 0.4,
};

export interface WakeEmitter {
  /** Anclaje `wake_origin` en coordenadas de mundo. */
  x: number;
  y: number;
  heading: number;
  speed: number;
  /** Velocidad máxima sin efectos: por encima, el barco va con boost. */
  maxSpeed: number;
  drifting: boolean;
}

/** Lo que la estela lee del barco en el último paso (para la vista y las pruebas). */
export interface WakeReading {
  /** Multiplicador de emisión: 0 parado, 1 a toda máquina en recto. */
  intensity: number;
  /** rad/s de giro del casco. */
  turnRate: number;
  /** 0..1: cuánto boost lleva (velocidad por encima de la máxima). */
  boost: number;
  /** u/s del último golpe detectado (0 si no hubo). */
  impact: number;
}

/**
 * Estela de partículas en coordenadas de mundo (REQ-MUN-004): la intensidad
 * crece con la velocidad, el drift, el giro y el boost; un choque salpica;
 * cada partícula se desvanece al envejecer. Todo sale de lo que hace el
 * barco paso a paso (rumbo, velocidad y posición), así corresponde a su
 * desplazamiento real sin que nadie le avise.
 */
export class WakeSystem {
  readonly particles: WakeParticle[] = [];
  private pending = 0;
  private seed = 1;
  private prev: { x: number; y: number; heading: number; speed: number } | null = null;
  private splash = 0;
  private last: WakeReading = { intensity: 0, turnRate: 0, boost: 0, impact: 0 };

  constructor(readonly cfg: WakeConfig = DEFAULT_WAKE) {}

  private rand(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  /** Lo leído en el último `update`. */
  reading(): WakeReading {
    return { ...this.last };
  }

  /**
   * Intensidad por velocidad, drift y boost, sin giro ni golpe (que dependen
   * de los pasos anteriores).
   */
  intensity(e: WakeEmitter): number {
    if (e.speed < this.cfg.minSpeed) return 0;
    const over = clamp((e.speed - e.maxSpeed) / e.maxSpeed, 0, 1);
    return (
      clamp(e.speed / e.maxSpeed, 0, 1) *
      (e.drifting ? this.cfg.driftBoost : 1) *
      (1 + this.cfg.speedBoost * over)
    );
  }

  /** Golpe (u/s) entre el paso anterior y éste; 0 si fue un salto (teletransporte). */
  private detectImpact(e: WakeEmitter, dt: number): number {
    const p = this.prev;
    if (!p || dt <= 0) return 0;
    const moved = Math.hypot(e.x - p.x, e.y - p.y);
    // Mucho más lejos de lo que da la velocidad: el barco se movió de sitio.
    if (moved > (p.speed + e.speed) * dt * 2 + 24) return 0;
    // Sólo cuenta lo perdido por debajo de la máxima: acabar un boost no es golpe.
    const lost = Math.min(p.speed, e.maxSpeed) - e.speed - this.cfg.normalDecel * dt;
    return lost >= this.cfg.impactMin ? lost : 0;
  }

  update(dt: number, e: WakeEmitter): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.age += dt;
      if (p.age >= p.life) {
        this.particles[i] = this.particles[this.particles.length - 1]!;
        this.particles.pop();
        continue;
      }
      const k = Math.exp(-2.2 * dt);
      p.vx *= k;
      p.vy *= k;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    const turnRate =
      this.prev && dt > 0 ? Math.abs(wrapAngle(e.heading - this.prev.heading)) / dt : 0;
    const impact = this.detectImpact(e, dt);
    this.prev = { x: e.x, y: e.y, heading: e.heading, speed: e.speed };
    const boost = clamp((e.speed - e.maxSpeed) / e.maxSpeed, 0, 1);

    const fx = Math.cos(e.heading);
    const fy = Math.sin(e.heading);
    if (impact > 0) {
      this.splash = this.cfg.splashTime;
      this.burst(e, impact);
    } else {
      this.splash = Math.max(0, this.splash - dt);
    }

    const base = this.intensity(e);
    const turning = clamp(turnRate / this.cfg.turnRef, 0, 1);
    const splashing = this.splash > 0 ? 0.6 * (this.splash / this.cfg.splashTime) : 0;
    const intensity =
      base === 0 ? splashing : base * (1 + this.cfg.turnBoost * turning) + splashing;
    this.last = { intensity, turnRate, boost, impact };

    if (intensity === 0) {
      this.pending = 0;
      return;
    }
    this.pending += this.cfg.rate * intensity * dt;
    // Girando, la espuma se abre hacia fuera de la curva; con boost, sale más larga.
    const spread = 14 + (e.drifting ? 30 : 0) + turning * 22;
    while (this.pending >= 1 && this.particles.length < this.cfg.maxParticles) {
      this.pending -= 1;
      const side = (this.rand() - 0.5) * 2;
      this.particles.push({
        x: e.x - fy * side * 5,
        y: e.y + fx * side * 5,
        vx: -fx * e.speed * 0.12 - fy * side * spread,
        vy: -fy * e.speed * 0.12 + fx * side * spread,
        age: 0,
        life: 0.8 + Math.min(intensity, 1.5) * 0.9 + boost * 0.6,
        size: 2.5 + Math.min(intensity, 1.5) * 3.5,
      });
    }
    if (this.pending > 1) this.pending = 0;
  }

  /** Salpicadura de un golpe: un anillo de espuma que sale hacia todos lados. */
  private burst(e: WakeEmitter, impact: number): void {
    const strength = clamp(impact / e.maxSpeed, 0, 1);
    const n = Math.max(4, Math.round(this.cfg.splashParticles * strength));
    for (let i = 0; i < n && this.particles.length < this.cfg.maxParticles; i++) {
      const a = (i / n) * Math.PI * 2 + this.rand() * 0.4;
      const v = 30 + impact * 0.35 * (0.6 + this.rand() * 0.4);
      this.particles.push({
        x: e.x,
        y: e.y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        age: 0,
        life: 0.5 + strength * 0.7,
        size: 3 + strength * 4,
      });
    }
  }
}
