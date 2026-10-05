import { describe, expect, it } from 'vitest';
import { SAMPLE_EVENTS } from '../sample';
import { isStoreError } from '../errors';
import { createLocalRepository, localDocAccess } from '../local';
import type { BoiaRepository, RepositoryChange } from '../repository';
import { MemoryStorage, type StorageLike } from '../storage';
import { FakeSupabase } from './fake-supabase';
import { applySnapshot, ledgerFromServer, snapshotOf } from './hydrate';
import {
  createMemberRepository,
  memberSyncKey,
  type MemberRepository,
  type SyncEvent,
} from './member';
import { SyncRejectedError } from './ops';
import { classifyServerError, supabaseMemberServer, type ServerLedgerRow } from './server';
import { createSwitchableRepository } from './switchable';

const UID = '11111111-2222-3333-4444-555555555555';
const SKIN = 'skin-arcilla-noche';
const RECORD = 'circuito:el-freu:v3';

/** Un dispositivo de la cuenta: su copia en su almacenamiento y su cola. */
function device(fake: FakeSupabase, storage: StorageLike = new MemoryStorage()) {
  const events: SyncEvent[] = [];
  let cache!: BoiaRepository;
  const make = () => {
    cache = createLocalRepository({ storage, key: `boia.cuenta.${fake.userId}`, watch: false });
    return createMemberRepository({
      userId: fake.userId,
      cache,
      server: supabaseMemberServer(fake, fake.userId),
      storage,
      onEvent: (e) => events.push(e),
      snapshotDelayMs: 60_000,
      readyTimeoutMs: 2000,
      retryMs: [60_000],
    });
  };
  const repo = make();
  return { repo, cache, storage, events, reopen: make };
}

function withCarnet(fake: FakeSupabase, nickname = 'Marea') {
  fake.carnet = {
    user_id: fake.userId,
    nickname,
    avatar_key: null,
    avatar_image: null,
    member_since: '2026-10-01T09:00:00.000Z',
    member_number: 7,
    version: 1,
  };
  return fake;
}

const rpcs = (fake: FakeSupabase) => fake.calls.map((c) => c.fn);

describe('repositorio de un miembro: sincronización', () => {
  it('lo que gana, compra, equipa y corre va a sus RPC, y otro navegador lo lee del servidor', async () => {
    const fake = withCarnet(new FakeSupabase(UID));
    const a = device(fake);
    await a.repo.sync.ready();
    // La copia ya tiene el Carnet de la cuenta.
    expect((await a.repo.carnet.mine())?.nickname).toBe('Marea');

    await a.repo.progress.grantWorldReward({ sourceRef: 'lugar:faro:coins', coins: 50 });
    await a.repo.progress.grantWorldReward({ sourceRef: 'lugar:faro:points', points: 30 });
    expect(await a.repo.progress.buyCosmetic(SKIN)).toMatchObject({ granted: true });
    await a.repo.progress.equip('skin', SKIN);
    await a.repo.progress.submitTime(RECORD, 61_234.4);
    await a.repo.carnet.answer('obra', 'Un disco de vinilo');
    await a.repo.sync.flush();

    expect(rpcs(fake)).toEqual([
      'award_points',
      'award_points',
      'buy_cosmetic',
      'equip_cosmetic',
      'submit_race_time',
    ]);
    expect(fake.calls[0]!.args).toMatchObject({
      p_action: 'world',
      p_ref: 'lugar:faro:coins',
      p_coins: 50,
      p_points: 0,
      p_policy: 'once',
    });
    expect(fake.calls[4]!.args).toMatchObject({ p_circuit: 'el-freu', p_version: 3, p_ms: 61_234 });
    expect(fake.balances()).toEqual({ points: 30, coins: 0 });
    expect(fake.equipped).toEqual({ skin: SKIN, ship: 'barco-arcilla' });
    expect(fake.answers).toMatchObject([{ question_id: 'obra', answer: 'Un disco de vinilo' }]);
    expect(a.repo.sync.pending()).toBe(0);

    // Otro navegador, sin nada guardado: todo sale del servidor.
    const b = device(fake);
    await b.repo.sync.ready();
    expect(await b.repo.progress.balances()).toMatchObject({ points: 30, coins: 0 });
    expect(await b.repo.progress.equipped()).toEqual({ skin: SKIN, ship: 'barco-arcilla' });
    expect((await b.repo.progress.shop()).find((i) => i.cosmetic.id === SKIN)).toMatchObject({
      owned: true,
      equipped: true,
    });
    expect(await b.repo.progress.record(RECORD)).toMatchObject({ bestMs: 61_234, attempts: 1 });
    const carnet = await b.repo.carnet.mine();
    expect(carnet).toMatchObject({ userId: UID, nickname: 'Marea', points: 30 });
    expect(carnet?.answers.map((x) => x.answer)).toEqual(['Un disco de vinilo']);
    // Repetir en el otro navegador lo ya ganado no da nada (mismos ids que el servidor).
    expect(
      await b.repo.progress.grantWorldReward({ sourceRef: 'lugar:faro:points', points: 30 }),
    ).toMatchObject({ granted: false, reason: 'duplicate' });
  });

  it('un logro reclamado va como award_points de logro y vuelve como logro reclamado', async () => {
    const fake = withCarnet(new FakeSupabase(UID));
    const a = device(fake);
    await a.repo.progress.completeAchievement('primera-boia');
    await a.repo.progress.claimAchievement('primera-boia');
    await a.repo.sync.flush();
    expect(fake.calls[0]).toMatchObject({
      fn: 'award_points',
      args: { p_action: 'achievement', p_ref: 'primera-boia', p_points: 20, p_coins: 10 },
    });
    const b = device(fake);
    const claimed = (await b.repo.progress.achievements()).find(
      (x) => x.definition.id === 'primera-boia',
    );
    expect(claimed?.state).toBe('claimed');
    expect(await b.repo.progress.balances()).toMatchObject({ points: 20, coins: 10 });
  });

  it('el resto del documento va con save_snapshot y otro navegador lo recupera', async () => {
    const fake = withCarnet(new FakeSupabase(UID));
    const a = device(fake);
    await a.repo.progress.discover('isla:puerto');
    await a.repo.progress.setMission('fiestera', { step: 'rescued', data: { who: 'boia' } });
    await a.repo.progress.increment('tiempo-jugado-s', 15);
    await a.repo.progress.setPref('barco.vista', 'cerca');
    await a.repo.sync.saveSnapshot();
    expect(fake.snapshot?.version).toBe(1);
    // Sin cambios no se vuelve a guardar.
    await a.repo.sync.saveSnapshot();
    expect(rpcs(fake).filter((f) => f === 'save_snapshot')).toHaveLength(1);

    const b = device(fake);
    await b.repo.sync.ready();
    expect((await b.repo.progress.discoveries()).map((d) => d.key)).toEqual(['isla:puerto']);
    expect(await b.repo.progress.mission('fiestera')).toMatchObject({ step: 'rescued' });
    expect(await b.repo.progress.counter('tiempo-jugado-s')).toBe(15);
    expect(await b.repo.progress.pref('barco.vista')).toBe('cerca');
  });
});

