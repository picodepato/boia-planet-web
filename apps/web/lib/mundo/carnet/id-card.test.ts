import { SAMPLE_CREW } from '@boia/store';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { gameRepository } from '../repo';
import { decodeFrame } from '../../scanner/decode';
import { CarnetCard, cardViewOf } from './carnet-card';
import { parseWindow } from './claim';
import { clock, outcomeCopy } from './claim-copy';
import { IdCard } from './id-card';
import {
  BACK_CELLS,
  STAMP_INKS,
  STAMP_SHAPES,
  type StampArt,
  backLayout,
  memberNumberLabel,
  mrzLines,
  nicknameTier,
  sinceShort,
  stampStyle,
} from './id-card-model';
import { qrPath } from './qr-code';
import { RubberStamp } from './stamp';
import { stampArtFor } from './use-carnet';

const art = (eventId: string, extra: Partial<StampArt> = {}): StampArt => ({
  eventId,
  name: `Fiesta ${eventId}`,
  date: '2026-10-31T22:00:00Z',
  image: null,
  sample: false,
  ...extra,
});

describe('la tarjeta ID-1: campos (plan 008, T91, decisión 10)', () => {
  it('nº de miembro con 4 cifras; sin servidor, «—»', () => {
    expect(memberNumberLabel(42)).toBe('0042');
    expect(memberNumberLabel(12345)).toBe('12345');
    expect(memberNumberLabel(null)).toBe('—');
    expect(memberNumberLabel(0)).toBe('—');
  });

  it('«Miembro desde» corto, en Madrid', () => {
    expect(sinceShort('2026-06-12T10:00:00Z')).toBe('jun 2026');
    // Medianoche del 1 de julio en Madrid sigue siendo 30 de junio en UTC.
    expect(sinceShort('2026-06-30T22:30:00Z')).toBe('jul 2026');
    expect(sinceShort('no')).toBe('');
  });

  it('el apodo baja de tamaño con su largo', () => {
    expect(nicknameTier('Grumete')).toBe(1);
    expect(nicknameTier('Grumete Turrón Fino')).toBe(2);
    expect(nicknameTier('Capitana Sargantana Benacantí')).toBe(3);
  });

  it('la línea de lectura mecánica: número, apodo sin tildes, AAMM, rango y puntos', () => {
    const [a, b] = mrzLines({
      number: 42,
      nickname: 'Grumete Turrón',
      since: '2026-06-12T10:00:00Z',
      rank: 'Marinera',
      points: 240,
    });
    expect(a).toBe('IDBOI0042<<GRUMETE<TURRON<<<<<<<<<');
    expect(b).toBe('2606<MARINERA<<<<00240<<<<<<<<<<<<');
    expect(a).toHaveLength(b.length);
  });

  it('el reverso: hasta 6 sellos; con 7 o más, 5 y «+N»', () => {
    const many = Array.from({ length: 13 }, (_, i) => i);
    expect(backLayout(many)).toEqual({ shown: [0, 1, 2, 3, 4], more: 8, empty: 0 });
    expect(backLayout([1, 2, 3])).toEqual({ shown: [1, 2, 3], more: 0, empty: BACK_CELLS - 3 });
    expect(backLayout([])).toMatchObject({ empty: BACK_CELLS });
  });
});

describe('el sello de goma', () => {
  it('forma, tinta y giro salen del id del evento: siempre los mismos', () => {
    const ids = ['all-day-boia-junio', 'fogueres', 'tardes-en-la-cala', 'boia-halloween-2026'];
    for (const id of ids) {
      const s = stampStyle(id);
      expect(stampStyle(id)).toEqual(s);
      expect(STAMP_SHAPES).toContain(s.shape);
      expect(Object.keys(STAMP_INKS)).toContain(s.ink);
      expect(s.rotation).toBeGreaterThanOrEqual(-9);
      expect(s.rotation).toBeLessThanOrEqual(9);
    }
    // Con muchos eventos salen las tres formas y las cuatro tintas.
    const styles = Array.from({ length: 60 }, (_, i) => stampStyle(`fiesta-${i}`));
    expect(new Set(styles.map((s) => s.shape)).size).toBe(STAMP_SHAPES.length);
    expect(new Set(styles.map((s) => s.ink)).size).toBe(Object.keys(STAMP_INKS).length);
  });

  it('sin imagen, el sello generado: nombre en mayúsculas, día·mes, ALICANTE', () => {
    const html = renderToStaticMarkup(createElement(RubberStamp, { art: art('fogueres') }));
    expect(html).toContain('FIESTA FOGUERES');
    expect(html).toContain('31·10');
    expect(html).toContain(t('carnet.stamps.place'));
    expect(html).not.toContain('<image');
    expect(html).toContain('feTurbulence');
  });

  it('con imagen del Admin, la imagen va dentro del tratamiento: recortada, en la tinta, con el marco', () => {
    const image = 'https://cdn.example.test/sellos/halloween.webp';
    const html = renderToStaticMarkup(
      createElement(RubberStamp, { art: art('boia-halloween-2026', { image }) }),
    );
    expect(html).toContain(`href="${image}"`);
    expect(html).toContain('clip-path="url(#');
    expect(html).toMatch(/<image[^>]*filter="url\(#[^)]*-tint\)"/);
    expect(html).toContain('preserveAspectRatio="xMidYMid slice"');
    // El marco y las letras de su forma siguen ahí.
    expect(html).toContain('FIESTA BOIA-HALLOWEEN-2026');
    expect(html).toContain(`rotate(${stampStyle('boia-halloween-2026').rotation} 100 100)`);
  });
});

