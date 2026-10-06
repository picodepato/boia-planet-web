import {
  type DefenseConfig,
  type DefenseEndReason,
  type DefenseEvent,
  type DefenseSnapshot,
  type DefenseTowerKind,
  defenseSchedule,
} from '@boia/engine/defense';
import {
  type CanonAudio,
  type SoundPrefsSource,
  type SynthVoice,
  createPageCanonAudio,
} from './canon-audio';
import { waveAt } from './castillo-hud-model';

/** Sonidos sintetizados de muestra (T164); el bucle y los ajustes son los de T152. */
export type CastleSfx =
  | DefenseTowerKind
  | 'build'
  | 'upgrade'
  | 'castle'
  | 'sell'
  | 'hit'
  | 'wave'
  | 'win'
  | 'loss'
  | 'plane';

/** Por tipo, no por torre: una flota de islas no multiplica las voces. */
export const CASTLE_SFX_GAP: Readonly<Record<CastleSfx, number>> = {
  faro: 0.65,
  ultima: 0.22,
  halloween: 0.45,
  cala: 0.3,
  tienda: 0.35,
  allday: 0.55,
  fotos: 0.3,
  build: 0.12,
  upgrade: 0.15,
  castle: 0.3,
  sell: 0.15,
  hit: 0.2,
  wave: 1,
  win: 1,
  loss: 1,
  plane: 0.15,
};

function synth(id: CastleSfx, v: SynthVoice): void {
  switch (id) {
    case 'faro': // Zumbido corto, renovado mientras el haz toca enemigos.
      v.tone(196, 220, 0, 0.42, 0.025, 'triangle');
      break;
    case 'ultima':
      v.tone(170, 65, 0, 0.09, 0.05, 'triangle');
      v.noise(700, 250, 0.07, 0.025, 'lowpass');
      break;
    case 'halloween':
      v.noise(450, 2100, 0.22, 0.04, 'bandpass');
      break;
    case 'cala':
      v.noise(2800, 500, 0.1, 0.045);
      v.tone(740, 240, 0, 0.07, 0.025, 'triangle');
      break;
    case 'tienda':
      v.tone(1318.5, 1318.5, 0, 0.14, 0.035);
      v.tone(1760, 1760, 0.06, 0.17, 0.025);
      break;
    case 'allday':
      v.tone(105, 42, 0, 0.18, 0.06);
      v.tone(210, 84, 0, 0.1, 0.02, 'triangle');
      break;
    case 'fotos':
      v.noise(5500, 1800, 0.035, 0.05, 'highpass');
      v.tone(980, 190, 0, 0.035, 0.025, 'triangle');
      break;
    case 'build':
      v.tone(180, 90, 0, 0.13, 0.08, 'triangle');
      v.tone(523.3, 784, 0.09, 0.16, 0.05);
      break;
    case 'upgrade':
      [659.3, 830.6, 1046.5].forEach((f, i) => v.tone(f, f, i * 0.06, 0.17, 0.055, 'triangle'));
      break;
    case 'castle': // Mejorar el castillo (plan 016, decisión 9): un golpe de piedra y una fanfarria corta.
      v.tone(98, 78, 0, 0.24, 0.09, 'triangle');
      v.noise(520, 140, 0.14, 0.05, 'lowpass');
      [523.3, 659.3, 784, 1046.5].forEach((f, i) => v.tone(f, f, 0.08 + i * 0.07, 0.2, 0.05));
      break;
    case 'sell':
      [1046.5, 784, 659.3].forEach((f, i) => v.tone(f, f, i * 0.055, 0.12, 0.045));
      break;
    case 'hit':
      v.tone(115, 40, 0, 0.23, 0.12, 'triangle');
      v.noise(700, 120, 0.2, 0.07, 'lowpass');
      break;
    case 'wave':
      v.tone(392, 392, 0, 0.16, 0.065, 'triangle');
      v.tone(523.3, 523.3, 0.18, 0.24, 0.065, 'triangle');
      break;
    case 'win':
      [523.3, 659.3, 784, 1046.5].forEach((f, i) => v.tone(f, f, i * 0.12, 0.32, 0.08, 'triangle'));
      break;
    case 'loss':
      v.tone(330, 65, 0, 0.9, 0.12, 'triangle');
      v.noise(650, 100, 0.65, 0.06, 'lowpass');
      break;
    case 'plane':
      v.tone(480, 260, 0, 0.045, 0.018, 'triangle');
      break;
  }
}

export class CastleAudio {
  private schedule: ReturnType<typeof defenseSchedule> = [];
  private wave = 0;
  private ended = true;

  constructor(readonly loop: CanonAudio) {}

  play(id: CastleSfx): void {
    this.loop.playEffect(`castle:${id}`, CASTLE_SFX_GAP[id], (v) => synth(id, v));
  }

  start(s: DefenseSnapshot, config: DefenseConfig): void {
    this.schedule = defenseSchedule(config, s.runMin, s.difficulty);
    // Atajos y carga tardía no reproducen los avisos de oleadas anteriores.
    this.wave = waveAt(this.schedule, s.activeS).wave;
    this.ended = false;
    this.loop.setMusic('battle');
    this.sync(s);
    if (s.activeS === 0 && this.wave > 0 && s.status === 'running') this.play('wave');
  }

  sync(s: DefenseSnapshot): void {
    if (s.end) {
      this.end(s.end);
      return;
    }
    if (this.ended) return;
    this.loop.setBoss(s.enemies.some((e) => e.boss));
    if (s.status !== 'running') return;
    const wave = waveAt(this.schedule, s.activeS).wave;
    if (wave > this.wave) {
      this.wave = wave;
      this.play('wave');
    }
    // Faro actualiza el mismo lastShot y no emite towerShot en cada paso.
    if (
      s.towers.some(
        (t) =>
          t.kind === 'faro' && t.lastShot?.targetIds.length && s.activeS - t.lastShot.atS < 0.1,
      )
    )
      this.play('faro');
  }

  events(events: readonly DefenseEvent[]): void {
    if (this.ended) return;
    for (const e of events) {
      switch (e.type) {
        case 'towerBuilt':
          this.play('build');
          break;
        case 'towerUpgrade':
        case 'planeUpgrade':
          this.play('upgrade');
          break;
        case 'castleUpgrade':
          this.play('castle');
          break;
        case 'towerSold':
          this.play('sell');
          break;
        case 'castleHit':
          this.play('hit');
          break;
        case 'planeShot':
          this.play('plane');
          break;
        case 'towerShot':
          // Puerto: pop al estallar, no al lanzar. Ibiza sólo por towerShot.
          if (e.kind !== 'faro' && !(e.kind === 'cala' && e.shot.flightS !== undefined))
            this.play(e.kind);
          break;
        case 'end':
          this.end(e.reason);
          break;
      }
    }
  }

  end(reason: DefenseEndReason): void {
    if (this.ended) return;
    this.ended = true;
    if (reason === 'held') this.play('win');
    else if (reason === 'fallen') this.play('loss');
    this.loop.setMusic('sea');
  }

  dispose(): void {
    this.loop.dispose();
  }
}

/** El factory de T152 conserva la regla de gesto real y el ciclo de visibilidad. */
export function createPageCastleAudio(
  prefs: SoundPrefsSource,
  sea: (on: boolean) => void,
): CastleAudio {
  return new CastleAudio(createPageCanonAudio(prefs, sea));
}