describe('repositorio de un miembro: sin red', () => {
  it('lo hecho sin red se queda en la cola (también al cerrar la pestaña) y va al volver', async () => {
    const fake = withCarnet(new FakeSupabase(UID));
    fake.addRow({
      kind: 'world_reward',
      coins_delta: 50,
      source_ref: 'lugar:cofre:coins',
      action: 'world',
      metadata: { policy: 'once', key: 'lugar:cofre:coins' },
    });
    const a = device(fake);
    await a.repo.sync.ready();
    fake.offline = true;

    await a.repo.progress.grantWorldReward({ sourceRef: 'lugar:faro:points', points: 25 });
    // Comprar sin red no falla: queda apuntado y se manda después.
    expect(await a.repo.progress.buyCosmetic(SKIN)).toMatchObject({ granted: true });
    expect(await a.repo.progress.balances()).toMatchObject({ points: 25, coins: 0 });
    expect(a.repo.sync.pending()).toBe(2);
    expect(a.repo.sync.offline()).toBe(true);
    expect(a.events.filter((e) => e.type === 'offline')).toHaveLength(1);

    // La pestaña se cierra: otra abre con la misma copia y la misma cola.
    a.repo.sync.dispose();
    const again = a.reopen();
    expect(again.sync.pending()).toBe(2);
    expect(await again.progress.balances()).toMatchObject({ points: 25, coins: 0 });

    fake.offline = false;
    await again.sync.flush();
    expect(again.sync.pending()).toBe(0);
    expect(a.events.some((e) => e.type === 'online')).toBe(true);
    expect(fake.balances()).toEqual({ points: 25, coins: 0 });
    expect(fake.ledger.some((r) => r.kind === 'cosmetic' && r.cosmetic_key === SKIN)).toBe(true);
    expect(await again.progress.balances()).toMatchObject({ points: 25, coins: 0 });
  });
});

