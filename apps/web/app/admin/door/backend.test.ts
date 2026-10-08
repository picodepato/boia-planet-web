import { MemoryStorage, SAMPLE_CREW, createLocalRepository } from '@boia/store';
import { describe, expect, it } from 'vitest';
import { t } from '../../../lib/i18n';
import { carnetPath } from '../../../lib/mundo/carnet/share';
import { signupUrl } from '../../../lib/scanner/carnet-url';
import { currentParty, localDoor, outcomeText, stampFromQr } from './backend';

/**
 * La puerta sin servidor (plan 019 T218, decisión 11): lo que hace el lector
 * con cada QR y «Sellar a mano», sobre el repositorio de este navegador.
 */
const ORIGIN = 'http://localhost:3000';

async function door() {
  const repo = createLocalRepository({ storage: new MemoryStorage(), watch: false });
  const mine = await repo.carnet.create({ nickname: 'Grumete Puerta' });
  const backend = localDoor(repo);
  const parties = await backend.parties();
  const party = parties[0]!;
  return { repo, mine, backend, party };
}

describe('el lector de la puerta, sin servidor', () => {
  it('el QR de un Carnet lo sella una vez; la segunda dice que ya lo tenía', async () => {
    const { repo, mine, backend, party } = await door();
    const qr = `${ORIGIN}${carnetPath(mine.userId)}`;
    const first = await stampFromQr(backend, qr, party.key);
    expect(first).toMatchObject({ kind: 'granted', nickname: 'Grumete Puerta', party: party.name });
    expect(outcomeText(first)).toBe(
      t('puerta.result.granted', { nickname: 'Grumete Puerta', party: party.name }),
    );
    expect((await stampFromQr(backend, qr, party.key)).kind).toBe('already');
    expect(await backend.attendance(party.key)).toBe(1);
    expect((await repo.carnet.mine())?.stamps.map((s) => s.eventId)).toEqual([party.key]);
  });

  it('otro QR, el de alta o un Carnet que no existe aquí: no sella', async () => {
    const { backend, party } = await door();
    expect((await stampFromQr(backend, signupUrl(ORIGIN), party.key)).kind).toBe('notCarnet');
    expect((await stampFromQr(backend, 'https://example.com', party.key)).kind).toBe('notCarnet');
    const ghost = `${ORIGIN}${carnetPath('3f2b8c1e-9d4a-4f6b-8a2e-1c5d7e9f0a1b')}`;
    expect((await stampFromQr(backend, ghost, party.key)).kind).toBe('unknown');
    // Los Carnets de muestra no son de nadie: no se sellan.
    const crew = `${ORIGIN}${carnetPath(SAMPLE_CREW[0]!.userId)}`;
    expect((await stampFromQr(backend, crew, party.key)).kind).toBe('unknown');
    expect(await backend.attendance(party.key)).toBe(0);
  });

  it('a mano: busca el Carnet por apodo y pide motivo', async () => {
    const { mine, backend, party } = await door();
    expect((await backend.members('grumete')).map((m) => m.userId)).toEqual([mine.userId]);
    expect(await backend.members('nadie así')).toEqual([]);
    const without = await backend.stamp(mine.userId, party.key, 'manual');
    expect(without.kind).toBe('error');
    const r = await backend.stamp(mine.userId, party.key, 'manual', 'vino sin móvil');
    expect(r.kind).toBe('granted');
  });
});

describe('la fiesta que toca', () => {
  const p = (key: string, startsAt: string | null) => ({ key, name: key, startsAt });
  const now = new Date('2026-10-31T23:00:00Z').getTime();

  it('la que está en marcha o la próxima; si todas pasaron, la última', () => {
    const list = [
      p('pasada', '2026-08-01T20:00:00Z'),
      p('esta-noche', '2026-10-31T21:00:00Z'),
      p('proxima', '2026-12-31T21:00:00Z'),
    ];
    expect(currentParty(list, now)?.key).toBe('esta-noche');
    expect(currentParty(list.slice(2), now)?.key).toBe('proxima');
    expect(currentParty(list.slice(0, 1), now)?.key).toBe('pasada');
    expect(currentParty([p('sin-fecha', null)], now)?.key).toBe('sin-fecha');
    expect(currentParty([], now)).toBeNull();
  });
});
