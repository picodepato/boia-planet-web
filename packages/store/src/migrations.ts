import { SCHEMA_VERSION } from './schema';

/**
 * Migraciones del documento guardado. Cada una sube exactamente una versión y
 * recibe el documento tal cual estaba guardado (sin validar): tiene que
 * aceptar datos viejos o a medias. Nunca borran progreso (REQ-ARQ-005).
 *
 * Para cambiar la forma del documento: subir `SCHEMA_VERSION` en schema.ts,
 * añadir aquí `{ from: N, to: N + 1, up }` y una prueba con un documento de
 * la versión N.
 */
export interface Migration {
  from: number;
  to: number;
  /** Descripción corta para el registro. */
  name: string;
  up: (doc: Record<string, unknown>) => Record<string, unknown>;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Premio nuevo, sin saldo, para quien ya tenía un logro cuyo premio cambió
 * con el catálogo aprobado (T36, catálogo punto 6): `secretos` pasa a dar el
 * barco Boceto a lápiz. La insignia de `entrada` no hace falta escribirla: se
 * deriva de la definición al leer. Copia fija de lo que decía el catálogo al
 * migrar (una migración no lee el catálogo vivo).
 */
export const V2_NEW_COSMETICS: Readonly<Record<string, string>> = {
  secretos: 'barco-boceto-lapiz',
};

/**
 * v1 → v2 (T36): los logros se reclaman. Todo logro ya concedido en el libro
 * cuenta como completado y reclamado (su fila sigue igual: los saldos no se
 * tocan) y quien tenía `secretos` recibe además su barco, con 0 puntos y 0
 * monedas.
 */
function v1ToV2(doc: Record<string, unknown>): Record<string, unknown> {
  const ledger = Array.isArray(doc.ledger) ? [...(doc.ledger as unknown[])] : [];
  const players: Record<string, unknown> = isObject(doc.players) ? { ...doc.players } : {};
  const compensated = new Set(
    ledger.flatMap((e) =>
      isObject(e) && e.kind === 'compensation' && typeof e.compensatesId === 'string'
        ? [e.compensatesId]
        : [],
    ),
  );
  const ids = new Set(
    ledger.flatMap((e) => (isObject(e) && typeof e.id === 'string' ? [e.id] : [])),
  );
  const completions = new Map<string, Record<string, unknown>>();
  const extra: Record<string, unknown>[] = [];
  for (const e of ledger) {
    if (!isObject(e) || e.kind !== 'achievement') continue;
    const userId = e.userId;
    const achievementId = e.achievementId;
    if (typeof userId !== 'string' || typeof achievementId !== 'string') continue;
    const version = isObject(e.metadata) ? e.metadata.version : undefined;
    const done = completions.get(userId) ?? {};
    done[achievementId] ??= {
      completedAt: e.createdAt,
      version:
        typeof version === 'number' && Number.isInteger(version) && version > 0 ? version : 1,
      worldId: typeof e.seasonId === 'string' ? e.seasonId : null,
      metadata: { migratedFrom: 1 },
    };
    completions.set(userId, done);
    const cosmeticKey = V2_NEW_COSMETICS[achievementId];
    const id = cosmeticKey ? `cosmetic:${cosmeticKey}` : null;
    if (!cosmeticKey || !id || compensated.has(String(e.id)) || ids.has(id)) continue;
    ids.add(id);
    extra.push({
      id,
      userId,
      kind: 'cosmetic',
      pointsDelta: 0,
      coinsDelta: 0,
      seasonId: typeof e.seasonId === 'string' ? e.seasonId : null,
      cosmeticKey,
      sourceRef: `achievement:${achievementId}`,
      metadata: { migratedFrom: 1 },
      createdAt: e.createdAt,
    });
  }
  for (const [userId, done] of completions) {
    const p: Record<string, unknown> = isObject(players[userId])
      ? { ...players[userId] }
      : {
          discoveries: {},
          discounts: {},
          missions: {},
          records: {},
          counters: {},
          equipped: {},
          prefs: {},
        };
    const had = isObject(p.achievements) ? p.achievements : {};
    p.achievements = { ...done, ...had };
    players[userId] = p;
  }
  for (const [userId, p] of Object.entries(players)) {
    if (isObject(p) && !isObject(p.achievements)) players[userId] = { ...p, achievements: {} };
  }
  return { ...doc, players, ledger: [...ledger, ...extra] };
}

/**
 * Precios `muestra` que vivían en `apps/web/lib/ticketing/pricing.ts` antes
 * de pasar al evento (T42). Copia fija: una migración no lee el código vivo.
 */
export const V3_EVENT_PRICES_CENTS: Readonly<Record<string, number>> = {
  'ev-all-day-primavera': 2500,
  'ev-noche-mayo': 1500,
};

/** Clave de serie a partir del formato de texto libre de antes («Noche» → `noche`). */
function seriesKey(text: string): string | undefined {
  const key = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return key || undefined;
}

/**
 * Un evento guardado por el Admin antes de T42, llevado a la forma nueva.
 * `format` era texto libre: «All Day…» pasa a `all_day` y el resto a
 * `satelite` con su texto como serie. El estado lo había puesto el Admin a
 * mano: sigue a mano (`manual`), así nada cambia solo al migrar. El precio de
 * la tabla vieja se copia al evento.
 */
function eventV2ToV3(value: unknown): unknown {
  if (!isObject(value)) return value;
  const e: Record<string, unknown> = { ...value };
  if (e.format !== 'all_day' && e.format !== 'satelite') {
    const text = typeof e.format === 'string' ? e.format : '';
    if (/all\s*day/i.test(text)) e.format = 'all_day';
    else {
      e.format = 'satelite';
      const series = seriesKey(text);
      if (series && e.series === undefined) e.series = series;
    }
  }
  e.stateSource ??= 'manual';
  const id = typeof e.id === 'string' ? e.id : '';
  if (e.priceCents === undefined && V3_EVENT_PRICES_CENTS[id] !== undefined) {
    e.priceCents = V3_EVENT_PRICES_CENTS[id];
  }
  return e;
}

/**
 * v2 → v3 (T42): el evento gana formato cerrado (All Day o satélite), serie,
 * cartel, actividades, precio, apertura de venta y estado por fechas. Sólo
 * se tocan los eventos que el Admin guardó; la foto gana `selection`, que
 * por defecto es falso y no necesita migración.
 */
function v2ToV3(doc: Record<string, unknown>): Record<string, unknown> {
  if (!isObject(doc.content) || !isObject(doc.content.items)) return doc;
  const items = doc.content.items;
  if (!isObject(items.events)) return doc;
  const events: Record<string, unknown> = {};
  for (const [id, o] of Object.entries(items.events)) {
    events[id] = isObject(o) ? { ...o, value: eventV2ToV3(o.value) } : o;
  }
  return { ...doc, content: { ...doc.content, items: { ...items, events } } };
}

/**
 * v3 → v4 (T43): el descuento gana destino (`scope`: entradas o tienda),
 * prioridad y el lugar donde se esconde. Los que guardó el Admin antes eran
 * todos de entradas y sin prioridad: se escriben así, explícitos, para que
 * nada cambie al migrar. El lugar se queda sin poner (lo entregan los
 * lugares del mapa que ya lo nombran).
 */
function v3ToV4(doc: Record<string, unknown>): Record<string, unknown> {
  if (!isObject(doc.content) || !isObject(doc.content.items)) return doc;
  const items = doc.content.items;
  if (!isObject(items.discounts)) return doc;
  const discounts: Record<string, unknown> = {};
  for (const [id, o] of Object.entries(items.discounts)) {
    if (!isObject(o) || !isObject(o.value)) {
      discounts[id] = o;
      continue;
    }
    const value: Record<string, unknown> = { ...o.value };
    if (value.scope !== 'event' && value.scope !== 'store') value.scope = 'event';
    if (typeof value.priority !== 'number') value.priority = 0;
    discounts[id] = { ...o, value };
  }
  return { ...doc, content: { ...doc.content, items: { ...items, discounts } } };
}

/** Motivo de las entradas de auditoría que escribe la migración v4 → v5. */
export const V5_AUDIT_REASON = 'anotada al migrar (v5)';

/**
 * v4 → v5 (T48): el Admin gana borrador y publicación de la home y los
 * eventos, plazo de la papelera y purga, y la auditoría anota compras y
 * sellos (REQ-ADM-007). Se escriben explícitos el borrador vacío, la revisión
 * 0 y el plazo por defecto (30 días), y las compras y sellos que ya había
 * pasan a la auditoría con su fecha y su autor (el visitante), marcados como
 * anotados al migrar. Nada de lo publicado cambia.
 */
function v4ToV5(doc: Record<string, unknown>): Record<string, unknown> {
  const content: Record<string, unknown> = isObject(doc.content) ? { ...doc.content } : {};
  if (!isObject(content.drafts)) content.drafts = { items: {}, order: {}, texts: {} };
  if (typeof content.revision !== 'number') content.revision = 0;
  if (!isObject(content.settings)) content.settings = { trashRetentionDays: 30 };
  const audit = Array.isArray(doc.audit) ? [...(doc.audit as unknown[])] : [];
  const seen = new Set(
    audit.flatMap((a) => (isObject(a) && typeof a.id === 'string' ? [a.id] : [])),
  );
  const add = (entry: Record<string, unknown>) => {
    if (seen.has(String(entry.id))) return;
    seen.add(String(entry.id));
    audit.push(entry);
  };
  const purchases = Array.isArray(doc.purchases) ? doc.purchases : [];
  for (const p of purchases) {
    if (!isObject(p) || typeof p.id !== 'string' || typeof p.userId !== 'string') continue;
    add({
      id: `v5:purchase:${p.id}`,
      at: typeof p.createdAt === 'string' ? p.createdAt : new Date(0).toISOString(),
      actor: p.userId,
      area: 'purchases',
      action: 'purchase',
      targetId: p.id,
      before: null,
      after: p,
      reason: V5_AUDIT_REASON,
    });
  }
  const ledger = Array.isArray(doc.ledger) ? doc.ledger : [];
  for (const e of ledger) {
    if (!isObject(e) || e.kind !== 'stamp' || typeof e.id !== 'string') continue;
    if (typeof e.userId !== 'string') continue;
    add({
      id: `v5:stamp:${e.id}`,
      at: typeof e.createdAt === 'string' ? e.createdAt : new Date(0).toISOString(),
      actor: e.userId,
      area: 'ledger',
      action: 'stamp',
      targetId: e.id,
      before: null,
      after: e,
      reason: V5_AUDIT_REASON,
    });
  }
  return { ...doc, content, audit };
}

/**
 * v5 → v6 (T45): los Carnets se reportan y se moderan (REQ-ADM-040) y el
 * Admin fija el destino de las partidas nuevas de cada misión por mundo
 * (REQ-AVE-011). Se escriben explícitos los reportes vacíos, la moderación
 * vacía y ningún destino fijado: las misiones empezadas o completadas no
 * cambian (REQ-AVE-010).
 */
function v5ToV6(doc: Record<string, unknown>): Record<string, unknown> {
  const content: Record<string, unknown> = isObject(doc.content) ? { ...doc.content } : {};
  if (!isObject(content.missionDestinations)) content.missionDestinations = {};
  return {
    ...doc,
    carnetReports: Array.isArray(doc.carnetReports) ? doc.carnetReports : [],
    carnetModeration: isObject(doc.carnetModeration) ? doc.carnetModeration : {},
    content,
  };
}

/**
 * Barcos que eran libres antes de la economía (T40) y ahora se compran o se
 * desbloquean con puntos: estilo → cosmético `ship`. Los de logro ya estaban
 * bloqueados (T36) y los de base siguen siendo de todos. Copia fija.
 */
export const V7_WERE_FREE_SHIPS: Readonly<Record<string, string>> = {
  'low-poly': 'barco-low-poly',
  'cartoon-30': 'barco-cartoon-30',
  'semi-realista': 'barco-semi-realista',
};
/** Barcos con skins noche y fiesta a la venta desde T40: estilo → cosmético `ship`. */
export const V7_SKIN_SHIPS: Readonly<Record<string, string>> = {
  arcilla: 'barco-arcilla',
  acuarela: 'barco-acuarela',
  ...V7_WERE_FREE_SHIPS,
  'cel-shaded': 'barco-cel-shaded',
  'pixel-art': 'barco-pixel-art',
};
export const V7_SKINS: readonly string[] = ['noche', 'fiesta'];
const V7_BASE_SHIPS = new Set(['barco-arcilla', 'barco-acuarela']);
/** Preferencia donde /juego guarda el barco que se lleva (`SHIP_PREF` de apps/web). */
export const V7_SHIP_PREF = 'barco';
export const V7_SOURCE = 'migration:v7';

/**
 * v6 → v7 (T40): los barcos y las skins se compran. Lo que el visitante ya
 * llevaba (la preferencia `barco` de /juego: estilo y skin) sigue siendo
 * suyo: una fila `cosmetic` sin coste por el barco, si era libre y ahora no,
 * y por la skin, si no es la base; y queda equipado. Los saldos no cambian.
 */
function v6ToV7(doc: Record<string, unknown>): Record<string, unknown> {
  const ledger = Array.isArray(doc.ledger) ? [...(doc.ledger as unknown[])] : [];
  const players: Record<string, unknown> = isObject(doc.players) ? { ...doc.players } : {};
  const compensated = new Set(
    ledger.flatMap((e) =>
      isObject(e) && e.kind === 'compensation' && typeof e.compensatesId === 'string'
        ? [e.compensatesId]
        : [],
    ),
  );
  const ids = new Set(
    ledger.flatMap((e) => (isObject(e) && typeof e.id === 'string' ? [e.id] : [])),
  );
  const owns = (userId: string, key: string) =>
    V7_BASE_SHIPS.has(key) ||
    ledger.some(
      (e) =>
        isObject(e) &&
        e.kind === 'cosmetic' &&
        e.userId === userId &&
        e.cosmeticKey === key &&
        !compensated.has(String(e.id)),
    );
  const identity = isObject(doc.identity) ? doc.identity : null;
  const at =
    identity && typeof identity.createdAt === 'string'
      ? identity.createdAt
      : '2026-09-30T00:00:00.000Z';
  const give = (userId: string, key: string) => {
    if (owns(userId, key)) return;
    let id = `cosmetic:${key}`;
    for (let n = 2; ids.has(id); n++) id = `cosmetic:${key}#${n}`;
    ids.add(id);
    ledger.push({
      id,
      userId,
      kind: 'cosmetic',
      pointsDelta: 0,
      coinsDelta: 0,
      seasonId: null,
      cosmeticKey: key,
      sourceRef: V7_SOURCE,
      metadata: { migratedFrom: 6 },
      createdAt: at,
    });
  };
  for (const [userId, raw] of Object.entries(players)) {
    if (!isObject(raw)) continue;
    const prefs = isObject(raw.prefs) ? raw.prefs : {};
    const pref = prefs[V7_SHIP_PREF];
    if (!isObject(pref) || typeof pref.style !== 'string') continue;
    const style = pref.style;
    const skin = typeof pref.skin === 'string' ? pref.skin : 'base';
    const equipped: Record<string, unknown> = isObject(raw.equipped) ? { ...raw.equipped } : {};
    const freeShip = V7_WERE_FREE_SHIPS[style];
    if (freeShip) {
      give(userId, freeShip);
      equipped.ship = freeShip;
    }
    const ship = V7_SKIN_SHIPS[style];
    if (ship && V7_SKINS.includes(skin) && owns(userId, ship)) {
      const key = `skin-${style}-${skin}`;
      give(userId, key);
      equipped.ship = ship;
      equipped.skin = key;
    }
    players[userId] = { ...raw, equipped };
  }
  return { ...doc, players, ledger };
}

/**
 * Huellas del Cañón definitivo (plan 013 T153), copia fija de las claves de
 * `apps/web/lib/mundo/achievements.ts` y de la campaña (`canon-campaign.ts`):
 * una migración no lee el código vivo.
 */
export const V8_WON_CANON = 'minijuego:canon';
export const V8_PLAYED_CANON = 'partida:canon';
/** Contador de la campaña (veces que cayó el boss final del acto) → huella del boss vencido. */
export const V8_CAMPAIGN_BOSSES: Readonly<Record<string, string>> = {
  'canon:acto-1:boss-final': 'jefe:fantasma',
  'canon:acto-2:boss-final': 'jefe:kraken',
};

/**
 * v7 → v8 (T153): los logros nuevos del Cañón cuentan partidas jugadas
 * (`play_minigame`) y bosses vencidos (`defeat_boss`), y Guardacostas pasa a
 * pedir jugar el Cañón en vez de ganarlo. Lo que ya se hizo en la beta sigue
 * contando: quien ganó el Cañón lo jugó (`partida:canon`) y quien venció al
 * boss final de un acto (el contador de la campaña) venció a ese boss
 * (`jefe:<boss>`). Sólo se añaden huellas: el libro (saldos, logros
 * reclamados, premios ya cobrados) y los logros completados no cambian.
 */
function v7ToV8(doc: Record<string, unknown>): Record<string, unknown> {
  if (!isObject(doc.players)) return doc;
  const identity = isObject(doc.identity) ? doc.identity : null;
  const fallbackAt =
    identity && typeof identity.createdAt === 'string'
      ? identity.createdAt
      : '2026-10-05T00:00:00.000Z';
  const players: Record<string, unknown> = {};
  for (const [userId, raw] of Object.entries(doc.players)) {
    if (!isObject(raw) || !isObject(raw.discoveries)) {
      players[userId] = raw;
      continue;
    }
    const discoveries: Record<string, unknown> = { ...raw.discoveries };
    const add = (key: string, from: unknown) => {
      if (discoveries[key] !== undefined) return;
      const at = isObject(from) && typeof from.at === 'string' ? from.at : fallbackAt;
      const worldId = isObject(from) && typeof from.worldId === 'string' ? from.worldId : null;
      discoveries[key] = { at, worldId };
    };
    const won = discoveries[V8_WON_CANON];
    if (won !== undefined) add(V8_PLAYED_CANON, won);
    const counters = isObject(raw.counters) ? raw.counters : {};
    for (const [counter, key] of Object.entries(V8_CAMPAIGN_BOSSES)) {
      const n = counters[counter];
      if (typeof n === 'number' && n > 0) add(key, null);
    }
    players[userId] = { ...raw, discoveries };
  }
  return { ...doc, players };
}

/**
 * Lo que retira el plan 014 (T157), copia fija de `retired-achievements.ts`:
 * el logro «Vigía del faro» y la huella de haber ganado la Vigilancia del
 * faro. Una migración no lee el código vivo.
 */
export const V9_RETIRED_ACHIEVEMENT = 'faro';
export const V9_RETIRED_DISCOVERY = 'minijuego:faro';

/**
 * v8 → v9 (plan 014 T157): la Vigilancia del faro sale de la web y quien
 * ganó su logro no lo conserva. Se quita de cada jugador el logro completado
 * (`achievements.faro`) y la huella de la victoria (`minijuego:faro`). El
 * libro no cambia (es historia: lo cobrado sigue sumando; el repositorio ya
 * no enseña el logro retirado) ni nada más del documento.
 */
function v8ToV9(doc: Record<string, unknown>): Record<string, unknown> {
  if (!isObject(doc.players)) return doc;
  const players: Record<string, unknown> = {};
  for (const [userId, raw] of Object.entries(doc.players)) {
    if (!isObject(raw)) {
      players[userId] = raw;
      continue;
    }
    const next: Record<string, unknown> = { ...raw };
    const without = (v: Record<string, unknown>, key: string) =>
      Object.fromEntries(Object.entries(v).filter(([k]) => k !== key));
    if (isObject(raw.achievements) && V9_RETIRED_ACHIEVEMENT in raw.achievements) {
      next.achievements = without(raw.achievements, V9_RETIRED_ACHIEVEMENT);
    }
    if (isObject(raw.discoveries) && V9_RETIRED_DISCOVERY in raw.discoveries) {
      next.discoveries = without(raw.discoveries, V9_RETIRED_DISCOVERY);
    }
    players[userId] = next;
  }
  return { ...doc, players };
}

export const MIGRATIONS: readonly Migration[] = [
  { from: 1, to: 2, name: 'logros que se reclaman (T36)', up: v1ToV2 },
  { from: 2, to: 3, name: 'eventos con formato, precio y estado por fechas (T42)', up: v2ToV3 },
  { from: 3, to: 4, name: 'descuentos con destino, prioridad y escondite (T43)', up: v3ToV4 },
  {
    from: 4,
    to: 5,
    name: 'borrador y publicación, papelera con plazo, compras y sellos auditados (T48)',
    up: v4ToV5,
  },
  {
    from: 5,
    to: 6,
    name: 'reportes y moderación de Carnets, destino de misión por mundo (T45)',
    up: v5ToV6,
  },
  {
    from: 6,
    to: 7,
    name: 'barcos y skins que se compran; lo que se llevaba sigue siendo suyo (T40)',
    up: v6ToV7,
  },
  {
    from: 7,
    to: 8,
    name: 'logros del Cañón: partidas jugadas y bosses vencidos en la beta (T153)',
    up: v7ToV8,
  },
  {
    from: 8,
    to: 9,
    name: 'sin la Vigilancia del faro: su logro y su huella de victoria (plan 014 T157)',
    up: v8ToV9,
  },
];

export type MigrationOutcome =
  | { status: 'ok'; doc: Record<string, unknown>; from: number; applied: string[] }
  /** Guardado por una versión más nueva del código: no se toca. */
  | { status: 'newer'; from: number }
  /** No es un documento de la tienda o falta un paso de migración. */
  | { status: 'invalid'; from: number | null; error: string };

/** Versión guardada; un documento sin `schemaVersion` no es de esta tienda. */
export function storedVersion(raw: unknown): number | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const v = (raw as Record<string, unknown>).schemaVersion;
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;
}

/** Lleva un documento guardado hasta `target` aplicando los pasos en orden. */
export function migrate(
  raw: unknown,
  target: number = SCHEMA_VERSION,
  migrations: readonly Migration[] = MIGRATIONS,
): MigrationOutcome {
  const from = storedVersion(raw);
  if (from === null) return { status: 'invalid', from: null, error: 'sin schemaVersion' };
  if (from > target) return { status: 'newer', from };
  let doc = { ...(raw as Record<string, unknown>) };
  let v = from;
  const applied: string[] = [];
  while (v < target) {
    const step = migrations.find((m) => m.from === v);
    if (!step || step.to !== v + 1) {
      return { status: 'invalid', from, error: `falta la migración ${v} → ${v + 1}` };
    }
    try {
      doc = { ...step.up(doc), schemaVersion: step.to };
    } catch (e) {
      return { status: 'invalid', from, error: `${step.name}: ${String(e)}` };
    }
    applied.push(step.name);
    v = step.to;
  }
  return { status: 'ok', doc, from, applied };
}