describe('repositorio de un miembro: rechazos y conflictos (gana el servidor)', () => {
  it('un premio rechazado se avisa y la copia vuelve a lo del servidor', async () => {
    const fake = withCarnet(new FakeSupabase(UID));
    const a = device(fake);
    await a.repo.sync.ready();
    fake.failNext('award_points', 'limit_daily');
    await a.repo.progress.grantWorldReward({ sourceRef: 'minigame:faro', points: 40 });
    await a.repo.sync.flush();
    expect(a.events).toContainEqual({ type: 'rejected', op: 'award', reason: 'limit_daily' });
    expect(await a.repo.progress.balances()).toMatchObject({ points: 0, coins: 0 });
    expect(a.repo.sync.pending()).toBe(0);
  });

  it('un origen que el servidor no conoce no se queda en silencio', async () => {
    const fake = withCarnet(new FakeSupabase(UID));
    const a = device(fake);
    await a.repo.progress.grantWorldReward({ sourceRef: 'e2e:cofre', coins: 5 });
    await a.repo.sync.flush();
    expect(a.events).toContainEqual({ type: 'rejected', op: 'award', reason: 'unknown_action' });
    expect(await a.repo.progress.balances()).toMatchObject({ coins: 0 });
    expect(rpcs(fake)).not.toContain('award_points');
  });

  it('comprar con una copia que cree tener monedas: el rechazo llega a quien compra y se deshace', async () => {
    const fake = withCarnet(new FakeSupabase(UID));
    const a = device(fake);
    await a.repo.sync.ready();
    // La copia cree tener 100 monedas que el servidor no tiene (p. ej. ya gastadas en otro sitio).
    const access = localDocAccess(a.cache)!;
    access.write(['progress'], (d) => {
      d.ledger.push({
        id: 'world_reward:lugar:viejo:coins',
        userId: UID,
        kind: 'world_reward',
        pointsDelta: 0,
        coinsDelta: 100,
        seasonId: null,
        sourceRef: 'lugar:viejo:coins',
        metadata: { policy: 'once' },
        createdAt: '2026-10-02T10:00:00.000Z',
      });
    });
    const err = await a.repo.progress.buyCosmetic(SKIN).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SyncRejectedError);
    expect(isStoreError(err, 'insufficient_coins')).toBe(true);
    expect((err as SyncRejectedError).reason).toBe('insufficient_coins');
    // La copia vuelve a lo del servidor: ni monedas de más ni la skin.
    expect(await a.repo.progress.balances()).toMatchObject({ coins: 0 });
    expect((await a.repo.progress.shop()).find((i) => i.cosmetic.id === SKIN)?.owned).toBe(false);
  });

  it('un apodo ocupado en el servidor se rechaza como «apodo en uso»', async () => {
    const fake = withCarnet(new FakeSupabase(UID));
    fake.takenNicknames.add('ola');
    const a = device(fake);
    const err = await a.repo.carnet.update({ nickname: 'Ola' }).catch((e: unknown) => e);
    expect(isStoreError(err, 'conflict')).toBe(true);
    expect(String((err as Error).message)).toMatch(/apodo/);
    expect((await a.repo.carnet.mine())?.nickname).toBe('Marea');
  });

  it('lo que cambió en el servidor gana a la copia al volver a leer', async () => {
    const fake = withCarnet(new FakeSupabase(UID));
    fake.addRow({
      kind: 'world_reward',
      coins_delta: 50,
      source_ref: 'lugar:cofre:coins',
      action: 'world',
      metadata: { policy: 'once', key: 'lugar:cofre:coins' },
    });
    const a = device(fake);
    await a.repo.progress.buyCosmetic('estela-naranja');
    await a.repo.progress.equip('wake', 'estela-naranja');
    expect(await a.repo.progress.equipped()).toEqual({ wake: 'estela-naranja' });
    // En otro dispositivo se quita la estela y el Admin anula la compra.
    fake.equipped = {};
    const buy = fake.ledger.find((r) => r.kind === 'cosmetic')!;
    fake.addRow({
      kind: 'compensation',
      compensates_id: buy.id,
      coins_delta: 30,
      reason: 'duplicada',
    });
    await a.repo.sync.refresh();
    expect(await a.repo.progress.equipped()).toEqual({});
    expect(await a.repo.progress.balances()).toMatchObject({ coins: 50 });
    expect((await a.repo.progress.cosmetics()).map((c) => c.id)).toEqual([]);
  });

  it('ignora banderas antiguas del servidor en cada lectura sin devolver monedas', async () => {
    const fake = withCarnet(new FakeSupabase(UID));
    fake.addRow({
      kind: 'world_reward',
      coins_delta: 50,
      source_ref: 'lugar:cofre:coins',
      action: 'world',
      metadata: { policy: 'once', key: 'lugar:cofre:coins' },
    });
    fake.addRow({
      kind: 'cosmetic',
      coins_delta: -20,
      cosmetic_key: 'bandera-boia',
      source_ref: 'coins',
    });
    fake.equipped = { flag: 'bandera-boia', ship: 'barco-arcilla', wake: 'estela-naranja' };
    const ledger = structuredClone(fake.ledger);
    const equipped = structuredClone(fake.equipped);
    const a = device(fake);
    await a.repo.sync.ready();
    for (let n = 0; n < 2; n++) {
      await a.repo.sync.refresh();
      expect(await a.repo.progress.equipped()).toEqual({
        ship: 'barco-arcilla',
        wake: 'estela-naranja',
      });
      expect(await a.repo.progress.cosmetics()).toEqual([]);
      expect(await a.repo.progress.balances()).toMatchObject({ coins: 30 });
      expect(fake.ledger).toEqual(ledger);
      expect(fake.equipped).toEqual(equipped);
    }
  });

  it('dos dispositivos guardan la copia: rebase conserva los descubrimientos de ambos', async () => {
    const fake = withCarnet(new FakeSupabase(UID));
    const a = device(fake);
    const b = device(fake);
    await Promise.all([a.repo.sync.ready(), b.repo.sync.ready()]);
    await a.repo.progress.discover('isla:norte');
    await a.repo.sync.saveSnapshot();
    await b.repo.progress.discover('isla:sur');
    await b.repo.sync.saveSnapshot();
    expect(fake.snapshot?.version).toBe(2);
    expect((await b.repo.progress.discoveries()).map((d) => d.key).sort()).toEqual([
      'isla:norte',
      'isla:sur',
    ]);
    // Y desde ahí sigue guardando sobre la versión del servidor.
    await b.repo.progress.discover('isla:este');
    await b.repo.sync.saveSnapshot();
    expect(fake.snapshot?.version).toBe(3);
  });
});

