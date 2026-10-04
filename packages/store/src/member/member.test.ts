import { describe, expect, it } from 'vitest';
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
    cache = createLocalRepository({ storage, key: `boia.cuenta.${UID}`, watch: false });
    return createMemberRepository({
      userId: UID,
      cache,
      server: supabaseMemberServer(fake, UID),
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
    user_id: UID,
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
    await a.repo.progress.buyCosmetic('bandera-boia');
    await a.repo.progress.equip('flag', 'bandera-boia');
    expect(await a.repo.progress.equipped()).toEqual({ flag: 'bandera-boia' });
    // En otro dispositivo se quita la bandera y el Admin anula la compra.
    fake.equipped = {};
    const buy = fake.ledger.find((r) => r.kind === 'cosmetic')!;
    fake.addRow({
      kind: 'compensation',
      compensates_id: buy.id,
      coins_delta: 20,
      reason: 'duplicada',
    });
    await a.repo.sync.refresh();
    expect(await a.repo.progress.equipped()).toEqual({});
    expect(await a.repo.progress.balances()).toMatchObject({ coins: 50 });
    expect((await a.repo.progress.cosmetics()).map((c) => c.id)).toEqual([]);
  });

  it('dos dispositivos guardan la copia: el segundo choca y se queda con la del servidor', async () => {
    const fake = withCarnet(new FakeSupabase(UID));
    const a = device(fake);
    const b = device(fake);
    await Promise.all([a.repo.sync.ready(), b.repo.sync.ready()]);
    await a.repo.progress.discover('isla:norte');
    await a.repo.sync.saveSnapshot();
    await b.repo.progress.discover('isla:sur');
    await b.repo.sync.saveSnapshot();
    expect(fake.snapshot?.version).toBe(1);
    expect((await b.repo.progress.discoveries()).map((d) => d.key)).toEqual(['isla:norte']);
    // Y desde ahí sigue guardando sobre la versión del servidor.
    await b.repo.progress.discover('isla:este');
    await b.repo.sync.saveSnapshot();
    expect(fake.snapshot?.version).toBe(2);
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
