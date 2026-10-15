import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) =>
  readFileSync(new URL(p, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const rule = (css: string, selector: string) =>
  css.match(new RegExp(`\\n${selector.replace(/[.]/g, '\\.')} \\{([^}]*)\\}`))?.[1] ?? '';

describe('/mar: lost 3D and top notices on a phone (plan 032 T299)', () => {
  const mar3d = read('./engine/mar3d.ts');
  const client = read('./mar-client.tsx');
  const css = read('./mar.css');

  it('the engine watches its canvas, stops while the context is lost and cleans up', () => {
    expect(mar3d).toContain('new GlWatch(opts.canvas');
    expect(mar3d).toMatch(/if \(this\.paused \|\| !this\.glWatch\.paints\) return;/);
    expect(mar3d).toContain('this.glWatch.dispose()');
    expect(mar3d).toContain('onGl?(t: GlTrack): void;');
  });

  it('the web shows a calm notice when it is lost and offers to reload when it does not come back', () => {
    expect(client).toContain('onGl: (t) => setGl(t.state)');
    expect(client).toContain("msg(gl === 'lost' ? 'mar.gl.perdido' : 'mar.gl.noVuelve')");
    expect(client).toContain('window.location.reload()');
  });

  it('the notices wrap and stay inside the safe areas at 360 px (not cut with an ellipsis)', () => {
    const text = rule(css, '.mar-notice__text strong,\n.mar-notice__text small');
    expect(text).toContain('overflow-wrap: anywhere');
    expect(text).not.toContain('white-space: nowrap');
    expect(text).not.toContain('text-overflow: ellipsis');
    const box = rule(css, '.mar-notices');
    expect(box).toContain('left: calc(var(--safe-l)');
    expect(box).toContain('right: calc(var(--safe-r)');
    const lost = rule(css, '.mar-glnotice');
    expect(lost).toContain('max-width: calc(100% - var(--safe-l) - var(--safe-r) - 24px)');
    expect(lost).toContain('top: calc(var(--safe-t)');
  });
});