describe('invitado ↔ miembro sin recargar', () => {
  it('la misma referencia lee del invitado o de la cuenta, avisa al cambiar y espera a saber quién juega', async () => {
    const guest = createLocalRepository({ storage: new MemoryStorage(), watch: false });
    await guest.progress.grantWorldReward({ sourceRef: 'lugar:faro:points', points: 10 });
    const sw = createSwitchableRepository(guest);
    const repo = sw.repo;
    const changes: RepositoryChange[] = [];
    repo.subscribe((c) => changes.push(c));
    expect(await repo.progress.balances()).toMatchObject({ points: 10 });

    const fake = withCarnet(new FakeSupabase(UID));
    fake.addRow({
      kind: 'world_reward',
      points_delta: 30,
      source_ref: 'lugar:cofre:points',
      action: 'world',
      metadata: { policy: 'once', key: 'lugar:cofre:points' },
    });
    const member: MemberRepository = device(fake).repo;
    sw.switchTo(member);
    expect(changes.at(-1)?.areas).toEqual(
      expect.arrayContaining(['identity', 'carnet', 'progress', 'purchases', 'bottles']),
    );
    expect(await repo.progress.balances()).toMatchObject({ points: 30 });
    expect((await repo.identity.current())?.id).toBe(UID);
    expect((await repo.carnet.mine())?.nickname).toBe('Marea');

    // Lo que se gana ahora va a la cuenta; el invitado no cambia.
    await repo.progress.grantWorldReward({ sourceRef: 'lugar:faro:points', points: 10 });
    await member.sync.flush();
    expect(fake.balances().points).toBe(40);
    expect(await guest.progress.balances()).toMatchObject({ points: 10 });
    // El contenido es siempre el del navegador.
    expect(repo.content).toBe(guest.content);

    sw.switchTo(guest);
    expect(await repo.progress.balances()).toMatchObject({ points: 10 });
    const n = changes.length;
    await member.progress.grantWorldReward({ sourceRef: 'lugar:otro:points', points: 5 });
    expect(changes.length).toBe(n);

    // Mientras no se sabe quién juega, las llamadas esperan.
    let open!: () => void;
    sw.hold(new Promise<void>((r) => (open = r)));
    let done = false;
    const read = repo.progress.balances().then(() => (done = true));
    await new Promise((r) => setTimeout(r, 20));
    expect(done).toBe(false);
    sw.switchTo(member);
    open();
    await read;
    expect(await repo.progress.balances()).toMatchObject({ points: 45 });
  });
});

describe('copia local de la cuenta', () => {
  const row = (r: Partial<ServerLedgerRow> & Pick<ServerLedgerRow, 'id' | 'kind'>) =>
    ({
      points_delta: 0,
      coins_delta: 0,
      cosmetic_key: null,
      compensates_id: null,
      source_ref: null,
      reason: null,
      created_by: null,
      metadata: {},
      created_at: '2026-10-03T10:00:00.000Z',
      action: null,
      occurred_at: null,
      ...r,
    }) as ServerLedgerRow;

  it('el libro del servidor sale con los ids del libro local', () => {
    const ledger = ledgerFromServer(
      [
        row({
          id: 'a',
          kind: 'world_reward',
          points_delta: 20,
          coins_delta: 10,
          source_ref: 'primera-boia',
          action: 'achievement',
        }),
        row({
          id: 'b',
          kind: 'world_reward',
          coins_delta: 50,
          source_ref: 'lugar:x:coins',
          action: 'world',
          metadata: { policy: 'daily', key: 'lugar:x:coins@2026-10-03', world: 'arcilla' },
        }),
        row({
          id: 'c',
          kind: 'cosmetic',
          coins_delta: -20,
          cosmetic_key: 'bandera-boia',
          source_ref: 'coins',
          created_at: '2026-10-03T11:00:00.000Z',
        }),
        row({
          id: 'd',
          kind: 'compensation',
          coins_delta: 20,
          compensates_id: 'c',
          reason: 'error',
          created_at: '2026-10-03T12:00:00.000Z',
        }),
        row({
          id: 'e',
          kind: 'cosmetic',
          coins_delta: -20,
          cosmetic_key: 'bandera-boia',
          source_ref: 'coins',
          created_at: '2026-10-03T13:00:00.000Z',
        }),
        row({
          id: 'f',
          kind: 'stamp',
          points_delta: 50,
          source_ref: 'qr:halloween-2026',
          action: 'stamp',
        }),
        row({
          id: 'g',
          kind: 'adjustment',
          coins_delta: 5,
          reason: 'regalo',
          created_by: 'admin-1',
        }),
      ],
      UID,
    );
    expect(ledger.map((e) => e.id)).toEqual([
      'world_reward:lugar:x:coins@2026-10-03',
      'stamp:qr:halloween-2026',
      'achievement:primera-boia',
      'adjustment:g',
      'cosmetic:bandera-boia',
      'compensation:d',
      'cosmetic:bandera-boia#2',
    ]);
    expect(ledger[0]).toMatchObject({ seasonId: 'arcilla', metadata: { policy: 'daily' } });
    expect(ledger.find((e) => e.kind === 'stamp')).toMatchObject({
      eventId: 'halloween-2026',
      purchaseId: 'qr:halloween-2026',
    });
    expect(ledger.find((e) => e.kind === 'compensation')?.compensatesId).toBe(
      'cosmetic:bandera-boia',
    );
  });

  it('la copia del resto del documento no lleva lo de valor y se aplica entera', () => {
    const repo = createLocalRepository({ storage: new MemoryStorage(), watch: false });
    const access = localDocAccess(repo)!;
    access.write(['progress'], (d) => {
      d.identity = { id: UID, kind: 'member', createdAt: '2026-10-01T00:00:00.000Z' };
      d.players[UID] = {
        discoveries: { 'isla:x': { at: '2026-10-01T00:00:00.000Z', worldId: null } },
        discounts: { secreto: { at: '2026-10-01T00:00:00.000Z', worldId: null } },
        missions: {},
        records: {
          [RECORD]: { id: RECORD, bestMs: 60_000, bestAt: '2026-10-01T00:00:00.000Z', attempts: 1 },
          'logro-vuelta:el-freu': {
            id: 'logro-vuelta:el-freu',
            bestMs: 20_000,
            bestAt: '2026-10-01T00:00:00.000Z',
            attempts: 2,
          },
        },
        counters: { pasos: 3 },
        equipped: { flag: 'bandera-boia' },
        prefs: {},
        achievements: {},
      };
    });
    const snap = snapshotOf(access.read(), UID);
    expect(Object.keys(snap.player.records)).toEqual(['logro-vuelta:el-freu']);
    expect(snap.player).not.toHaveProperty('equipped');
    expect(snap.player).not.toHaveProperty('discounts');

    const other = createLocalRepository({ storage: new MemoryStorage(), watch: false });
    const doc = localDocAccess(other)!.read();
    expect(applySnapshot(doc, UID, JSON.parse(JSON.stringify(snap)))).toBe(true);
    expect(doc.players[UID]?.counters).toEqual({ pasos: 3 });
    expect(Object.keys(doc.players[UID]!.records)).toEqual(['logro-vuelta:el-freu']);
    expect(applySnapshot(doc, UID, { format: 99 })).toBe(false);
  });

  it('cada fallo del cliente es pasajero (se reintenta) o un rechazo con su clave', () => {
    expect(classifyServerError({ code: 'P0001', message: 'too_fast' })).toMatchObject({
      transient: false,
      reason: 'too_fast',
    });
    expect(classifyServerError({ code: '42501', message: 'not_member' })).toMatchObject({
      transient: true,
    });
    expect(classifyServerError({ message: 'TypeError: Failed to fetch' })).toMatchObject({
      transient: true,
      reason: 'network',
    });
    expect(classifyServerError(new TypeError('fetch failed'))).toMatchObject({ transient: true });
    expect(classifyServerError({ code: 'PGRST301', message: 'JWT expired' })).toMatchObject({
      transient: true,
    });
    expect(classifyServerError({ code: '23505', message: 'dup' })).toMatchObject({
      transient: false,
      reason: 'invalid_input',
    });
    expect(memberSyncKey('boia.cuenta.x')).toBe('boia.cuenta.x.sync');
  });
});

