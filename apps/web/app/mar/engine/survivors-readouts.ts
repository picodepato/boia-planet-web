import type { EnemyId, SurvivorsSnapshot } from '@boia/engine/survivors';
import type { QualityTier } from '@boia/engine/streaming';
import {
  type Camera,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector3,
  type WebGLRenderer,
} from 'three';
import { readoutPreferences } from '../canon-readout-preferences';
import { toScene } from './compress';
import { planetUniforms } from './planet';
import { enemyModel } from './survivors-props';
import { type DamageNumber, damageRise } from './survivors-readout-model';
import { behindPlanet, wrapD } from './wrap';

type ReadoutSnapshot = SurvivorsSnapshot & { readonly damageNumbers?: readonly DamageNumber[] };

/** A single canvas for all enemy bars/numbers. No DOM or GPU resources while disabled. */
export class SurvivorsReadouts {
  readonly group = new Group();
  private trigger: Mesh | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private snapshot: ReadoutSnapshot | null = null;
  private reduced = false;
  private lastDrawMs = -Infinity;
  private seenHealth = 0;
  private seenDamage = 0;
  private readonly point = new Vector3();

  constructor(
    private readonly quality: QualityTier,
    private readonly heightOf: (type: EnemyId, id: number) => number,
  ) {}

  update(snapshot: ReadoutSnapshot, reduced: boolean): void {
    this.snapshot = snapshot;
    this.reduced = reduced;
    const prefs = readoutPreferences().get();
    const on = prefs.health || prefs.damage;
    if (on && !this.trigger) {
      // This callback gives the overlay the actual render camera, including zoom/wrap.
      const material = new MeshBasicMaterial({
        depthWrite: false,
        depthTest: false,
        colorWrite: false,
      });
      material.userData.planet = 'skip';
      this.trigger = new Mesh(new PlaneGeometry(0, 0), material);
      this.trigger.name = 'survivors-readouts';
      this.trigger.frustumCulled = false;
      this.trigger.onBeforeRender = (renderer, _scene, camera) => this.draw(renderer, camera);
      this.group.add(this.trigger);
    }
    if (this.trigger) this.trigger.visible = on;
    if (this.canvas) this.canvas.hidden = !on;
  }

  private project(
    x: number,
    y: number,
    height: number,
    camera: Camera,
    w: number,
    h: number,
  ): boolean {
    const u = planetUniforms;
    const focus = u.uPlanetFocus.value;
    const period = u.uPlanetPeriod.value;
    const sx = focus.x + wrapD(toScene(x) - focus.x, period.x);
    const sz = focus.y + wrapD(toScene(y) - focus.y, period.y);
    const center = u.uBendCenter.value;
    const r = Math.hypot(sx - center.x, sz - center.y);
    const curvedY = height - u.uBend.value * r * r;
    if (behindPlanet(camera.position.y, r, curvedY, u.uBend.value)) return false;
    this.point.set(sx, curvedY, sz).project(camera);
    const depth = this.point.z;
    this.point.x = (this.point.x * 0.5 + 0.5) * w;
    this.point.y = (-this.point.y * 0.5 + 0.5) * h;
    return (
      depth >= -1 &&
      depth < 1 &&
      this.point.x >= 0 &&
      this.point.x <= w &&
      this.point.y >= 0 &&
      this.point.y <= h
    );
  }

  private draw(renderer: WebGLRenderer, camera: Camera): void {
    const s = this.snapshot;
    const source = renderer.domElement;
    const parent = source.parentElement;
    if (!s || !parent) return;
    const nowMs = performance.now();
    if (nowMs - this.lastDrawMs < 1000 / 30) return;
    this.lastDrawMs = nowMs;
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.dataset.testid = 'mar-canon-readouts';
      this.canvas.setAttribute('aria-hidden', 'true');
      Object.assign(this.canvas.style, {
        position: 'absolute',
        pointerEvents: 'none',
        zIndex: '2',
      });
      parent.append(this.canvas);
      this.ctx = this.canvas.getContext('2d');
    }
    const canvas = this.canvas;
    const ctx = this.ctx;
    if (!ctx) return;
    const w = source.clientWidth;
    const h = source.clientHeight;
    const ratio = this.quality === 'baja' ? 1 : Math.min(1.5, window.devicePixelRatio || 1);
    const width = Math.round(w * ratio);
    const height = Math.round(h * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    Object.assign(canvas.style, {
      left: `${source.offsetLeft}px`,
      top: `${source.offsetTop}px`,
      width: `${w}px`,
      height: `${h}px`,
    });
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const prefs = readoutPreferences().get();
    let bars = 0;
    let numbers = 0;
    if (prefs.health)
      for (const e of s.enemies) {
        if (!(e.hp > 0 && e.hp < e.maxHp)) continue;
        const top = this.heightOf(e.type, e.id) + toScene(e.radius) * 1.6 + 0.3;
        if (!this.project(e.x, e.y, top, camera, w, h)) continue;
        const x = Math.round(this.point.x) - 15;
        const y = Math.round(this.point.y) - 5;
        ctx.fillStyle = '#182c35';
        ctx.fillRect(x - 1, y - 1, 32, 5);
        ctx.fillStyle = '#91efb1';
        ctx.fillRect(x, y, Math.max(1, Math.round((30 * e.hp) / e.maxHp)), 3);
        bars++;
      }
    if (prefs.damage) {
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#182c35';
      ctx.fillStyle = '#fff3cb';
      for (const d of s.damageNumbers ?? []) {
        const enemy = d.kind === 'enemy' ? s.enemies.find((e) => e.id === d.id) : null;
        const boss = d.kind === 'boss' ? s.bosses.find((b) => b.id === d.id) : null;
        const top = enemy
          ? this.heightOf(enemy.type, enemy.id) + toScene(enemy.radius) * 1.6 + 0.3
          : d.enemy
            ? (enemyModel(d.enemy).fly ?? 0) + 1
            : 3;
        if (
          !this.project(enemy?.x ?? boss?.x ?? d.x, enemy?.y ?? boss?.y ?? d.y, top, camera, w, h)
        )
          continue;
        const y = this.point.y - 10 - damageRise(s.activeS - d.bornS, this.reduced);
        // Fractional continuous damage remains readable, rather than many zeroes.
        const text = String(Math.max(1, Math.round(d.damage)));
        ctx.strokeText(text, this.point.x, y);
        ctx.fillText(text, this.point.x, y);
        numbers++;
      }
    }
    this.seenHealth = Math.max(this.seenHealth, bars);
    this.seenDamage = Math.max(this.seenDamage, numbers);
    Object.assign(canvas.dataset, {
      canonHealthOverlay: prefs.health ? 'on' : 'off',
      canonDamageOverlay: prefs.damage ? 'on' : 'off',
      healthCount: String(bars),
      damageCount: String(numbers),
      healthSeen: String(this.seenHealth),
      damageSeen: String(this.seenDamage),
      reducedMotion: String(this.reduced),
    });
  }

  dispose(): void {
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
    if (this.trigger) {
      this.trigger.geometry.dispose();
      (this.trigger.material as MeshBasicMaterial).dispose();
      this.trigger.removeFromParent();
      this.trigger = null;
    }
    this.group.removeFromParent();
  }
}
