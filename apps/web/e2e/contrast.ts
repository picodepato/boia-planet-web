import type { Page } from '@playwright/test';

/**
 * Contrast of the text on screen against what is really behind it (plan 007
 * T81). axe cannot measure text over the three.js canvas, the still or the
 * bands' gradients (it reports them as "incomplete"), so this measures the
 * pixels: it takes the viewport once with every glyph made transparent, and
 * for each visible run of text compares its colour (with its alpha and the
 * opacity of its ancestors) against each background pixel under the run's
 * glyphs (one em high on its line). Text shadows stay in the frame: a halo
 * behind the letters is part of their background. A run passes when 95 % of those pixels give at least 4.5:1 (3:1 for
 * large text, WCAG 1.4.3); the 5 % tail leaves out the odd star, glint or
 * grain pixel under a box that is mostly empty space between glyphs.
 */

export type ContrastRun = {
  /** A short CSS-ish path of the text's element, for the report. */
  where: string;
  text: string;
  large: boolean;
  /** Ratio met by 95 % of the pixels behind the run. */
  p05: number;
  min: number;
};

type Run = {
  where: string;
  text: string;
  large: boolean;
  rgb: [number, number, number];
  alpha: number;
  box: { x: number; y: number; w: number; h: number };
};

/** Every visible run of text in the viewport, with its effective colour. */
function collectRuns(): Run[] {
  const out: Run[] = [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const path = (el: Element) => {
    const parts: string[] = [];
    for (let e: Element | null = el; e && parts.length < 3; e = e.parentElement) {
      const cls = [...e.classList]
        .slice(0, 1)
        .map((c) => `.${c}`)
        .join('');
      parts.unshift(`${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ''}${cls}`);
    }
    return parts.join(' > ');
  };
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const text = node.data.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const el = node.parentElement;
    if (!el || el.closest('script, style, noscript, title')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility !== 'visible') continue;
    let opacity = 1;
    for (let e: Element | null = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.display === 'none') opacity = 0;
      opacity *= Number(s.opacity);
    }
    if (opacity < 0.05) continue;
    const m = cs.color.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 1];
    const alpha = (m[3] ?? 1) * opacity;
    if (alpha < 0.05) continue;
    // Visually hidden text (a 1 px clip) and text off screen do not count.
    const own = el.getBoundingClientRect();
    if (own.width <= 2 || own.height <= 2) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    // The glyphs, not the line box: one em high, centred on the line.
    const size = parseFloat(cs.fontSize);
    const inset = Math.max(0, (r.height - size) / 2);
    let x0 = Math.max(0, r.left);
    let y0 = Math.max(0, r.top + inset);
    let x1 = Math.min(vw, r.right);
    let y1 = Math.min(vh, r.bottom - inset);
    // What a scrolling or clipping box (the Tickets sheet) cuts off is not seen.
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
      const c = e.getBoundingClientRect();
      x0 = Math.max(x0, c.left);
      y0 = Math.max(y0, c.top);
      x1 = Math.min(x1, c.right);
      y1 = Math.min(y1, c.bottom);
    }
    if (x1 - x0 < 4 || y1 - y0 < 4) continue;
    // Covered, even in part, by something else (the Tickets panel, the
    // header): what shows is the cover, not this text.
    const mine = (x: number, y: number) => {
      const hit = document.elementFromPoint(x, y);
      return !!hit && (hit === el || el.contains(hit) || hit.contains(el));
    };
    const cx = (x0 + x1) / 2;
    if (!mine(cx, y0 + 1) || !mine(cx, (y0 + y1) / 2) || !mine(cx, y1 - 1)) continue;
    const weight = Number(cs.fontWeight) || 400;
    out.push({
      where: path(el),
      text: text.slice(0, 40),
      large: size >= 24 || (size >= 18.66 && weight >= 700),
      rgb: [m[0]!, m[1]!, m[2]!],
      alpha: Math.min(1, alpha),
      box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
    });
  }
  return out;
}

/** Measures the contrast of every visible run of text in the viewport. */
export async function measureContrast(page: Page): Promise<ContrastRun[]> {
  const runs = await page.evaluate(collectRuns);
  if (runs.length === 0) return [];
  // The same frame with the glyphs gone: what is behind the text.
  const hide = await page.addStyleTag({
    content: `*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; transition: none !important; caret-color: transparent !important; }
      .intro-title3d { visibility: hidden !important; }`,
  });
  // No focus ring in the frame; the focus goes back afterwards.
  const focused = await page.evaluateHandle(() => {
    const a = document.activeElement as HTMLElement | null;
    a?.blur();
    return a;
  });
  await page.waitForTimeout(100);
  const shot = await page.screenshot({ scale: 'css', animations: 'disabled' });
  await hide.evaluate((el) => (el as Element).remove());
  await focused.evaluate((a) => (a as HTMLElement | null)?.focus({ preventScroll: true }));
  await focused.dispose();

  return page.evaluate(
    async ({ b64, runs }) => {
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
      const bmp = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bmp, 0, 0);
      const sx = bmp.width / window.innerWidth;
      const sy = bmp.height / window.innerHeight;
      const lin = (c: number) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      const lum = (r: number, g: number, b: number) =>
        0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      return runs.map((run) => {
        const { x, y, w, h } = run.box;
        const px = ctx.getImageData(
          Math.floor(x * sx),
          Math.floor(y * sy),
          Math.max(1, Math.floor(w * sx)),
          Math.max(1, Math.floor(h * sy)),
        ).data;
        const ratios: number[] = [];
        for (let i = 0; i < px.length; i += 4) {
          const br = px[i]!;
          const bg = px[i + 1]!;
          const bb = px[i + 2]!;
          const a = run.alpha;
          const fr = run.rgb[0] * a + br * (1 - a);
          const fg = run.rgb[1] * a + bg * (1 - a);
          const fb = run.rgb[2] * a + bb * (1 - a);
          const l1 = lum(fr, fg, fb);
          const l2 = lum(br, bg, bb);
          ratios.push((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05));
        }
        ratios.sort((p, q) => p - q);
        const p05 = ratios[Math.floor(ratios.length * 0.05)] ?? 21;
        return {
          where: run.where,
          text: run.text,
          large: run.large,
          p05: Math.round(p05 * 100) / 100,
          min: Math.round((ratios[0] ?? 21) * 100) / 100,
        };
      });
    },
    { b64: shot.toString('base64'), runs },
  );
}

/** The runs below their WCAG AA minimum, as readable lines (empty: all pass). */
export function lowContrast(runs: readonly ContrastRun[]): string[] {
  return runs
    .filter((r) => r.p05 < (r.large ? 3 : 4.5))
    .map((r) => `${r.p05}:1 (${r.large ? 'grande' : 'normal'}) «${r.text}» ${r.where}`);
}