it('T100: community reward and ship-menu awareness persist across member devices once', async () => {
  const fake = withCarnet(new FakeSupabase(UID));
  const a = device(fake);
  await a.repo.sync.ready();
  await a.repo.progress.discover('encuentro:whatsapp');
  await a.repo.progress.completeAchievement('whatsapp');
  await a.repo.progress.setPref('barco:menu-abierto', true);
  await a.repo.sync.saveSnapshot();
  await a.repo.progress.claimAchievement('whatsapp');
  await a.repo.sync.flush();
  expect(fake.calls.find((c) => c.fn === 'award_points')).toMatchObject({
    args: {
      p_action: 'achievement',
      p_ref: 'whatsapp',
      p_points: 300,
      p_coins: 50,
      p_policy: 'once',
    },
  });
  const b = device(fake);
  await b.repo.sync.ready();
  expect(await b.repo.progress.pref('barco:menu-abierto')).toBe(true);
  expect(await b.repo.progress.discover('encuentro:whatsapp')).toEqual({ first: false });
  expect((await b.repo.progress.claimAchievement('whatsapp')).claimed).toBe(false);
  await b.repo.sync.flush();
  expect(fake.calls.filter((c) => c.fn === 'award_points')).toHaveLength(1);
  expect(fake.balances()).toEqual({ points: 300, coins: 50 });
  a.repo.sync.dispose();
  b.repo.sync.dispose();
});

it('T106: confirmed sample-ticket stamp survives hydration and a fresh account cache', async () => {
  const fake = withCarnet(new FakeSupabase(UID));
  const a = device(fake);
  const event = SAMPLE_EVENTS.find((e) => e.state === 'on_sale')!;
  try {
    await a.repo.sync.ready();
    await a.repo.purchases.confirmSandbox({ purchaseId: 't106-sample', eventId: event.id });
    expect((await a.repo.carnet.mine())?.stamps).toHaveLength(1);
    await a.repo.sync.saveSnapshot();
    await a.repo.sync.refresh();
    expect((await a.repo.carnet.mine())?.stamps).toHaveLength(1);
    const b = device(fake);
    try {
      await b.repo.sync.ready();
      expect((await b.repo.carnet.mine())?.stamps).toHaveLength(1);
    } finally {
      b.repo.sync.dispose();
    }
    expect(fake.ledger.some((entry) => entry.kind === 'stamp')).toBe(false);
  } finally {
    a.repo.sync.dispose();
  }
});

it('T106: concurrent device snapshot changes retain both completed achievements', async () => {
  const fake = withCarnet(new FakeSupabase(UID));
  const a = device(fake);
  const b = device(fake);
  try {
    await Promise.all([a.repo.sync.ready(), b.repo.sync.ready()]);
    await a.repo.progress.completeAchievement('carnet');
    await b.repo.progress.completeAchievement('whatsapp');
    await a.repo.sync.saveSnapshot();
    await b.repo.sync.saveSnapshot();
    await b.repo.sync.saveSnapshot();
    const fresh = device(fake);
    try {
      await fresh.repo.sync.ready();
      const achievements = await fresh.repo.progress.achievements();
      expect(achievements.find((x) => x.definition.id === 'carnet')?.state).toBe('ready');
      expect(achievements.find((x) => x.definition.id === 'whatsapp')?.state).toBe('ready');
    } finally {
      fresh.repo.sync.dispose();
    }
    expect(fake.balances()).toEqual({ points: 0, coins: 0 });
  } finally {
    a.repo.sync.dispose();
    b.repo.sync.dispose();
  }
});