/** Pinta el `d` de `qrPath` (rectángulos de una fila) en píxeles y lo lee. */
function rasterize(d: string, size: number, scale = 6, quiet = 4) {
  const side = (size + quiet * 2) * scale;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);
  for (const m of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    const [x, y, w] = [Number(m[1]), Number(m[2]), Number(m[3])];
    for (let py = (y + quiet) * scale; py < (y + quiet + 1) * scale; py++)
      for (let px = (x + quiet) * scale; px < (x + quiet + w) * scale; px++)
        data.set([0, 0, 0, 255], (py * side + px) * 4);
  }
  return { data, width: side, height: side };
}

describe('el QR del anverso', () => {
  it('lleva al Carnet público', async () => {
    const url = 'https://boia-planet-roan.vercel.app/carnet/0b8e6c36-3f1d-4f5c-9a51-2f3c4d5e6f70';
    const { d, size } = qrPath(url);
    expect(await decodeFrame(rasterize(d, size))).toBe(url);
  });

  it('la tarjeta lo pinta con el origen de la página', async () => {
    const crew = SAMPLE_CREW[0]!;
    const carnet = (await gameRepository().carnet.get(crew.userId))!;
    const card = cardViewOf(carnet, {}, 'https://x.test');
    expect(card.publicUrl).toBe(`https://x.test/carnet/${encodeURIComponent(crew.userId)}`);
    const html = renderToStaticMarkup(createElement(IdCard, { card }));
    expect(html).toContain(`data-qr="${card.publicUrl}"`);
    expect(html).toContain(t('carnet.card.qrAltOther', { nickname: crew.nickname }));
    // Un miembro de muestra lleva el sobreimpreso.
    expect(html).toContain(t('carnet.card.specimen'));
  });
});

describe('el Carnet con su tarjeta', () => {
  it('anverso y reverso: el apodo, el rango, los puntos y la lista de sellos', async () => {
    const crew = SAMPLE_CREW.find((c) => c.showcase.stampEventIds.length > 0)!;
    const repo = gameRepository();
    const carnet = (await repo.carnet.get(crew.userId))!;
    const stamps = await stampArtFor(repo, carnet);
    const html = renderToStaticMarkup(createElement(CarnetCard, { carnet, extras: { stamps } }));
    expect(html).toContain('data-testid="carnet-anverso"');
    expect(html).toContain('data-testid="carnet-reverso"');
    expect(html).toContain(crew.nickname);
    expect(html).toContain(carnet.rank!.name);
    expect(html).toContain(`data-puntos="${carnet.points}"`);
    for (const s of stamps.slice(0, BACK_CELLS - 1)) {
      expect(html).toContain(`data-testid="carnet-sello-${s.eventId}"`);
      expect(html).toContain(s.name);
    }
    // La cara oculta (el reverso al abrir) no se puede tocar.
    expect(html).toMatch(/class="idc-face idc-back" inert=""/);
    expect(html).not.toMatch(/class="idc-face idc-front" inert=""/);
  });

  it('el sello que acaba de caer abre por el reverso', () => {
    const card = cardViewOf(
      {
        userId: 'u',
        nickname: 'Grumete',
        avatarKey: null,
        avatarImage: null,
        memberSince: '2026-06-01T10:00:00Z',
        answers: [],
        points: 290,
        rank: null,
        achievements: [],
        badges: [],
        stamps: [],
        cosmeticIds: [],
        equipped: {},
        isMine: true,
        isSample: false,
        moderated: { photo: false, nickname: false, answers: 0 },
      },
      { stamps: [art('boia-halloween-2026')], memberNumber: 7 },
      null,
    );
    const html = renderToStaticMarkup(
      createElement(IdCard, {
        card,
        fresh: 'boia-halloween-2026',
        pointsChange: { from: 240, to: 290 },
      }),
    );
    expect(html).toContain('data-cara="back"');
    expect(html).toContain('idc-cell is-fresh');
    expect(html).toContain(t('stamp.pointsChip', { from: 240, to: 290 }));
    expect(html).toContain('0007');
  });
});

