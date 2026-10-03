import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CHECK_VIOLATION,
  PERMISSION_DENIED,
  UNIQUE_VIOLATION,
  USERS,
  anon,
  as,
  attempt,
  guest,
  member,
  openTestDatabase,
  service,
  staff,
  staffSetup,
  type Identity,
  type TestDatabase,
} from './testing.ts';

// Ids de la muestra (supabase/seeds) y de los fixtures (packages/db/sql/fixtures).
const EVENT_ON_SALE = 'a2000000-0000-4000-8000-000000000001';
const EVENT_DRAFT = 'a2000000-0000-4000-8000-000000000004';
const ACH_FIRST_BUOY = 'a7000000-0000-4000-8000-000000000001';
const ACH_ISLAND = 'a7000000-0000-4000-8000-000000000002';
const PURCHASE = 'f1000000-0000-4000-8000-000000000001';
const STAMP_TX = 'f2000000-0000-4000-8000-000000000003';
const BOTTLE = 'f3000000-0000-4000-8000-000000000001';
const WORLD_REVISION = 'a4000000-0000-4000-8000-000000000001';

let db: TestDatabase;

beforeAll(async () => {
  db = await openTestDatabase();
}, 60_000);

afterAll(async () => {
  await db?.close();
}, 60_000);

const clients: Array<[string, Identity]> = [
  ['anon', anon],
  ['miembro', member()],
];

describe('ningún cliente escribe libro, sellos, roles, saldos ni estados', () => {
  for (const [label, id] of clients) {
    it(`${label}: no inserta en el libro de transacciones`, async () => {
      const r = await as(db.client, id, (q) =>
        attempt(
          q,
          `insert into public.ledger_transactions (id, user_id, kind, points_delta, source_ref)
           values ($1, $2, 'world_reward', 1000, 'trampa')`,
          [randomUUID(), USERS.member],
        ),
      );
      expect(r.code).toBe(PERMISSION_DENIED);
    });

    it(`${label}: no inserta sellos`, async () => {
      const r = await as(db.client, id, (q) =>
        attempt(
          q,
          `insert into public.stamps (tx_id, user_id, event_id, purchase_id)
           values ($1, $2, $3, $4)`,
          [STAMP_TX, USERS.member, EVENT_ON_SALE, PURCHASE],
        ),
      );
      expect(r.code).toBe(PERMISSION_DENIED);
    });

    it(`${label}: no se da un rol del Admin`, async () => {
      const r = await as(db.client, id, (q) =>
        attempt(q, `insert into public.staff_roles (user_id, role) values ($1, 'owner')`, [
          USERS.member,
        ]),
      );
      expect(r.code).toBe(PERMISSION_DENIED);
    });

    it(`${label}: no cambia el estado de un evento`, async () => {
      const r = await as(db.client, id, (q) =>
        attempt(q, `update public.events set state = 'sold_out' where id = $1`, [EVENT_ON_SALE]),
      );
      expect(r.code).toBe(PERMISSION_DENIED);
    });

    it(`${label}: no crea eventos con estado`, async () => {
      const r = await as(db.client, id, (q) =>
        attempt(
          q,
          `insert into public.events (slug, title, state, published_at)
           values ('trampa', 'Trampa', 'on_sale', now())`,
        ),
      );
      expect(r.code).toBe(PERMISSION_DENIED);
    });

    it(`${label}: no toca saldos`, async () => {
      const results = await as(db.client, id, async (q) => [
        await attempt(q, `insert into public.point_balances (user_id, points) values ($1, 9999)`, [
          USERS.member2,
        ]),
        await attempt(q, `update public.point_balances set points = 9999`),
        await attempt(q, `update public.coin_balances set coins = 9999`),
        await attempt(
          q,
          `insert into public.season_points (season_id, user_id, points)
                          select id, $1, 9999 from public.seasons`,
          [USERS.member2],
        ),
      ]);
      expect(results.map((r) => r.code)).toEqual(results.map(() => PERMISSION_DENIED));
    });

    it(`${label}: no cambia el estado de una compra`, async () => {
      const results = await as(db.client, id, async (q) => [
        await attempt(q, `update public.purchases set status = 'confirmed'`),
        await attempt(
          q,
          `insert into public.purchases (user_id, event_id, provider, status, confirmed_at)
           values ($1, $2, 'sandbox', 'confirmed', now())`,
          [USERS.member, EVENT_ON_SALE],
        ),
      ]);
      expect(results.map((r) => r.code)).toEqual([PERMISSION_DENIED, PERMISSION_DENIED]);
    });
  }

  it('un editor con TOTP edita el contenido de un evento, pero no su estado', async () => {
    const editor = randomUUID();
    const [title, state] = await as(
      db.client,
      staff(editor),
      async (q) => [
        await attempt(q, `update public.events set title = 'Nuevo título' where id = $1`, [
          EVENT_ON_SALE,
        ]),
        await attempt(q, `update public.events set state = 'finished' where id = $1`, [
          EVENT_ON_SALE,
        ]),
      ],
      staffSetup(editor, 'editor'),
    );
    expect(title).toEqual({ code: null, rowCount: 1 });
    expect(state.code).toBe(PERMISSION_DENIED);
  });

  it('sin segundo factor (aal1) el rol del Admin no da permisos', async () => {
    const editor = randomUUID();
    const readDraft = (aal: 'aal1' | 'aal2') =>
      as(
        db.client,
        staff(editor, aal),
        (q) => q.query(`select id from public.events where id = $1`, [EVENT_DRAFT]),
        staffSetup(editor, 'editor'),
      );
    const aal1 = await readDraft('aal1');
    const aal2 = await readDraft('aal2');
    expect(aal1.rowCount).toBe(0);
    expect(aal2.rowCount).toBe(1);
  });

  it('no se puede quitar el último propietario', async () => {
    const r = await as(db.client, service, (q) =>
      attempt(q, `update public.staff_roles set role = 'admin' where user_id = $1`, [USERS.owner]),
    );
    expect(r.code).toBe(CHECK_VIOLATION);
  });
});

