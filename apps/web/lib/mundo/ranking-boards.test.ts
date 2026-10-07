import { DEFENSE_RUN_MINS } from '@boia/engine/defense';
import { SAMPLE_COSMETICS } from '@boia/store';
import { describe, expect, it } from 'vitest';
import { es } from '../i18n/es';
import { worlds } from './demo-world';
import { bossLabel, canonBoardOptions, castleBoardOptions } from './ranking-boards';
import { CANON_RANKING_VERSION, canonBoardBosses, canonBoardKey } from './ranking-canon';
import { CASTLE_DIFFICULTIES, CASTLE_RANKING_VERSION } from './ranking-castle';
import { boardKey } from './ranking-global';

/**
 * Las tablas del ranking del menú (plan 017 T188, decisión 2): el Cañón, una
 * por boss final; el Castillo, una por duración y dificultad. Se comprueban
 * contra la configuración de cada juego, no contra cuentas escritas a mano.
 */
describe('tablas del Cañón y del Castillo en el ranking del menú', () => {
  it('el Cañón: una tabla por boss final, en orden, con su nombre corto', () => {
    const opts = canonBoardOptions();
    const bosses = canonBoardBosses();
    expect(opts.map((o) => o.board)).toEqual(
      bosses.map((boss) => ({ kind: 'canon', boss, version: CANON_RANKING_VERSION })),
    );
    // Hoy, Fantasma y Kraken (decisión 2).
    expect(opts.map((o) => o.label)).toEqual(
      bosses.map((b) => es[`ranking.canon.board.${b}` as keyof typeof es]),
    );
    for (const o of opts) {
      expect(o.key).toBe(boardKey(o.board));
      if (o.board.kind === 'canon') expect(o.key).toBe(`canon:${canonBoardKey(o.board.boss)}`);
    }
  });

  it('un boss sin nombre corto lleva el del juego', () => {
    expect(bossLabel('kraken')).toBe(es['ranking.canon.board.kraken']);
    expect(canonBoardOptions(['fantasma'])[0]!.label).toBe(es['ranking.canon.board.fantasma']);
  });

  it('el Castillo: cada dificultad con cada duración, sin repetir ninguna', () => {
    const opts = castleBoardOptions();
    expect(opts).toHaveLength(DEFENSE_RUN_MINS.length * CASTLE_DIFFICULTIES.length);
    expect(new Set(opts.map((o) => o.key)).size).toBe(opts.length);
    const expected = CASTLE_DIFFICULTIES.flatMap((difficulty) =>
      DEFENSE_RUN_MINS.map((runMin) => ({
        kind: 'castle',
        runMin,
        difficulty,
        version: CASTLE_RANKING_VERSION,
      })),
    );
    expect(opts.map((o) => o.board)).toEqual(expected);
    for (const o of opts) {
      if (o.board.kind !== 'castle') throw new Error('tabla del Castillo');
      expect(o.label).toContain(`${o.board.runMin} min`);
      expect(o.label).toContain(es[`survivors.dificultad.${o.board.difficulty}`]);
    }
  });
});

/**
 * Sin «Arcilla» a la vista (plan 017, decisión 3): es el mundo principal y no
 * se nombra. Sus ids internos (`arcilla`, `world.arcilla.*`) se quedan.
 */
describe('ningún texto visible dice «Arcilla»', () => {
  it('ni el catálogo i18n, ni el nombre del mundo, ni los barcos y skins de muestra', () => {
    const texts = [
      ...Object.values(es),
      ...worlds.list().map((w) => w.name),
      ...SAMPLE_COSMETICS.map((c) => c.name),
    ];
    expect(texts.filter((s) => /arcilla/i.test(s))).toEqual([]);
  });
});
