import { describe, expect, it } from 'vitest';
import { characterRng } from '@boia/engine/characters';
import { es } from '../i18n/es';
import {
  BANTER_COOLDOWN_MS,
  BANTER_MOODS,
  BANTER_NAME_KEY,
  BANTER_POOL_SIZE,
  BANTER_SPEAKERS,
  CHAT_RADIUS,
  chatShows,
  BagPicker,
  BanterPicker,
  HOROSCOPO_COUNT,
  alicanteDate,
  banterKey,
  dateParam,
  fiesteraMayChat,
  horoscopoDay,
  horoscopoIndex,
  horoscopoKey,
  horoscopoOf,
  horoscopoPending,
  portWelcomeKey,
} from './banter';

const text = (key: string): string | undefined => (es as Record<string, string>)[key];

describe('BagPicker', () => {
  it('no repite hasta agotar el montón, y en cada vuelta salen todas', () => {
    const bag = new BagPicker(7, characterRng(3));
    for (let round = 0; round < 4; round++) {
      const seen = Array.from({ length: 7 }, () => bag.next());
      expect(new Set(seen).size).toBe(7);
    }
  });
  it('al rebarajar no empieza por la última que salió', () => {
    for (let seed = 1; seed < 40; seed++) {
      const bag = new BagPicker(5, characterRng(seed));
      let prev = -1;
      for (let i = 0; i < 60; i++) {
        const n = bag.next();
        expect(n).not.toBe(prev);
        prev = n;
      }
    }
  });
});

describe('BanterPicker', () => {
  it('cada personaje y ambiente tiene su propio montón sin repetir', () => {
    const p = new BanterPicker(characterRng(9));
    for (const s of BANTER_SPEAKERS) {
      for (const m of BANTER_MOODS) {
        const seen = Array.from({ length: BANTER_POOL_SIZE }, () => p.line(s, m));
        expect(new Set(seen).size).toBe(BANTER_POOL_SIZE);
        expect(seen.every((k) => k.startsWith(`mar.banter.${s}.${m}.`))).toBe(true);
      }
    }
  });
  it('un personaje calla un rato después de hablar; los demás no esperan', () => {
    const p = new BanterPicker(characterRng(4));
    expect(p.say('naufrago', 'dia', 0)).not.toBeNull();
    expect(p.say('naufrago', 'dia', BANTER_COOLDOWN_MS - 1)).toBeNull();
    expect(p.say('delfin', 'dia', BANTER_COOLDOWN_MS - 1)).not.toBeNull();
    expect(p.say('naufrago', 'dia', BANTER_COOLDOWN_MS)).not.toBeNull();
  });
  it('callar no gasta frases: las que salen siguen sin repetirse', () => {
    const p = new BanterPicker(characterRng(5));
    const seen: string[] = [];
    for (let i = 0; seen.length < BANTER_POOL_SIZE; i++) {
      const k = p.say('fiestera', 'noche', i * 1000);
      if (k) seen.push(k);
    }
    expect(new Set(seen).size).toBe(BANTER_POOL_SIZE);
  });
  it('la Fiestera sólo charla fuera del rescate', () => {
    expect(fiesteraMayChat(null)).toBe(true);
    expect(fiesteraMayChat('delivered')).toBe(true);
    for (const p of ['loading', 'waiting', 'boarding', 'aboard', 'landing'])
      expect(fiesteraMayChat(p)).toBe(false);
  });
  it('un ambiente desconocido cae en la tarde', () => {
    expect(new BanterPicker().line('fiestera', '??')).toMatch(/^mar\.banter\.fiestera\.tarde\./);
  });
  it('hay al menos 6 frases por ambiente, todas en i18n, con texto y distintas', () => {
    expect(BANTER_POOL_SIZE).toBeGreaterThanOrEqual(6);
    const all = new Set<string>();
    for (const s of BANTER_SPEAKERS)
      for (const m of BANTER_MOODS)
        for (let n = 1; n <= BANTER_POOL_SIZE; n++) {
          const k = banterKey(s, m, n);
          expect(text(k), k).toBeTruthy();
          all.add(text(k)!);
        }
    expect(all.size).toBe(BANTER_SPEAKERS.length * BANTER_MOODS.length * BANTER_POOL_SIZE);
  });
});