describe('libro de transacciones idempotente', () => {
  it('rechaza una segunda transacción con el mismo id y concede una sola vez', async () => {
    const txId = randomUUID();
    const insert = `insert into public.ledger_transactions (id, user_id, kind, points_delta, coins_delta, source_ref)
                    values ($1, $2, 'world_reward', 7, 2, 'muestra-roca-1')`;
    const { first, second, points } = await as(db.client, service, async (q) => {
      const before = await q.query<{ points: number }>(
        `select points from public.point_balances where user_id = $1`,
        [USERS.member],
      );
      const first = await attempt(q, insert, [txId, USERS.member]);
      const second = await attempt(q, insert, [txId, USERS.member]);
      const after = await q.query<{ points: number }>(
        `select points from public.point_balances where user_id = $1`,
        [USERS.member],
      );
      return { first, second, points: after.rows[0]!.points - before.rows[0]!.points };
    });
    expect(first.code).toBeNull();
    expect(second.code).toBe(UNIQUE_VIOLATION);
    expect(points).toBe(7);
  });

  it('los saldos son la suma del libro', async () => {
    const rows = await as(db.client, service, async (q) => {
      const r = await q.query<{ ok: boolean }>(`
        select coalesce(pb.points, 0) = l.points and coalesce(cb.coins, 0) = l.coins as ok
        from (
          select user_id, sum(points_delta)::int as points, sum(coins_delta)::int as coins
          from public.ledger_transactions group by user_id
        ) l
        left join public.point_balances pb using (user_id)
        left join public.coin_balances cb using (user_id)`);
      return r.rows;
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.ok)).toBe(true);
  });

  it('nadie modifica ni borra el libro, tampoco service_role', async () => {
    const results = await as(db.client, service, async (q) => [
      await attempt(q, `update public.ledger_transactions set points_delta = 1000`),
      await attempt(q, `delete from public.ledger_transactions`),
      await attempt(q, `update public.audit_log set reason = 'x'`),
    ]);
    expect(results.map((r) => r.code)).toEqual(results.map(() => PERMISSION_DENIED));
  });

  it('un logro se concede una vez por cuenta aunque cambie el id', async () => {
    const r = await as(db.client, service, (q) =>
      attempt(
        q,
        `insert into public.ledger_transactions (id, user_id, kind, achievement_id) values ($1, $2, 'achievement', $3)`,
        [randomUUID(), USERS.member, ACH_FIRST_BUOY],
      ),
    );
    expect(r.code).toBe(UNIQUE_VIOLATION);
  });

  it('la recompensa de un logro la fija su definición, no quien concede', async () => {
    const txId = randomUUID();
    const [tx, ach] = await as(db.client, service, async (q) => {
      await q.query(
        `insert into public.ledger_transactions (id, user_id, kind, achievement_id, points_delta)
         values ($1, $2, 'achievement', $3, 100000)`,
        [txId, USERS.member2, ACH_ISLAND],
      );
      const tx = await q.query(
        `select points_delta, coins_delta from public.ledger_transactions where id = $1`,
        [txId],
      );
      const ach = await q.query(
        `select points as points_delta, coins as coins_delta from public.achievements where id = $1`,
        [ACH_ISLAND],
      );
      return [tx.rows[0], ach.rows[0]];
    });
    expect(tx).toEqual(ach);
  });

  it('gastar más monedas de las que hay falla y no toca los puntos', async () => {
    const r = await as(db.client, service, (q) =>
      attempt(
        q,
        `insert into public.ledger_transactions (id, user_id, kind, coins_delta, cosmetic_key)
         values ($1, $2, 'cosmetic', -1000000, 'bandera-muestra')`,
        [randomUUID(), USERS.member],
      ),
    );
    expect(r.code).toBe(CHECK_VIOLATION);
  });

  it('una compensación retira el sello y sólo se compensa una vez', async () => {
    const insert = `insert into public.ledger_transactions (id, user_id, kind, compensates_id, reason)
                    values ($1, $2, 'compensation', $3, 'devolución')`;
    const { first, second, revoked } = await as(db.client, service, async (q) => {
      const first = await attempt(q, insert, [randomUUID(), USERS.member, STAMP_TX]);
      const second = await attempt(q, insert, [randomUUID(), USERS.member, STAMP_TX]);
      const s = await q.query<{ revoked: boolean }>(
        `select revoked_at is not null as revoked from public.stamps where tx_id = $1`,
        [STAMP_TX],
      );
      return { first, second, revoked: s.rows[0]!.revoked };
    });
    expect(first.code).toBeNull();
    expect(second.code).toBe(UNIQUE_VIOLATION);
    expect(revoked).toBe(true);
  });

  it('un sello por evento y cuenta aunque cambie el id', async () => {
    const r = await as(db.client, service, (q) =>
      attempt(
        q,
        `insert into public.ledger_transactions (id, user_id, kind, event_id, purchase_id)
         values ($1, $2, 'stamp', $3, $4)`,
        [randomUUID(), USERS.member, EVENT_ON_SALE, PURCHASE],
      ),
    );
    expect(r.code).toBe(UNIQUE_VIOLATION);
  });

  it('un sello exige una compra confirmada de esa cuenta', async () => {
    const r = await as(db.client, service, (q) =>
      attempt(
        q,
        `insert into public.ledger_transactions (id, user_id, kind, event_id, purchase_id)
         values ($1, $2, 'stamp', $3, $4)`,
        [randomUUID(), USERS.member2, EVENT_ON_SALE, PURCHASE],
      ),
    );
    expect(r.code).toBe(CHECK_VIOLATION);
  });

  it('un logro inactivo no se concede', async () => {
    const r = await as(db.client, service, async (q) => {
      await q.query(`update public.achievements set is_active = false where id = $1`, [ACH_ISLAND]);
      return attempt(
        q,
        `insert into public.ledger_transactions (id, user_id, kind, achievement_id) values ($1, $2, 'achievement', $3)`,
        [randomUUID(), USERS.member2, ACH_ISLAND],
      );
    });
    expect(r.code).toBe(CHECK_VIOLATION);
  });

  it('la condición de un logro ya concedido no cambia; el título sí', async () => {
    const [condition, title] = await as(db.client, service, async (q) => [
      await attempt(
        q,
        `update public.achievements set trigger_params = '{"count": 2}' where id = $1`,
        [ACH_FIRST_BUOY],
      ),
      await attempt(q, `update public.achievements set title = 'Otro título' where id = $1`, [
        ACH_FIRST_BUOY,
      ]),
    ]);
    expect(condition.code).toBe(CHECK_VIOLATION);
    expect(title.code).toBeNull();
  });
});