describe('el sello «ARTISTA» del anverso (plan 016 T186)', () => {
  const own = (nickname: string): Parameters<typeof cardViewOf>[0] => ({
    userId: `u-${nickname}`,
    nickname,
    avatarKey: null,
    avatarImage: null,
    memberSince: '2026-06-01T10:00:00Z',
    answers: [],
    points: 0,
    rank: null,
    achievements: [],
    badges: [],
    stamps: [],
    cosmeticIds: [],
    equipped: {},
    isMine: true,
    isSample: false,
    moderated: { photo: false, nickname: false, answers: 0 },
  });
  const front = (html: string) =>
    html.slice(
      html.indexOf('data-testid="carnet-anverso"'),
      html.indexOf('data-testid="carnet-reverso"'),
    );

  it('un Carnet de artista lleva el sello en el anverso; uno de socio, no', () => {
    const artist = renderToStaticMarkup(
      createElement(IdCard, { card: cardViewOf(own('Artista'), { isArtist: true }, null) }),
    );
    const member = renderToStaticMarkup(
      createElement(IdCard, { card: cardViewOf(own('Socia'), { memberNumber: 12 }, null) }),
    );
    expect(front(artist)).toContain('data-testid="carnet-sello-artista"');
    expect(front(artist)).toContain(t('carnet.card.artistStamp'));
    expect(front(artist)).toContain(t('carnet.card.docArtist'));
    // El sello va con la textura de tinta de los sellos de las fiestas.
    expect(front(artist)).toMatch(/carnet-sello-artista[\s\S]*feTurbulence/);
    expect(member).not.toContain('carnet-sello-artista');
    expect(member).toContain(t('carnet.card.docMember'));
  });

  it('modo local: el Carnet creado con el enlace de artistas es de artista (demo); sin él, no', async () => {
    const { createLocalRepository } = await import('@boia/store');
    const withLink = createLocalRepository({ storage: null });
    const plain = createLocalRepository({ storage: null });
    const a = await withLink.carnet.create({ nickname: 'Con Enlace', artistCode: 'muestra' });
    const b = await plain.carnet.create({ nickname: 'Sin Enlace', artistCode: '  ' });
    expect(a.isArtist).toBe(true);
    expect(b.isArtist).toBeUndefined();
    expect(cardViewOf(a, {}, null).artist).toBe(true);
    expect(cardViewOf(b, {}, null).artist).toBe(false);
    // Sin servidor no hay número (D-20).
    expect(memberNumberLabel(cardViewOf(a, {}, null).memberNumber)).toBe('—');
  });
});

describe('el resultado de un sello', () => {
  it('la ventana del QR sale del detalle de outside_window', () => {
    expect(
      parseWindow('El sello vale de 2026-10-31 22:00:00+00 a 2026-11-01 06:00:00+00.'),
    ).toEqual({ from: '2026-10-31T22:00:00.000Z', until: '2026-11-01T06:00:00.000Z' });
    expect(
      parseWindow('El sello vale de 2026-10-03 12:01:02.123456+02 a 2026-10-03 14:00:00+02.'),
    ).toEqual({ from: '2026-10-03T10:01:02.123Z', until: '2026-10-03T12:00:00.000Z' });
    expect(parseWindow('nada')).toBeNull();
  });

  it('fuera de hora, antes y después, con la fecha y las horas de Madrid', () => {
    const event = {
      slug: 'boia-halloween-2026',
      id: null,
      name: 'BOIA Halloween',
      startsAt: null,
      endsAt: null,
      place: null,
      image: null,
    };
    const from = '2026-10-31T22:00:00Z';
    const until = '2026-11-01T06:00:00Z';
    const early = outcomeCopy({ kind: 'early', event, from, until });
    expect(early.title).toBe(t('stamp.err.early.title'));
    expect(early.body).toContain('BOIA Halloween');
    expect(early.body).toContain('vale el sábado 31 de octubre, de');
    expect(early.body).toContain(`de ${clock(from)} a ${clock(until)}`);
    expect(clock(from)).toBe('23:00');
    const late = outcomeCopy({ kind: 'late', event, from, until });
    expect(late.title).toBe(t('stamp.err.late.title'));
    const already = outcomeCopy({ kind: 'already', event, at: '2026-10-31T23:42:00Z' });
    expect(already.body).toContain('00:42');
    expect(outcomeCopy({ kind: 'invalid', event: null }).title).toBe(t('stamp.err.invalid.title'));
  });
});