it('T106: offline snapshot and early closing retain sample/achievement progress until retry', async () => {
  const fake = withCarnet(new FakeSupabase(UID));
  const a = device(fake);
  const event = SAMPLE_EVENTS.find((e) => e.state === 'on_sale')!;
  await a.repo.sync.ready();
  fake.offline = true;
  await a.repo.purchases.confirmSandbox({ purchaseId: 't106-offline', eventId: event.id });
  await a.repo.progress.completeAchievement('naufrago-fiesta');
  await a.repo.sync.saveSnapshot();
  expect(a.repo.sync.snapshotPending()).toBe(true);
  a.repo.sync.dispose();
  fake.offline = false;
  const again = a.reopen();
  try {
    await again.sync.ready();
    await again.sync.flush();
    expect(again.sync.snapshotPending()).toBe(false);
    const fresh = device(fake);
    try {
      await fresh.repo.sync.ready();
      expect((await fresh.repo.carnet.mine())?.stamps).toContainEqual(
        expect.objectContaining({ purchaseId: 't106-offline', isSample: true }),
      );
      expect(
        (await fresh.repo.progress.achievements()).find(
          (x) => x.definition.id === 'naufrago-fiesta',
        )?.state,
      ).toBe('ready');
      expect(fake.balances()).toEqual({ points: 0, coins: 0 });
    } finally {
      fresh.repo.sync.dispose();
    }
  } finally {
    again.sync.dispose();
  }
});

it('T106: failed snapshot stays pending and an edit during acknowledgement is sent afterwards', async () => {
  const fake = withCarnet(new FakeSupabase(UID));
  const a = device(fake);
  try {
    await a.repo.sync.ready();
    await a.repo.progress.setPref('theme', 'night');
    fake.failNext('save_snapshot', 'invalid_snapshot');
    await a.repo.sync.saveSnapshot();
    expect(a.repo.sync.snapshotPending()).toBe(true);
    await a.repo.sync.saveSnapshot();
    expect(a.repo.sync.snapshotPending()).toBe(false);
    const server = supabaseMemberServer(fake, UID);
    const rpc = server.rpc;
    let entered!: () => void;
    let finish!: () => void;
    const started = new Promise<void>((r) => {
      entered = r;
    });
    const blocked = new Promise<void>((r) => {
      finish = r;
    });
    server.rpc = async (fn, args) => {
      if (fn === 'save_snapshot') {
        entered();
        await blocked;
      }
      return rpc(fn, args);
    };
    const store = new MemoryStorage();
    const member = createMemberRepository({
      userId: UID,
      cache: createLocalRepository({ storage: store, key: 'ack-cache', watch: false }),
      storage: store,
      server,
      snapshotDelayMs: 60_000,
    });
    try {
      await member.sync.ready();
      await member.progress.discover('isla:first');
      const saving = member.sync.saveSnapshot();
      await started;
      await member.progress.discover('isla:while-saving');
      finish();
      await saving;
      expect(member.sync.snapshotPending()).toBe(true);
      await member.sync.saveSnapshot();
      expect(member.sync.snapshotPending()).toBe(false);
      const fresh = device(fake);
      try {
        await fresh.repo.sync.ready();
        expect((await fresh.repo.progress.discoveries()).map((d) => d.key)).toEqual(
          expect.arrayContaining(['isla:first', 'isla:while-saving']),
        );
      } finally {
        fresh.repo.sync.dispose();
      }
    } finally {
      member.sync.dispose();
    }
  } finally {
    a.repo.sync.dispose();
  }
});

it('T106: refreshing/resetting the account copy never propagates empty-cache deletions to the server', async () => {
  const fake = withCarnet(new FakeSupabase(UID));
  const a = device(fake);
  try {
    await a.repo.sync.ready();
    await a.repo.progress.setPref('theme', 'night');
    const event = SAMPLE_EVENTS.find((e) => e.state === 'on_sale')!;
    await a.repo.purchases.confirmSandbox({ purchaseId: 't106-reset', eventId: event.id });
    await a.repo.sync.flush();
    await a.repo.identity.reset();
    await a.repo.sync.flush();
    const fresh = device(fake);
    try {
      await fresh.repo.sync.ready();
      expect(await fresh.repo.progress.pref('theme')).toBe('night');
      expect((await fresh.repo.carnet.mine())?.stamps).toHaveLength(1);
    } finally {
      fresh.repo.sync.dispose();
    }
  } finally {
    a.repo.sync.dispose();
  }
});

for (const delayed of ['save_snapshot', 'award_points']) {
  it(`T106: a disposed ${delayed} acknowledgement cannot overwrite the reopened account queue`, async () => {
    const fake = withCarnet(new FakeSupabase(UID));
    const storage = new MemoryStorage();
    const server = supabaseMemberServer(fake, UID);
    const rpc = server.rpc;
    let entered!: () => void;
    let release!: () => void;
    const started = new Promise<void>((r) => {
      entered = r;
    });
    const blocked = new Promise<void>((r) => {
      release = r;
    });
    server.rpc = async (fn, args) => {
      const result = await rpc(fn, args);
      if (fn === delayed) {
        entered();
        await blocked;
      }
      return result;
    };
    const old = createMemberRepository({
      userId: UID,
      cache: createLocalRepository({ storage, key: `boia.cuenta.${UID}`, watch: false }),
      server,
      storage,
      snapshotDelayMs: 60_000,
    });
    await old.sync.ready();
    let sending: Promise<unknown>;
    if (delayed === 'save_snapshot') {
      await old.progress.setPref('old', true);
      sending = old.sync.saveSnapshot();
    } else sending = old.progress.grantWorldReward({ sourceRef: 'lugar:cala:points', points: 20 });
    await started;
    old.sync.dispose();
    const again = device(fake, storage);
    try {
      await again.repo.sync.ready();
      fake.offline = true;
      await again.repo.progress.grantWorldReward({ sourceRef: 'lugar:faro:points', points: 25 });
      await again.repo.progress.setPref('new', true);
      const key = memberSyncKey(`boia.cuenta.${UID}`);
      const latest = storage.getItem(key);
      release();
      await sending;
      expect(storage.getItem(key)).toBe(latest);
      expect(again.repo.sync.pending()).toBe(1);
      fake.offline = false;
      await again.repo.sync.flush();
      expect(fake.balances().points).toBe(delayed === 'award_points' ? 45 : 25);
      expect(await again.repo.progress.pref('new')).toBe(true);
    } finally {
      release();
      again.repo.sync.dispose();
    }
  });
}

