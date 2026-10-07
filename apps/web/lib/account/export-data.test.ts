import { MemoryStorage, SAMPLE_CREW, SAMPLE_EVENTS, createLocalRepository } from '@boia/store';
import { describe, expect, it } from 'vitest';
import {
  EXPORT_FORMAT,
  buildAccountExport,
  buildLocalExport,
  exportFileName,
  stripSecrets,
} from './export-data';

/**
 * «Descargar mis datos» (plan 017 T193, REQ-IDE-050): sólo lo de quien lo
 * pide, nada de los demás (los miembros de muestra, sus botellas) y ningún
 * secreto.
 */

function repo() {
  return createLocalRepository({ storage: new MemoryStorage(), watch: false });
}

/** Todos los valores de las claves que nombran a una persona. */
function personIds(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const v of value) personIds(v, out);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (/^(userId|authorId|user_id|reader_id|reporter_id)$/.test(k) && typeof v === 'string') {
        out.push(v);
      }
      personIds(v, out);
    }
  }
  return out;
}

const SECRET_KEY = /pass(word)?|token|secret|totp|backup|code_hash|^salt$|^hash$/i;

function keys(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) for (const v of value) keys(v, out);
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.push(k);
      keys(v, out);
    }
  }
  return out;
}

describe('descargar mis datos en modo local', () => {
  it('lleva lo propio: Carnet, puntos, libro, compra, sello y botella', async () => {
    const r = repo();
    await r.carnet.create({ nickname: 'Exporta Bien' });
    await r.carnet.answer('descubrimiento', 'La de la playa');
    await r.progress.grantWorldReward({ sourceRef: 'cofre-exporta', points: 30, coins: 12 });
    const onSale = SAMPLE_EVENTS.find((e) => e.state === 'on_sale');
    if (onSale) await r.purchases.confirmSandbox({ purchaseId: 'p-exporta', eventId: onSale.id });
    await r.bottles.place({ message: 'Hola desde la exportación', x: 3, y: 4 });
    const me = (await r.identity.current())!.id;

    const data = await buildLocalExport(r, new Date('2026-10-07T10:00:00Z'));
    expect(data.format).toBe(EXPORT_FORMAT);
    expect(data.mode).toBe('local');
    expect(data.exportedAt).toBe('2026-10-07T10:00:00.000Z');
    expect(data.identity?.id).toBe(me);
    expect(data.carnet).toMatchObject({ userId: me, nickname: 'Exporta Bien', isMine: true });
    expect(data.balances).toMatchObject({ points: 30, coins: 12 });
    expect(data.ledger.length).toBeGreaterThan(0);
    expect(data.bottle).toMatchObject({ message: 'Hola desde la exportación', isMine: true });
    if (onSale) {
      expect(data.purchases).toEqual([expect.objectContaining({ id: 'p-exporta', userId: me })]);
      expect(data.stamps).toEqual([expect.objectContaining({ eventId: onSale.id })]);
    }
  });

  it('nada de nadie más: ni miembros de muestra ni sus botellas', async () => {
    const r = repo();
    await r.carnet.create({ nickname: 'Solo Lo Mio' });
    await r.bottles.place({ message: 'La mía', x: 1, y: 1 });
    // Hay botellas y Carnets de otros en el mar de muestra.
    const others = (await r.bottles.list()).filter((b) => !b.isMine);
    expect(others.length).toBeGreaterThan(0);
    const me = (await r.identity.current())!.id;

    const data = await buildLocalExport(r);
    const ids = personIds(data);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids)).toEqual(new Set([me]));
    const text = JSON.stringify(data);
    for (const m of SAMPLE_CREW) expect(text).not.toContain(m.nickname);
    for (const b of others) expect(text).not.toContain(b.message);
  });

  it('sin secretos: ninguna clave de contraseña, token, TOTP o códigos', async () => {
    const r = repo();
    await r.carnet.create({ nickname: 'Sin Secretos' });
    const data = await buildLocalExport(r);
    expect(keys(data).filter((k) => SECRET_KEY.test(k))).toEqual([]);
  });

  it('sin Carnet todavía: la identidad y lo demás vacío, sin fallar', async () => {
    const data = await buildLocalExport(repo());
    expect(data.carnet).toBeNull();
    expect(data.bottle).toBeNull();
    expect(data.purchases).toEqual([]);
  });
});

describe('descargar mis datos con cuenta', () => {
  it('añade lo del servidor y le quita cualquier secreto', async () => {
    const r = repo();
    await r.carnet.create({ nickname: 'Con Cuenta' });
    const data = await buildAccountExport(r, async () => ({
      account: { id: 'u-1', email: 'yo@example.test' },
      carnet: { user_id: 'u-1', nickname: 'Con Cuenta', access_token: 'x' },
      backup_codes: ['AAAAA-BBBBB'],
      nested: [{ refresh_token: 'y', password: 'z', ok: 1 }],
    }));
    expect(data.mode).toBe('account');
    expect(data.server).toEqual({
      account: { id: 'u-1', email: 'yo@example.test' },
      carnet: { user_id: 'u-1', nickname: 'Con Cuenta' },
      nested: [{ ok: 1 }],
    });
  });

  it('stripSecrets no toca lo demás', () => {
    expect(stripSecrets({ a: 1, b: [{ c: 'd', salt: 'e' }], code: 'DESC10' })).toEqual({
      a: 1,
      b: [{ c: 'd' }],
      code: 'DESC10',
    });
  });

  it('el archivo se llama con la fecha', () => {
    expect(exportFileName(new Date('2026-10-07T23:00:00Z'))).toBe(
      'boia-planet-mis-datos-2026-10-07.json',
    );
  });
});