describe('lecturas', () => {
  it('las monedas son privadas; los puntos, públicos', async () => {
    const coinsOf = (id: Identity) =>
      as(db.client, id, (q) =>
        attempt(q, `select * from public.coin_balances where user_id = $1`, [USERS.member]),
      );
    const anonCoins = await coinsOf(anon);
    const ownCoins = await coinsOf(member());
    const otherCoins = await coinsOf(member(USERS.member2));
    const anonPoints = await as(db.client, anon, (q) =>
      attempt(q, `select * from public.point_balances`),
    );
    expect(anonCoins.code).toBe(PERMISSION_DENIED);
    expect(ownCoins).toEqual({ code: null, rowCount: 1 });
    expect(otherCoins).toEqual({ code: null, rowCount: 0 });
    expect(anonPoints.rowCount).toBeGreaterThan(0);
  });

  it('el público ve eventos publicados, nunca borradores ni la secret location', async () => {
    const { visible, secrets } = await as(db.client, anon, async (q) => {
      const visible = await q.query<{ id: string }>(`select id from public.events order by id`);
      const secrets = await attempt(q, `select * from public.event_secrets`);
      return { visible: visible.rows.map((r) => r.id), secrets };
    });
    const all = await db.client.query<{ id: string }>(
      `select id from public.events where published_at is not null and state <> 'draft'
       and archived_at is null order by id`,
    );
    expect(visible).toEqual(all.rows.map((r) => r.id));
    expect(visible).not.toContain(EVENT_DRAFT);
    expect(secrets.code).toBe(PERMISSION_DENIED);
  });

  it('el público lee sólo la revisión activa del mundo', async () => {
    const r = await as(db.client, anon, (q) =>
      q.query<{ id: string }>(`select id from public.world_revisions`),
    );
    expect(r.rows.map((x) => x.id)).toEqual([WORLD_REVISION]);
  });

  it('una revisión publicada es inmutable, también para service_role', async () => {
    const r = await as(db.client, service, (q) =>
      attempt(q, `update public.world_revisions set note = 'cambio' where id = $1`, [
        WORLD_REVISION,
      ]),
    );
    expect(r.code).toBe(PERMISSION_DENIED);
  });
});