it('T106: guest sample purchase survives account snapshot continuation as a sample, never QR attendance', async () => {
  const guest = createLocalRepository({ storage: new MemoryStorage(), watch: false });
  const event = SAMPLE_EVENTS.find((e) => e.state === 'on_sale')!;
  await guest.purchases.confirmSandbox({ purchaseId: 't106-guest', eventId: event.id });
  const identity = (await guest.identity.current())!;
  const snapshot = localDocAccess(guest)!.view((doc) => snapshotOf(doc, identity.id));
  const fake = withCarnet(new FakeSupabase(UID));
  const a = device(fake);
  try {
    await a.repo.sync.ready();
    localDocAccess(a.cache)!.write(['purchases', 'progress'], (doc) =>
      applySnapshot(doc, UID, snapshot),
    );
    await a.repo.sync.flush();
    const fresh = device(fake);
    try {
      await fresh.repo.sync.ready();
      expect((await fresh.repo.carnet.mine())?.stamps).toContainEqual(
        expect.objectContaining({ purchaseId: 't106-guest', isSample: true }),
      );
    } finally {
      fresh.repo.sync.dispose();
    }
    expect(fake.ledger.some((row) => row.kind === 'stamp')).toBe(false);
    expect(fake.balances()).toEqual({ points: 0, coins: 0 });
  } finally {
    a.repo.sync.dispose();
  }
});

// ---------------------------------------------------------------------------
// T106: lo ganado vuelve igual tras cerrar sesión y volver con una copia nueva

const OTHER = '99999999-8888-7777-6666-555555555555';
const onSale = () => SAMPLE_EVENTS.find((e) => e.state === 'on_sale')!;

/** Sello de prueba, premio del Carnet y progreso del náufrago en una cuenta. */
async function earnAll(repo: MemberRepository, purchaseId: string) {
  await repo.purchases.confirmSandbox({ purchaseId, eventId: onSale().id });
  await repo.progress.completeAchievement('carnet');
  await repo.progress.claimAchievement('carnet');
  await repo.progress.findDiscount('dto-naufrago');
  await repo.progress.discover('personaje:rescatado:naufrago');
  await repo.progress.completeAchievement('naufrago-fiesta');
}

async function expectEarned(repo: MemberRepository, purchaseId: string) {
  expect((await repo.carnet.mine())?.stamps).toEqual([
    expect.objectContaining({ eventId: onSale().id, purchaseId, isSample: true }),
  ]);
  const state = async (id: string) =>
    (await repo.progress.achievements()).find((a) => a.definition.id === id)?.state;
  expect(await state('carnet')).toBe('claimed');
  expect(await state('naufrago-fiesta')).toBe('ready');
  expect((await repo.progress.discounts()).map((d) => d.discount.id)).toContain('dto-naufrago');
  expect((await repo.progress.discoveries()).map((d) => d.key)).toContain(
    'personaje:rescatado:naufrago',
  );
}

it('T106: sello de prueba, premio del Carnet y náufrago siguen al volver con una copia nueva, sin repetir premios', async () => {
  const fake = withCarnet(new FakeSupabase(UID));
  const a = device(fake);
  await a.repo.sync.ready();
  await earnAll(a.repo, 't106-ciclo');
  await a.repo.sync.flush();
  expect(a.repo.sync.pending()).toBe(0);
  expect(a.repo.sync.snapshotPending()).toBe(false);
  const paid = fake.balances();
  expect(paid.points).toBeGreaterThan(0);
  a.repo.sync.dispose();

  // Cerrar sesión borra la copia reconocida: cada vuelta empieza con una copia nueva.
  for (let visit = 0; visit < 2; visit++) {
    const back = device(fake);
    try {
      await back.repo.sync.ready();
      await expectEarned(back.repo, 't106-ciclo');
      // Volver a leer y mandar no concede nada otra vez.
      await back.repo.sync.refresh();
      await back.repo.sync.flush();
      await expectEarned(back.repo, 't106-ciclo');
    } finally {
      back.repo.sync.dispose();
    }
  }
  expect(fake.balances()).toEqual(paid);
  expect(fake.ledger.filter((r) => r.source_ref === 'carnet')).toHaveLength(1);
  expect(fake.ledger.some((r) => r.kind === 'stamp')).toBe(false);
});