describe('horóscopo boiero', () => {
  it('hay al menos 30, todos en i18n y distintos', () => {
    expect(HOROSCOPO_COUNT).toBeGreaterThanOrEqual(30);
    const texts = new Set<string>();
    for (let n = 1; n <= HOROSCOPO_COUNT; n++) {
      expect(text(horoscopoKey(n)), horoscopoKey(n)).toBeTruthy();
      texts.add(text(horoscopoKey(n))!);
    }
    expect(texts.size).toBe(HOROSCOPO_COUNT);
  });
  it('es estable para una fecha y cambia al día siguiente', () => {
    expect(horoscopoOf('2026-12-31')).toBe(horoscopoOf('2026-12-31'));
    let d = new Date('2026-01-01T00:00:00Z');
    for (let i = 0; i < 400; i++) {
      const a = d.toISOString().slice(0, 10);
      const next = new Date(d.getTime() + 86_400_000);
      expect(horoscopoIndex(a)).not.toBe(horoscopoIndex(next.toISOString().slice(0, 10)));
      d = next;
    }
  });
  it('recorre todos antes de repetir', () => {
    const seen = new Set<number>();
    for (let i = 0; i < HOROSCOPO_COUNT; i++) {
      seen.add(horoscopoIndex(new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)));
    }
    expect(seen.size).toBe(HOROSCOPO_COUNT);
  });
  it('la fecha es la de Alicante, no la UTC, y manda el parámetro de desarrollo', () => {
    // 23:30 UTC del 30 de diciembre ya es 31 en Alicante (invierno, UTC+1).
    expect(alicanteDate(new Date('2026-12-30T23:30:00Z'))).toBe('2026-12-31');
    // 22:30 UTC de un día de verano ya es el siguiente (UTC+2).
    expect(alicanteDate(new Date('2026-07-10T22:30:00Z'))).toBe('2026-07-11');
    expect(alicanteDate(new Date('2026-07-10T12:00:00Z'), '2026-12-31')).toBe('2026-12-31');
  });
  it('?fecha=2026-12-31 fija el día del horóscopo; sin él, el de Alicante', () => {
    const now = new Date('2026-07-10T12:00:00Z');
    expect(horoscopoDay('?fecha=2026-12-31', now)).toBe('2026-12-31');
    expect(horoscopoDay('?fecha=mañana', now)).toBe('2026-07-10');
    expect(horoscopoDay('', now)).toBe('2026-07-10');
  });
  it('?fecha= sólo acepta fechas reales', () => {
    expect(dateParam('?fecha=2026-12-31')).toBe('2026-12-31');
    expect(dateParam('?fecha=2026-02-31')).toBeNull();
    expect(dateParam('?fecha=hoy')).toBeNull();
    expect(dateParam('')).toBeNull();
  });
  it('se enseña una vez al día', () => {
    expect(horoscopoPending(null, '2026-10-13')).toBe(true);
    expect(horoscopoPending('2026-10-12', '2026-10-13')).toBe(true);
    expect(horoscopoPending('2026-10-13', '2026-10-13')).toBe(false);
  });
});

describe('tono de marca', () => {
  it('ninguna frase habla de bebida ni de drogas', () => {
    const keys = Object.keys(es).filter(
      (k) =>
        k.startsWith('mar.banter.') ||
        k.startsWith('mar.horoscopo.') ||
        k.startsWith('mar.puerto.'),
    );
    expect(keys.length).toBeGreaterThan(HOROSCOPO_COUNT);
    const bad =
      /\b(cerveza|birra|tinto|vino|copas?|cubatas?|chupitos?|alcohol|borrach\w*|droga\w*|porros?|pastillas?|barra|bar)\b/i;
    for (const k of keys) expect(text(k), k).not.toMatch(bad);
  });
});

describe('bienvenida del Puerto', () => {
  it('la primera vez y la de vuelta son distintas, existen y no dicen «descubierta»', () => {
    const first = portWelcomeKey(true);
    const back = portWelcomeKey(false);
    for (const k of [first.title, first.body, back.title, back.body])
      expect(text(k), k).toBeTruthy();
    expect(text(first.title)).not.toBe(text(back.title));
    expect(text(first.body)).not.toBe(text(back.body));
    expect(`${text(first.title)} ${text(first.body)}`).not.toMatch(/descubierta/i);
  });
  it('cada personaje que charla tiene nombre para el aviso', () => {
    for (const s of BANTER_SPEAKERS) expect(text(BANTER_NAME_KEY[s]), s).toBeTruthy();
  });
});

describe('dónde se ven los bocadillos (T279)', () => {
  it('nunca en la vista de mapa, por cerca que esté quien habla', () => {
    expect(chatShows({ map: true, distance: 0 })).toBe(false);
    expect(chatShows({ map: true, distance: CHAT_RADIUS / 2 })).toBe(false);
  });

  it('en cubierta, sólo con el barco cerca de quien habla', () => {
    expect(chatShows({ map: false, distance: 0 })).toBe(true);
    expect(chatShows({ map: false, distance: CHAT_RADIUS })).toBe(true);
    expect(chatShows({ map: false, distance: CHAT_RADIUS + 1 })).toBe(false);
    expect(chatShows({ map: false, distance: CHAT_RADIUS * 5 })).toBe(false);
    // Sin saber dónde está, no se enseña.
    expect(chatShows({ map: false, distance: null })).toBe(false);
    expect(chatShows({ map: false, distance: 150 }, 100)).toBe(false);
  });
});