describe('Carnet y botellas', () => {
  // Plan 008 (T86): el Carnet sólo se escribe con save_profile, que filtra
  // el apodo y exige la política aceptada.
  it('un miembro crea su Carnet con save_profile, pero no lo escribe directamente', async () => {
    const other = randomUUID();
    const setup = `insert into auth.users (id, email) values ('${other}', 'x@example.test');`;
    const results = await as(
      db.client,
      member(other),
      async (q) => [
        await attempt(q, `select public.save_profile('Nueva', null, null, 'muestra-1', false)`),
        await attempt(q, `insert into public.carnets (user_id, nickname) values ($1, 'Directa')`, [
          other,
        ]),
        await attempt(q, `insert into public.carnets (user_id, nickname) values ($1, 'Suplanta')`, [
          USERS.member2,
        ]),
        await attempt(
          q,
          `update public.carnets set member_since = '2020-01-01' where user_id = $1`,
          [other],
        ),
      ],
      setup,
    );
    expect(results.map((r) => r.code)).toEqual([
      null,
      PERMISSION_DENIED,
      PERMISSION_DENIED,
      PERMISSION_DENIED,
    ]);
  });

  it('el invitado anónimo no crea Carnet ni botella', async () => {
    const results = await as(db.client, guest, async (q) => [
      await attempt(q, `insert into public.carnets (user_id, nickname) values ($1, 'Invitado')`, [
        USERS.guest,
      ]),
      await attempt(
        q,
        `insert into public.bottles (user_id, message, x, y) values ($1, 'hola', 0, 0)`,
        [USERS.guest],
      ),
    ]);
    expect(results.map((r) => r.code)).toEqual([PERMISSION_DENIED, PERMISSION_DENIED]);
  });

  it('una botella activa por cuenta y 140 caracteres como máximo', async () => {
    const second = await as(db.client, service, async (q) => {
      await q.query(
        `insert into public.bottles (user_id, message, x, y) values ($1, 'primera', 0, 0)`,
        [USERS.member2],
      );
      return attempt(
        q,
        `insert into public.bottles (user_id, message, x, y) values ($1, 'segunda', 0, 0)`,
        [USERS.member2],
      );
    });
    expect(second.code).toBe(UNIQUE_VIOLATION);
    const tooLong = await as(
      db.client,
      member(USERS.member2),
      (q) =>
        attempt(q, `update public.bottles set message = $2 where user_id = $1`, [
          USERS.member2,
          'x'.repeat(141),
        ]),
      `insert into public.bottles (user_id, message, x, y) values ('${USERS.member2}', 'primera', 0, 0);`,
    );
    expect(tooLong.code).toBe(CHECK_VIOLATION);
  });

  it('sólo place_bottle fija la posición: el autor no inserta ni mueve x/y a mano (T94)', async () => {
    const results = await as(
      db.client,
      member(USERS.member2),
      async (q) => [
        await attempt(
          q,
          `insert into public.bottles (user_id, message, x, y) values ($1, 'directa', 0, 0)`,
          [USERS.member2],
        ),
        await attempt(q, `update public.bottles set x = 5, y = 5 where user_id = $1`, [
          USERS.member2,
        ]),
        await attempt(q, `update public.bottles set message = 'otra' where user_id = $1`, [
          USERS.member2,
        ]),
      ],
      `insert into public.bottles (user_id, message, x, y) values ('${USERS.member2}', 'primera', 0, 0);`,
    );
    expect(results.map((r) => r.code)).toEqual([PERMISSION_DENIED, PERMISSION_DENIED, null]);
  });

  it('el autor no deshace una retirada por moderación', async () => {
    const admin = randomUUID();
    const removed = await as(
      db.client,
      staff(admin),
      (q) => attempt(q, `update public.bottles set status = 'removed' where id = $1`, [BOTTLE]),
      staffSetup(admin, 'admin'),
    );
    expect(removed).toEqual({ code: null, rowCount: 1 });

    const restored = await as(
      db.client,
      member(),
      (q) => attempt(q, `update public.bottles set status = 'active' where id = $1`, [BOTTLE]),
      `update public.bottles set status = 'removed' where id = '${BOTTLE}';`,
    );
    expect(restored).toEqual({ code: null, rowCount: 0 });
  });
});