it('T106: una copia vacía con la cola guardada no borra en el servidor lo que ya estaba', async () => {
  const fake = withCarnet(new FakeSupabase(UID));
  const storage = new MemoryStorage();
  const a = device(fake, storage);
  await a.repo.sync.ready();
  await a.repo.progress.setPref('theme', 'night');
  await a.repo.purchases.confirmSandbox({ purchaseId: 't106-cola', eventId: onSale().id });
  await a.repo.sync.flush();
  // Sin red queda algo en la cola; se borra la copia y se queda la cola (lo que hacía antes el cierre de sesión).
  fake.offline = true;
  await a.repo.progress.grantWorldReward({ sourceRef: 'lugar:faro:points', points: 25 });
  a.repo.sync.dispose();
  storage.removeItem(`boia.cuenta.${UID}`);
  fake.offline = false;
  const back = device(fake, storage);
  try {
    // Antes de leer del servidor, la copia ya parte de lo reconocido.
    expect(await back.cache.progress.pref('theme')).toBe('night');
    await back.repo.sync.ready();
    await back.repo.sync.flush();
    expect(await back.repo.progress.pref('theme')).toBe('night');
    expect((await back.repo.carnet.mine())?.stamps).toHaveLength(1);
    expect(fake.balances().points).toBe(25);
    const saved = fake.snapshot?.data as { player: { prefs: Record<string, unknown> } };
    expect(saved.player.prefs.theme).toBe('night');
  } finally {
    back.repo.sync.dispose();
  }
});

it('T106: un campo que falta en la copia del servidor no borra lo de esta copia sin mandar', async () => {
  const fake = withCarnet(new FakeSupabase(UID));
  const a = device(fake);
  try {
    await a.repo.sync.ready();
    await a.repo.progress.completeAchievement('whatsapp');
    await a.repo.progress.discover('isla:norte');
    // Otro cliente guardó una copia sin logros ni descubrimientos.
    fake.snapshot = { data: { format: 1, player: { prefs: { theme: 'day' } } }, version: 5 };
    await a.repo.sync.refresh();
    const ach = await a.repo.progress.achievements();
    expect(ach.find((x) => x.definition.id === 'whatsapp')?.state).toBe('ready');
    expect((await a.repo.progress.discoveries()).map((d) => d.key)).toContain('isla:norte');
    expect(await a.repo.progress.pref('theme')).toBe('day');
    await a.repo.sync.flush();
    const saved = fake.snapshot.data as { player: { achievements: Record<string, unknown> } };
    expect(Object.keys(saved.player.achievements)).toContain('whatsapp');
  } finally {
    a.repo.sync.dispose();
  }
});

it('T106: las cuentas A y B de un mismo navegador no se mezclan', async () => {
  const storage = new MemoryStorage();
  const fa = withCarnet(new FakeSupabase(UID), 'Ana');
  const fb = withCarnet(new FakeSupabase(OTHER), 'Bea');
  const a = device(fa, storage);
  await a.repo.sync.ready();
  await earnAll(a.repo, 't106-ana');
  await a.repo.sync.flush();
  a.repo.sync.dispose();
  const b = device(fb, storage);
  try {
    await b.repo.sync.ready();
    expect((await b.repo.carnet.mine())?.nickname).toBe('Bea');
    expect((await b.repo.carnet.mine())?.stamps).toEqual([]);
    const ach = await b.repo.progress.achievements();
    expect(ach.find((x) => x.definition.id === 'carnet')?.state).toBe('in_progress');
    expect(ach.find((x) => x.definition.id === 'naufrago-fiesta')?.state).toBe('in_progress');
    expect(await b.repo.progress.discounts()).toEqual([]);
    await b.repo.sync.flush();
    expect(fb.balances()).toEqual({ points: 0, coins: 0 });
    expect((fb.snapshot?.data as { purchases?: unknown[] } | undefined)?.purchases ?? []).toEqual(
      [],
    );
  } finally {
    b.repo.sync.dispose();
  }
  const again = device(fa, storage);
  try {
    await again.repo.sync.ready();
    await expectEarned(again.repo, 't106-ana');
  } finally {
    again.repo.sync.dispose();
  }
});

it('T106: lo del invitado que pasa a una cuenta nueva (merge_guest) sigue como muestra al volver', async () => {
  const guest = createLocalRepository({ storage: new MemoryStorage(), watch: false });
  await guest.purchases.confirmSandbox({ purchaseId: 't106-invitado', eventId: onSale().id });
  await guest.progress.discover('personaje:rescatado:naufrago');
  const me = (await guest.identity.current())!;
  const fake = withCarnet(new FakeSupabase(UID));
  // merge_guest guarda la copia del invitado si la cuenta aún no tenía (save_snapshot, base 0).
  const data = localDocAccess(guest)!.view((d) => snapshotOf(d, me.id));
  fake.snapshot = { data: structuredClone(data) as unknown as Record<string, unknown>, version: 1 };
  for (let visit = 0; visit < 2; visit++) {
    const a = device(fake);
    try {
      await a.repo.sync.ready();
      await a.repo.sync.flush();
      expect((await a.repo.carnet.mine())?.stamps).toEqual([
        expect.objectContaining({ purchaseId: 't106-invitado', isSample: true }),
      ]);
      expect((await a.repo.progress.discoveries()).map((d) => d.key)).toContain(
        'personaje:rescatado:naufrago',
      );
    } finally {
      a.repo.sync.dispose();
    }
  }
  expect(fake.ledger.some((row) => row.kind === 'stamp')).toBe(false);
});

it('T106: el sello del QR manda sobre el de la compra de prueba de la misma fiesta', async () => {
  const fake = withCarnet(new FakeSupabase(UID));
  const event = onSale();
  const a = device(fake);
  try {
    await a.repo.sync.ready();
    await a.repo.purchases.confirmSandbox({ purchaseId: 't106-qr', eventId: event.id });
    await a.repo.sync.flush();
    fake.addRow({ kind: 'stamp', action: 'stamp', source_ref: `qr:${event.id}` });
    await a.repo.sync.refresh();
    expect((await a.repo.carnet.mine())?.stamps).toEqual([
      expect.objectContaining({ eventId: event.id, purchaseId: `qr:${event.id}`, isSample: false }),
    ]);
  } finally {
    a.repo.sync.dispose();
  }
});