describe('auditoría', () => {
  it('un cambio de estado registra autor, motivo y valores anterior y nuevo', async () => {
    const row = await as(db.client, service, async (q) => {
      await q.query(`select set_config('boia.audit_reason', 'agotado en taquilla', true)`);
      await q.query(`update public.events set state = 'sold_out' where id = $1`, [EVENT_ON_SALE]);
      const r = await q.query<{
        actor_role: string;
        reason: string;
        old_state: string;
        new_state: string;
      }>(
        `select actor_role, reason, old_value ->> 'state' as old_state, new_value ->> 'state' as new_state
         from public.audit_log where entity_type = 'events' and entity_id = $1
         order by id desc limit 1`,
        [EVENT_ON_SALE],
      );
      return r.rows[0];
    });
    expect(row).toEqual({
      actor_role: 'service_role',
      reason: 'agotado en taquilla',
      old_state: 'on_sale',
      new_state: 'sold_out',
    });
  });

  it('sólo admin o propietario con TOTP leen la auditoría', async () => {
    const readAudit = (id: Identity) =>
      as(db.client, id, (q) => q.query(`select 1 from public.audit_log`));
    const ownerAal2 = await readAudit(staff(USERS.owner));
    const ownerAal1 = await readAudit(staff(USERS.owner, 'aal1'));
    const memberRead = await readAudit(member());
    expect(ownerAal2.rowCount).toBeGreaterThan(0);
    expect(ownerAal1.rowCount).toBe(0);
    expect(memberRead.rowCount).toBe(0);
  });
});
