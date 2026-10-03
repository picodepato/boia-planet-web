'use client';

import type { ShipState, WorldEvent } from '@boia/engine/headless';
import { EVENT_STATE_BEHAVIOR } from '@boia/contracts';
import {
  CircuitRace,
  type CircuitSpec,
  GhostRecorder,
  type GhostRun,
  circuitFromWorld,
  formatRaceTime,
  ghostPose,
  readRecord,
} from '@boia/engine/circuit';
import { MINIGAME_REGISTRY } from '@boia/engine/minigames';
import {
  type MissionEvent,
  RescueMission,
  type RescuePhase,
  rescueMissionOf,
} from '@boia/engine/mission';
import {
  type Notice,
  type Settings,
  browserStore,
  loadSettings,
  parseSettings,
  saveSettings,
  setControlSensitivity,
} from '@boia/engine/ui';
import {
  CIRCUIT_ID,
  type ComposedWorld,
  type WorldConfig,
  chooseWorld as chooseWorldIn,
} from '@boia/world';
import Link from 'next/link';
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { liveWorld } from '../../lib/admin/live-world';
import { track } from '../../lib/analytics';
import { SandboxCheckout } from '../../lib/ticketing/checkout';
import { purchaseNotices } from '../../lib/ticketing/notices';
import { ClaimBadge, claimLabel } from '../../lib/logros/claim-badge';
import { useReadyCount } from '../../lib/logros/use-logros';
import type { ShipCatalog } from '../../lib/barco/catalog';
import { dressingFor } from '../../lib/barco/dressing';
import type { ShipLook } from '../../lib/barco/shop-model';
import {
  TIME_PLAYED_TICK_S,
  onAchievementNotices,
  recordBuoy,
  recordSignal,
  signalFromWorldEvent,
} from '../../lib/mundo/achievements';
import { CarnetInvite } from '../../lib/mundo/carnet/carnet-invite';
import { finishLap } from '../../lib/mundo/circuit-hud';
import {
  circuitName,
  circuitRanking,
  crewLeader,
  crewPlace,
} from '../../lib/mundo/ranking-circuit';
import { worlds } from '../../lib/mundo/demo-world';
import {
  DOLPHIN_PARAM,
  type DolphinAction,
  type DolphinGuide,
  WhirlpoolTimer,
  findDolphinGuide,
  inOpenSea,
} from '../../lib/mundo/encounters';
import { type MinigameOffer, MinigameLayer } from '../../lib/mundo/minigame-layer';
import {
  boardedNotice,
  deliveredNotice,
  deliveryDiscount,
  loadMission,
  missedDeliveryDiscount,
  persistMissionEvent,
} from '../../lib/mundo/mission';
import {
  type GuideSpot,
  type HelpNow,
  discountMarks,
  guideSpots,
  helpNow,
  missionDiscountOf,
  nearestSpot,
} from '../../lib/mundo/guide';
import { useNoticeQueue } from '../../lib/mundo/notices';
import { gameRepository, seaWorld, useRepoData } from '../../lib/mundo/repo';
import type { BottleSheetMode } from '../../lib/mundo/bottles/bottle-sheet';
import {
  SHIP_POSITION_SAVE_MS,
  documentNavigationType,
  loadShipPosition,
  movedEnough,
  saveShipPosition,
  shouldRestorePosition,
} from '../../lib/mundo/ship-position';
import {
  applyAudioSettings,
  bump,
  chime,
  fanfare,
  installAudioLifecycle,
  plop,
  setAmbientWorld,
  whoosh,
} from '../../lib/mundo/sound';
import { equipLook, rememberLook, storedLook, syncStyleParam } from '../../lib/mundo/ship-look';
import { useCarnetInvitations } from '../../lib/mundo/use-invitations';
import {
  adminWorldId,
  currentWorld,
  syncWorldParam,
  visitorWorldChoice,
} from '../../lib/mundo/world-choice';
import {
  type ProgressOutcome,
  discoverPlace,
  discoveredPlaces,
  grantEncounter,
  persistWorldEvent,
} from '../../lib/mundo/world-progress';
import { takeZarpar } from '../../lib/intro/zarpar';
import { marWorld } from './engine/compact';
import type { CourseInfo, Mar3D, PinSpec, Stats, VoyageEnd } from './engine/mar3d';
import { PIN_AVOID } from './engine/labels';
import { MOOD_IDS, type MoodId } from './engine/palette';
import type { Period } from './engine/wrap';
import {
  type ShipModelEntry,
  loadShipManifest,
  loadShipModel,
  withShipVariants,
} from './engine/ship-model';
import { MarABordo } from './a-bordo';
import {
  type MarLinks,
  type MarPanel,
  hasMarLinks,
  readMarLinks,
  withoutMarLinks,
} from './deep-link';
import { MarEntradas } from './entradas';
import { worldTickets } from './entradas-model';
import { MarLogros } from './logros';
import { MarMenu, type MenuSection } from './menu';
import { MarTienda } from './tienda';
import { MarBotella, MarBottlesNear, MarRanking } from './botellas';
import { type MarBottle, bottlesNear, dropSpot, marPeriod, placeBottles } from './bottles';
import { type PointMap, pointMap } from './engine/compress';
import { MarMinimap, type MinimapMark } from './minimap';
import { MarAyuda } from './guia';
import {
  browserGhostStorage,
  lapTargets,
  loadGhost,
  raceCheckpoint,
  roadPath,
  saveGhost,
  startPose,
} from './race';
import { OffRoad, distToPath, roadMarks } from './road';
import {
  MarRaceChip,
  MarRaceIntro,
  MarRaceOffer,
  MarRaceResult,
  type RaceHud,
  type RaceOffer,
  type RaceResult,
} from './carrera';
import { Sheet, type SheetState, eventOfPlace, findEvent, islandOfEvent, sheetKey } from './sheet';
import {
  type Trip,
  arrivalSheet,
  islandTrip,
  linkTrip,
  marPositionStore,
  tripOutcome,
} from './voyage';
import { liveContent } from '../../lib/landing/live-content';
import './mar.css';
import { t as msg } from '../../lib/i18n';

/**
 * /mar: el mar de BOIA en 3D, el mundo navegable (plan 005: el único). Mismo
 * mapa compartido, mismo motor de comportamientos y mismo repositorio (lo que
 * se gana aquí sale en el Carnet); la vista, la cámara y los controles están
 * pensados para el móvil, con zoom continuo desde la cubierta hasta el mapa
 * entero. Mi Carnet, Ajustes, Controles y Welcome Aboard se abren dentro del
 * mar (T55), y los enlaces de la landing (`?ir=`, `?evento=`, `?menu=`)
 * arrancan con el barco navegando a su isla o con su panel abierto.
 *
 * El HUD (T65, decisión del 2026-10-02): arriba, los enlaces a la web (Fotos,
 * Shop, Artistas y Contacto salen a su sección; Carnet, el último, abre el
 * menú del juego en Mi Carnet), el minimapa y los saldos; a la izquierda, el
 * botón del menú del juego (el icono de logros), con todo lo demás, y debajo
 * el «?» de ayuda (T68); abajo, sólo «Entradas» y el turbo. Nada guía solo:
 * ni chips de rumbo ni mensajes al zarpar (T68); el delfín, sí. Textos
 * `muestra`.
 */

/** Los enlaces de arriba a la web (T65): a su sección de la landing (D-21: entra directa). */
const LANDING_LINKS = [
  ['fotos', 'mar.hud.fotos', '/#fotos'],
  ['shop', 'mar.hud.shop', '/#tienda'],
  ['artistas', 'mar.hud.artistas', '/#artistas'],
  ['contacto', 'mar.hud.contacto', '/#contacto'],
] as const;

const progressApi = () => gameRepository().progress;
const newSessionId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const MOOD_KEY = 'boia:mar3d:momento';
/** Lo que tarda en fundirse el velo de la entrada al llegar zarpando (T64). */
const VELO_MS = 700;

const ticketAvailable = (id: string) => {
  const e = findEvent(id);
  return !!e && EVENT_STATE_BEHAVIOR[e.state].purchasable;
};

/** El id de un evento por su id o su slug (los enlaces usan los dos); null si no existe. */
const eventIdOf = (idOrSlug: string): string | null =>
  (findEvent(idOrSlug) ?? liveContent().events.find((e) => e.slug === idOrSlug))?.id ?? null;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * «Entradas» vuela (experimento): el barco despliega alas y vuela a la isla
 * del evento. `?vuelo=0` vuelve al viaje en turbo por el mar, para comparar.
 */
function ticketsFly(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('vuelo') !== '0';
  } catch {
    return true;
  }
}

function readPref(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writePref(key: string, v: string): void {
  try {
    window.localStorage.setItem(key, v);
  } catch {
    // Sin almacenamiento (modo privado): no se recuerda y ya.
  }
}

const PIN_ICON: Record<string, string> = {
  allday: '🔊',
  cala: '🏺',
  fotos: '📷',
  tienda: '🛍️',
  ultima: '🎆',
  halloween: '🎃',
  faro: '🗼',
  canon: '💣',
};

/** El icono de cada aviso en su chip (T53). */
const NOTICE_ICON: Record<Notice['kind'], string> = {
  discovery: '🧭',
  achievement: '🏆',
  reward: '🎁',
  info: '💬',
};

function pinsOf(world: WorldConfig, phase: RescuePhase | null): PinSpec[] {
  const out: PinSpec[] = [];
  for (const o of world.objects) {
    if (!o.identity.active) continue;
    const id = o.identity.id;
    const cat = o.identity.category;
    if (cat === 'isla') {
      const ev = eventOfPlace(o);
      out.push({
        id,
        text: o.identity.name,
        icon: PIN_ICON[id] ?? '🏝️',
        ...(ev ? { accent: true, always: true } : {}),
      });
    } else if (cat === 'naufrago') {
      out.push({ id, text: o.identity.name, icon: '🆘' });
    } else if (
      cat === 'encuentro' &&
      (phase === null || phase === 'waiting' || phase === 'loading')
    ) {
      out.push({ id, text: o.identity.name, icon: '🎈', always: true });
    } else if (
      cat === 'circuito' &&
      o.behaviors.some((b) => b.type === 'checkpoint' && b.params.order === 0)
    ) {
      out.push({ id, text: o.identity.name, icon: '🏁' });
    }
  }
  return out;
}

type Status = 'loading' | 'ready' | 'error';

/** Golpes (T46): velocidad perdida que suena al máximo y espera entre dos. muestra */
const BUMP_FULL_SPEED = 200;
const BUMP_COOLDOWN_MS = 350;

/** Mapa compartido → mar 3D para las botellas (T56), hecho la primera vez que hace falta. */
let bottlePointMap: PointMap | null = null;
const bottleMap = () => (bottlePointMap ??= pointMap(seaWorld()));

/** El mar 3D ya arrancó antes en este documento (volver sin recargar restaura la posición). */
let bootedInDocument = false;

/** La posición del barco de /mar en este navegador (T44), o null sin almacenamiento. */
function devicePositions() {
  try {
    return marPositionStore(window.localStorage);
  } catch {
    return null;
  }
}

export function MarClient({ shipCatalog = null }: { shipCatalog?: ShipCatalog | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Mar3D | null>(null);
  const worldRef = useRef<WorldConfig | null>(null);
  const liveRef = useRef<ComposedWorld | null>(null);
  const worldIdRef = useRef('arcilla');
  const phaseRef = useRef<RescuePhase | null>(null);
  const missionRef = useRef<RescueMission | null>(null);
  /**
   * El Freu (T61): la carrera, su reloj (s de simulación: así el tiempo y el
   * fantasma no dependen de los fotogramas), la grabación de la carrera en
   * curso y el fantasma de la mejor guardada.
   */
  const raceRef = useRef<{
    race: CircuitRace;
    spec: CircuitSpec;
    clock: number;
    recorder: GhostRecorder;
    ghost: GhostRun | null;
    /** La carretera de una vuelta, sus boyitas y el tiempo que queda fuera de ella (T76). */
    path: { x: number; y: number }[];
    /** El periodo del planeta: la distancia a la carretera va por el camino corto. */
    period: Period;
    marks: ReturnType<typeof roadMarks>;
    offRoad: OffRoad;
  } | null>(null);
  // El delfín guía (O15, T45): el runtime en que se escondió y el reloj de sus pasos.
  const dolphinRef = useRef<DolphinGuide | null>(null);
  const dolphinRuntime = useRef<unknown>(null);
  const dolphinClock = useRef(0);
  const [dolphinOut, setDolphinOut] = useState(false);
  // Adónde guía el delfín al salir (T59): la Fiestera, un código o un minijuego.
  const [dolphinTo, setDolphinTo] = useState<string | null>(null);
  // El «?» de ayuda (T68): el objetivo y una pista, sólo si se pregunta.
  const [ayuda, setAyuda] = useState<HelpNow | null>(null);
  // Los códigos ya encontrados (T59): sus «?» se quitan y nadie guía hasta ellos.
  const { data: foundDiscountList } = useRepoData((r) => r.progress.discounts());
  const foundDiscountsRef = useRef(new Set<string>());
  foundDiscountsRef.current = new Set((foundDiscountList ?? []).map((f) => f.discount.id));
  // Lo ya encontrado (secretos, cofres, boias…): el delfín no guía hasta ahí.
  const foundObjectsRef = useRef(new Set<string>());
  // Islas ya descubiertas: su ficha ofrece «Explorar la isla» (REQ-AVE-013).
  const discoveredRef = useRef(new Set<string>());
  const bumpCooldown = useRef(0);
  const whirlRef = useRef(new WhirlpoolTimer());
  const rescueNotices = useRef<Promise<Notice[]> | null>(null);

  const [sessionId] = useState(newSessionId);
  const [status, setStatus] = useState<Status>('loading');
  // Llegada zarpando desde la entrada de la landing (T64): el velo del mar de
  // la entrada sigue puesto y se funde cuando el mar está listo.
  const [velo, setVelo] = useState(false);
  useEffect(() => {
    if (takeZarpar()) setVelo(true);
  }, []);
  useEffect(() => {
    if (status !== 'ready' || !velo) return;
    const id = window.setTimeout(() => setVelo(false), VELO_MS);
    return () => window.clearTimeout(id);
  }, [status, velo]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const sheetRef = useRef<SheetState | null>(null);
  sheetRef.current = sheet;
  const [checkoutFor, setCheckoutFor] = useState<string | null>(null);
  // Viaje en turbo del botón «Entradas» (REQ-ENT-040), de «Ir a la isla» o de
  // un enlace profundo (T55), y el lugar al que llegó el último.
  const [trip, setTrip] = useState<Trip | null>(null);
  const tripRef = useRef<Trip | null>(null);
  tripRef.current = trip;
  const [arrivedAt, setArrivedAt] = useState<string | null>(null);
  // Los enlaces profundos de la URL (T55), leídos al arrancar y consumidos al estar listo.
  const linksRef = useRef<MarLinks | null>(null);
  // Mi Carnet, Ajustes, Controles y Welcome Aboard, dentro del mar (T55).
  const [hoja, setHoja] = useState<Exclude<MarPanel, 'logros'> | null>(null);
  // «Crear Carnet» del aviso de la compra (T66): Mi Carnet entra en el alta
  // y, al crearlo, vuelve a la compra de este evento con el descuento.
  const [carnetForCheckout, setCarnetForCheckout] = useState<string | null>(null);
  // «Elige tu evento» dentro del mar (T58): lo abre «Entradas».
  const [entradas, setEntradas] = useState(false);
  const [minigameOffer, setMinigameOffer] = useState<MinigameOffer | null>(null);
  const [minigameOpen, setMinigameOpen] = useState(false);
  const [mood, setMood] = useState<MoodId>('tarde');
  const [dialogue, setDialogue] = useState<{
    objectId: string;
    text: string;
    last: boolean;
  } | null>(null);
  const [phase, setPhase] = useState<RescuePhase | null>(null);
  const [race, setRace] = useState<RaceHud | null>(null);
  const [raceResult, setRaceResult] = useState<RaceResult | null>(null);
  // El récord al acercarse a la salida, antes de correr (REQ-AVE-028).
  const [raceIntro, setRaceIntro] = useState<string | null>(null);
  // Al llegar a la salida (T73): qué es la carrera y si empezar.
  const [raceOffer, setRaceOffer] = useState<RaceOffer | null>(null);
  const [menu, setMenu] = useState(false);
  const [worldName, setWorldName] = useState('');
  // Cambio de mundo por agujero negro (T41, T51): el mundo de ahora y la transición.
  const [worldId, setWorldId] = useState<string | null>(null);
  const [switching, setSwitching] = useState<'vortex' | 'fade' | null>(null);
  const [worldPending, setWorldPending] = useState(false);
  const [ships, setShips] = useState<ShipModelEntry[]>([]);
  // El barco que se lleva (estilo y skin) y la tienda «Barco» (T40).
  const [shipLook, setShipLook] = useState<ShipLook | null>(null);
  const shipLookRef = useRef<ShipLook | null>(null);
  shipLookRef.current = shipLook;
  const [shipPending, setShipPending] = useState(false);
  const [tienda, setTienda] = useState(false);
  const { data: equippedNow } = useRepoData((r) => r.progress.equipped());
  const [settings, setSettings] = useState<Settings | null>(() =>
    typeof window === 'undefined' ? null : loadSettings(browserStore()),
  );
  /**
   * Ajustes (T55): se guardan en este navegador y se aplican ya: el sonido y
   * la sensibilidad del giro, que el motor lee en cada paso (`turnScale`).
   */
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const updateSettings = useCallback((change: (s: Settings) => Settings) => {
    const store = browserStore();
    const next = parseSettings(change(settingsRef.current ?? loadSettings(store)));
    settingsRef.current = next;
    setSettings(next);
    saveSettings(store, next);
    applyAudioSettings(next);
    setControlSensitivity(next.sensitivity);
  }, []);
  const { data: balances } = useRepoData((r) => r.progress.balances());
  // Logros (T37): el icono del HUD con su número y el panel para reclamar.
  const [logros, setLogros] = useState(false);
  const readyToClaim = useReadyCount();
  // Botellas (T56): las del repositorio flotan en el mar 3D; cerca del barco se leen.
  const { data: bottleList } = useRepoData((r) => r.bottles.list());
  const marBottlesRef = useRef<MarBottle[]>([]);
  const nearBottlesRef = useRef<ReadonlySet<string>>(new Set());
  const [nearBottles, setNearBottles] = useState<readonly string[]>([]);
  const [bottleSheet, setBottleSheet] = useState<BottleSheetMode | null>(null);
  // El ranking local (T56): De siempre, Temporada y Circuito.
  const [ranking, setRanking] = useState(false);

  // Avisos con tiempo de lectura (D-22): al menos 3 s, más si el texto es largo.
  const notices = useNoticeQueue(
    (n) => {
      if (n.kind === 'reward' || n.kind === 'achievement') chime();
    },
    { readable: true },
  );
  const push = notices.push;
  // Para el arranque (que corre una vez): el aviso y el catálogo de ahora (T59).
  const pushRef = useRef(push);
  pushRef.current = push;
  const shipCatalogRef = useRef(shipCatalog);
  shipCatalogRef.current = shipCatalog;

  const persist = useCallback(
    (p: Promise<ProgressOutcome[]>) => {
      p.then((outs) => {
        for (const o of outs) {
          push(o.notice);
          if (o.kind === 'discount') setSheet({ kind: 'discount', found: o.found });
        }
      }).catch((err: unknown) => console.warn('[boia] no se pudo guardar el progreso', err));
    },
    [push],
  );

  const pushAll = useCallback(
    (p: Promise<Notice[]>) => {
      p.then((ns) => ns.forEach(push)).catch((err: unknown) =>
        console.warn('[boia] no se pudo apuntar el logro', err),
      );
    },
    [push],
  );

  // Los logros de las señales sueltas (minijuegos, mundo, botellas, Carnet)
  // también avisan aquí, como en el 2D (T37).
  useEffect(() => onAchievementNotices((ns) => ns.forEach(push)), [push]);

  // --- Eventos del mundo ------------------------------------------------------

  const syncDialogue = () => {
    const d = engineRef.current?.dialogue();
    setDialogue(
      d ? { objectId: d.objectId, text: d.text, last: d.reaction || d.index >= d.count - 1 } : null,
    );
  };

  /** La carrera de El Freu del mundo `w` (T61), o null si el mundo no tiene circuito. */
  const newRace = (w: WorldConfig) => {
    const spec = circuitFromWorld(w, CIRCUIT_ID);
    if (!spec) return null;
    const path = roadPath(w, spec);
    return {
      period: marPeriod(w),
      race: new CircuitRace(spec),
      spec,
      clock: 0,
      recorder: new GhostRecorder(),
      ghost: null,
      path,
      marks: roadMarks(path),
      offRoad: new OffRoad(),
    };
  };

  const raceEvents = (evs: ReturnType<CircuitRace['tick']>) => {
    const r = raceRef.current;
    const g = engineRef.current;
    const world = worldRef.current;
    if (!r || !g) return;
    for (const e of evs) {
      switch (e.type) {
        case 'ready': {
          // La salida ya no arranca sola (T73): explica la carrera y pregunta.
          const spec = r.spec;
          const place = (world && circuitName(world)) ?? msg('mar.sheet.circuito');
          void readRecord(progressApi(), spec)
            .catch(() => null)
            .then((rec) => {
              if (raceRef.current?.spec !== spec || raceRef.current.race.active) return;
              setRaceResult(null);
              setRaceOffer({
                place,
                laps: spec.laps,
                buoys: spec.buoys,
                bestMs: rec?.bestMs ?? null,
                leader: crewLeader(),
              });
            });
          break;
        }
        case 'countdown': {
          // Quieto en la salida hasta «¡Ya!», mirando a la primera boia.
          g.setSemaphore('red');
          g.setNextGate(1);
          g.holdShip(world ? startPose(world, r.spec) : null);
          // Las boyitas de la carretera aparecen al empezar (T76).
          r.offRoad.reset();
          g.setRoad(r.marks);
          // Sin las marcas amarillas entre islas mientras se corre (decisión 13, T88).
          g.setRouteHidden(true);
          r.ghost = loadGhost(browserGhostStorage(), r.spec);
          setRaceResult(null);
          setRaceIntro(null);
          setRaceOffer(null);
          plop();
          break;
        }
        case 'go':
          g.holdShip(null);
          g.setSemaphore('green');
          r.recorder.reset();
          chime();
          window.setTimeout(() => engineRef.current?.setSemaphore('off'), 2500);
          break;
        case 'checkpoint':
          g.setNextGate(e.order + 1 > r.spec.buoys ? 0 : e.order + 1);
          plop();
          break;
        case 'missed':
          push({
            id: `circuito:falta:${Date.now()}`,
            kind: 'info',
            title: msg('mar.race.missed', { order: e.order }),
            body: msg('mar.race.missed.body'),
          });
          break;
        case 'lap': {
          g.setNextGate(1);
          chime();
          const time = msg('mar.race.lapDone', { lap: e.lap, time: formatRaceTime(e.lapMs) });
          const last = e.lap === r.spec.laps - 1;
          push({
            id: `circuito:vuelta:${e.lap}:${Date.now()}`,
            kind: 'info',
            title: last ? msg('mar.race.lastLap') : time,
            ...(last ? { body: time } : {}),
          });
          break;
        }
        case 'finish': {
          g.setNextGate(null);
          g.setGhost(null);
          g.setRoad(null);
          g.setRouteHidden(false);
          r.offRoad.reset();
          g.celebrate(null);
          fanfare();
          // La grabación es el fantasma de la próxima, si es la mejor de este navegador.
          const run = r.recorder.finish(e.ms);
          if (run) saveGhost(browserGhostStorage(), r.spec, run);
          r.ghost = null;
          const spec = r.spec;
          const place = (world && circuitName(world)) ?? msg('mar.sheet.circuito');
          finishLap(progressApi(), spec, e.ms, e.route)
            .then((res) => {
              // Contra los demás (la tripulación de muestra: en esta versión no hay
              // ranking compartido) y contra ti (tu récord), T73.
              const table = circuitRanking({ nickname: null, hasCarnet: false, bestMs: res.bestMs });
              setRaceResult({
                place,
                ms: e.ms,
                laps: e.laps,
                medals: spec.medals,
                best: res.best,
                bestMs: res.bestMs,
                ranking: table.rows,
                ...crewPlace(e.ms),
              });
              res.achievements.forEach(push);
            })
            .catch((err: unknown) => console.warn('[boia] no se pudo guardar la carrera', err));
          break;
        }
        case 'invalid':
          g.setNextGate(null);
          g.setSemaphore('off');
          g.holdShip(null);
          g.setGhost(null);
          g.setRoad(null);
          g.setRouteHidden(false);
          r.offRoad.reset();
          push({
            id: `circuito:anulada:${Date.now()}`,
            kind: 'info',
            title: e.reason === 'offroad' ? msg('circuit.void.offroad') : msg('circuit.void'),
            body: msg('circuit.void.retry'),
          });
          break;
      }
    }
  };

  /** «Empezar» al llegar a la salida u «Otra vez» en la tarjeta de meta: la cuenta atrás. */
  const raceAgain = () => {
    const r = raceRef.current;
    setRaceResult(null);
    setRaceOffer(null);
    if (r && !r.race.active) raceEvents(r.race.start(r.clock));
  };

  /**
   * Lo que el mar señala ahora (T59): la Fiestera (o su destino, a bordo),
   * los códigos sin encontrar y los minijuegos sin visitar.
   */
  const spotsNow = (world: WorldConfig): GuideSpot[] =>
    guideSpots(world.objects, {
      phase: missionRef.current?.phase ?? null,
      destination: missionRef.current?.destination ?? null,
      found: {
        has: (id: string) => discoveredRef.current.has(id) || foundObjectsRef.current.has(id),
      },
      foundDiscounts: foundDiscountsRef.current,
    });

  const onWorldEvent = (e: WorldEvent) => {
    const world = worldRef.current;
    if (!world) return;
    const ctx = { sessionId, worldId: worldIdRef.current };
    const repo = gameRepository();
    const r = raceRef.current;
    if (r && e.type === 'checkpoint') {
      raceEvents(raceCheckpoint(r.race, e.objectId, r.clock));
    }
    // Junto a la salida de El Freu, sin correr: el récord (REQ-AVE-028).
    const startId = r?.spec.gates.find((g) => g.order === 0)?.objectId;
    if (r && startId && 'objectId' in e && e.objectId === startId && !r.race.active) {
      if (e.type === 'proximity_enter') {
        const place = circuitName(world) ?? msg('mar.sheet.circuito');
        void readRecord(progressApi(), r.spec)
          .then((rec) =>
            setRaceIntro(
              rec
                ? msg('circuit.idle.record', { place, time: formatRaceTime(rec.bestMs) })
                : msg('circuit.idle', { place }),
            ),
          )
          .catch(() => undefined);
      } else if (e.type === 'proximity_exit') {
        setRaceIntro(null);
        // Se aleja sin empezar: la pregunta se va con él.
        setRaceOffer(null);
      }
    }
    switch (e.type) {
      case 'reward':
        foundObjectsRef.current.add(e.objectId);
        persist(persistWorldEvent(progressApi(), e, ctx));
        break;
      case 'achievement': {
        foundObjectsRef.current.add(e.objectId);
        const s = signalFromWorldEvent(e, world);
        // Una boia nueva avisa «Boia encontrada · n de 6» (O12, T45), como en el 2D.
        if (s?.trigger === 'find_buoy') pushAll(recordBuoy(repo, s.objectId, world));
        else if (s) pushAll(recordSignal(repo, s));
        break;
      }
      case 'proximity_enter': {
        const o = world.objects.find((x) => x.identity.id === e.objectId);
        if (o?.identity.category === 'isla') {
          void discoverPlace(progressApi(), e.objectId, ctx)
            .then((first) => {
              if (first)
                push({
                  id: `descubierta:${e.objectId}`,
                  kind: 'discovery',
                  title: msg('island.firstVisit', { place: o.identity.name }),
                });
            })
            .catch(() => undefined);
        }
        if (o?.identity.category === 'remolino') whirlRef.current.enter(performance.now());
        break;
      }
      case 'proximity_exit': {
        setMinigameOffer((m) => (m?.objectId === e.objectId ? null : m));
        const o = world.objects.find((x) => x.identity.id === e.objectId);
        if (o?.identity.category === 'remolino') {
          const { tiers } = whirlRef.current.exit(performance.now());
          for (const t of tiers) {
            persist(
              grantEncounter(progressApi(), `lugar:remolino:${t.seconds}s`, t.coins, 'daily'),
            );
          }
        }
        setSheet((s) => (s && s.kind === 'preview' && s.placeId === e.objectId ? null : s));
        break;
      }
      case 'dialogue_line':
        plop();
        syncDialogue();
        break;
      case 'dialogue_reaction':
      case 'dialogue_end':
        syncDialogue();
        break;
      case 'content_open':
        // En carrera, pasar junto a una isla no abre su ficha ni anula la carrera:
        // salirse del circuito ya lo cuentan los 5 s de la carretera (T76).
        if (r?.race.active) break;
        if (e.target === 'event' && e.ref && findEvent(e.ref)) {
          // La Isla de Nochevieja vende entradas y es el destino de la Fiestera:
          // su código (la ficha del descuento) no lo tapa la ficha del evento.
          const ref = e.ref;
          setSheet((s) =>
            s?.kind === 'discount' || s?.kind === 'codes'
              ? s
              : { kind: 'event', placeId: e.objectId, eventId: ref },
          );
        } else if (e.target === 'info' || e.target === 'photos' || e.target === 'store') {
          // Otra visita a una isla ya descubierta: «Explorar la isla» (REQ-AVE-013).
          const revisit = e.target === 'info' && discoveredRef.current.has(e.objectId);
          setSheet((s) =>
            s?.kind === 'discount' || s?.kind === 'codes'
              ? s
              : {
                  kind: 'content',
                  placeId: e.objectId,
                  target: e.target as 'info',
                  ...(e.ref ? { ref: e.ref } : {}),
                  ...(revisit ? { revisit: true } : {}),
                },
          );
        }
        break;
      case 'content_close':
        discoveredRef.current.add(e.objectId);
        setSheet((s) => (s && 'placeId' in s && s.placeId === e.objectId ? null : s));
        break;
      case 'minigame':
        // Llegar a un minijuego: el delfín y las boies ya no guían hasta él (T59).
        foundObjectsRef.current.add(e.objectId);
        if (e.available && e.gameId) setMinigameOffer({ objectId: e.objectId, gameId: e.gameId });
        break;
      case 'contact':
        if (e.mode === 'block' || e.mode === 'bounce') navigator.vibrate?.(12);
        break;
      default:
        break;
    }
  };

  const onMissionEvent = (e: MissionEvent) => {
    const ctx = { worldId: worldIdRef.current };
    switch (e.type) {
      case 'croc_dive':
      case 'croc_emerge':
        plop();
        break;
      case 'rescued':
        rescueNotices.current = persistMissionEvent(gameRepository(), e, ctx).catch(() => []);
        break;
      case 'boarded': {
        chime();
        push(boardedNotice(e.missionId));
        const granted = rescueNotices.current;
        rescueNotices.current = null;
        if (granted) pushAll(granted);
        break;
      }
      case 'delivered':
        fanfare();
        engineRef.current?.celebrate(e.destination);
        push(deliveredNotice(e.missionId));
        pushAll(persistMissionEvent(gameRepository(), e, ctx));
        // El premio que importa (T59): su código de entradas, en su ficha.
        persist(deliveryDiscount(progressApi(), e, { ...ctx, sessionId }));
        break;
      default:
        break;
    }
  };

  /** Lo que hace el delfín guía (O15), aplicado al runtime del mundo de ahora. */
  const applyDolphin = (g: Mar3D, d: DolphinGuide, actions: DolphinAction[]) => {
    const rt = g.runtime;
    for (const a of actions) {
      if (a.type === 'place') rt.moveObject(d.objectId, a.x, a.y);
      else if (a.type === 'surface') {
        rt.setObjectPresent(d.objectId, true);
        setDolphinOut(true);
        plop();
      } else if (a.type === 'dive') rt.setObjectPresent(d.objectId, false);
      else if (a.type === 'gone') {
        setDolphinOut(false);
        // Seguirlo hasta el final da su premio (una vez al día).
        if (a.followed) {
          persist(grantEncounter(progressApi(), `lugar:${d.objectId}:seguir`, d.coins, 'daily'));
        }
      }
    }
  };

  /**
   * El delfín (O15, REQ-AVE-018), como en el 2D: escondido hasta que, tras
   * 2–4 minutos de mar abierto (sin carrera, ficha, viaje ni diálogo), sale
   * junto al barco y guía hacia lo más cercano sin descubrir.
   */
  const stepDolphin = (g: Mar3D, ship: ShipState, dt: number) => {
    const d = dolphinRef.current;
    const world = worldRef.current;
    if (!d || !world) return;
    if (dolphinRuntime.current !== g.runtime) {
      // Runtime nuevo (arranque o cambio de mundo): se esconde y vuelve a esperar.
      dolphinRuntime.current = g.runtime;
      d.reset();
      g.runtime.setObjectPresent(d.objectId, false);
      setDolphinOut(false);
    }
    dolphinClock.current += dt;
    if (dolphinClock.current < 0.2) return;
    const elapsed = dolphinClock.current;
    dolphinClock.current = 0;
    const calm =
      !sheetRef.current &&
      !g.dialogue() &&
      !g.voyaging &&
      !g.switching &&
      !(raceRef.current?.race.active ?? false);
    const openSea = calm && !d.active && inOpenSea(world.objects, ship);
    // T59: guía a la Fiestera, a los códigos y a los minijuegos pendientes.
    const spot = d.active || openSea ? nearestSpot(spotsNow(world), ship, 400) : null;
    const target = spot ? { id: spot.objectId, x: spot.x, y: spot.y } : null;
    const actions = d.step(elapsed, ship, { openSea, target });
    if (target && actions.some((a) => a.type === 'surface') && !dolphinOut) setDolphinTo(target.id);
    applyDolphin(g, d, actions);
  };

  /** El reloj de la carrera, su grabación y el fantasma, paso a paso (T61). */
  const stepRace = (g: Mar3D, ship: ShipState, dt: number) => {
    const r = raceRef.current;
    if (!r) return;
    r.clock += dt;
    if (!r.race.active) return;
    raceEvents(r.race.tick(r.clock));
    if (!r.race.racing) return;
    // Fuera de la carretera hay 5 s para volver; el reloj de la carrera no se para (T76).
    if (r.offRoad.step(dt, distToPath(r.path, ship, r.period))) {
      raceEvents([r.race.invalidate('offroad')!]);
      return;
    }
    const ms = r.race.elapsedMs(r.clock);
    r.recorder.sample(ms, ship);
    g.setGhost(r.ghost ? ghostPose(r.ghost, ms) : null);
  };

  const onStep = (ship: ShipState, dt: number) => {
    const g = engineRef.current;
    if (g) stepRace(g, ship, dt);
    if (g) stepDolphin(g, ship, dt);
    const m = missionRef.current;
    if (!m || !g) return;
    const evs = m.step(g.missionHost, ship, dt);
    for (const e of evs) onMissionEvent(e);
    if (m.phase !== phaseRef.current) {
      phaseRef.current = m.phase;
      setPhase(m.phase);
    }
  };

  /** Las botellas cerca del barco (T56), por el camino corto del planeta. */
  const stepBottles = (s: Stats) => {
    const w = worldRef.current;
    if (!w) return;
    const near = bottlesNear(s, marBottlesRef.current, nearBottlesRef.current, marPeriod(w));
    if (near.join() === [...nearBottlesRef.current].join()) return;
    nearBottlesRef.current = new Set(near);
    setNearBottles(near);
  };

  const onStats = (s: Stats) => {
    setStats(s);
    stepBottles(s);
    const r = raceRef.current;
    if (r) {
      const v = r.race.view(r.clock);
      if (v.phase === 'countdown' && v.countdown !== null && v.countdown < 1)
        engineRef.current?.setSemaphore('amber');
      setRace(
        v.phase === 'idle'
          ? null
          : {
              phase: v.phase,
              countdown: v.countdown,
              ms: v.elapsedMs,
              next: v.next,
              lap: v.lap,
              laps: v.laps,
              buoys: v.buoys,
              ghost: !!r.ghost,
              offRoad: r.offRoad.remaining,
            },
      );
    }
  };

  const onPin = (id: string) => {
    setSheet((s) => (s?.kind === 'discount' ? s : { kind: 'preview', placeId: id }));
  };

  // --- Botón «Entradas» (REQ-ENT-040) -----------------------------------------

  /** Abre la compra de prueba del evento, cortando el viaje si lo había. */
  const openCheckout = (eventId: string) => {
    engineRef.current?.stopVoyage();
    setTrip(null);
    setSheet((s) => (s?.kind === 'discount' ? s : null));
    setCheckoutFor(eventId);
  };

  /**
   * Termina un viaje: la compra («Entradas»), la ficha del evento («Ir a la
   * isla», `?evento=`), la del lugar (`?ir=`, T55) o nada.
   */
  const finishTrip = (t: Trip, how: VoyageEnd | 'skip') => {
    const outcome = tripOutcome(t, how);
    if (outcome === 'checkout' && t.then !== 'place') {
      openCheckout(t.eventId);
      return;
    }
    setTrip(null);
    if (outcome === 'sheet') {
      const g = engineRef.current;
      // «Saltar»: el barco llega de un salto, junto a la isla.
      if (how === 'skip' && g) {
        g.stopVoyage();
        g.startNear(t.placeId);
      }
      setArrivedAt(t.placeId);
      setSheet(arrivalSheet(t));
    }
  };

  /**
   * Un viaje en turbo hasta un lugar (T43, T55): el barco navega solo (se
   * puede «Saltar» o tomar el timón) y, al llegar, abre su ficha. Con
   * movimiento reducido llega de un salto.
   */
  const sailTrip = (next: Trip) => {
    const g = engineRef.current;
    if (!g) return;
    setMenu(false);
    setSheet(null);
    if (prefersReducedMotion() || !g.startVoyage(next.placeId)) {
      finishTrip(next, 'skip');
      return;
    }
    navigator.vibrate?.(20);
    whoosh();
    setTrip(next);
  };

  const onVoyageEnd = (placeId: string, how: VoyageEnd) => {
    const t = tripRef.current;
    if (!t || t.placeId !== placeId) return;
    finishTrip(t, how);
  };

  /**
   * «Ir a la isla» de un código (T43): el barco navega solo, en turbo, hasta
   * la isla del evento del código (se puede «Saltar» o tomar el timón) y,
   * al llegar, abre su ficha con «Tienes un código de descuento para este
   * evento». Con movimiento reducido llega de un salto.
   */
  const goToIsland = (eventId: string) => {
    const w = worldRef.current;
    const next = w ? islandTrip(w, eventId) : null;
    if (next) sailTrip(next);
  };

  /**
   * «Entradas» (T58): abre «Elige tu evento» dentro del mar (otro toque lo
   * cierra). Durante un viaje hacia una compra, el toque llega ya y la abre.
   */
  const onTickets = () => {
    const current = tripRef.current;
    if (current) {
      finishTrip(current, 'skip');
      return;
    }
    if (entradas) setEntradas(false);
    else openEntradas();
  };

  /** «Comprar entrada» en «Elige tu evento» (T58): el checkout encima, sin salir del mar. */
  const buyFromPanel = (eventId: string) => {
    track('ticket_click_out', { eventId, source: 'world' });
    openCheckout(eventId);
  };

  /**
   * «Ir a su isla» en «Elige tu evento»: turbo (o vuelo, el experimento)
   * hasta la isla del evento y, al llegar, su checkout. Tocar «Entradas» (o
   * «Saltar») durante el viaje lo abre ya; con movimiento reducido, directo.
   */
  const sailToTickets = (eventId: string) => {
    setEntradas(false);
    const w = worldRef.current;
    const island = w ? islandOfEvent(w, eventId) : null;
    if (!island) {
      openCheckout(eventId);
      return;
    }
    const next: Trip = { placeId: island.identity.id, placeName: island.identity.name, eventId };
    const g = engineRef.current;
    const started = g
      ? ticketsFly()
        ? g.startFlight(next.placeId)
        : g.startVoyage(next.placeId)
      : false;
    if (prefersReducedMotion() || !started) {
      openCheckout(next.eventId);
      return;
    }
    navigator.vibrate?.(20);
    whoosh();
    setSheet((s) => (s?.kind === 'discount' ? s : null));
    setTrip(next);
  };

  /** Un golpe (T46): suena según lo fuerte que fue, sin repetirse en el mismo choque. */
  const onImpact = (speed: number) => {
    const now = performance.now();
    if (now < bumpCooldown.current) return;
    bumpCooldown.current = now + BUMP_COOLDOWN_MS;
    bump(Math.min(1, speed / BUMP_FULL_SPEED));
    navigator.vibrate?.(12);
  };

  const handlers = useRef({ onWorldEvent, onStep, onStats, onPin, onVoyageEnd, onImpact });
  handlers.current = { onWorldEvent, onStep, onStats, onPin, onVoyageEnd, onImpact };

  // --- Arranque ---------------------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    let cancelled = false;
    let engine: Mar3D | null = null;
    const saved = readPref(MOOD_KEY);
    const startMood: MoodId = MOOD_IDS.includes(saved as MoodId) ? (saved as MoodId) : 'tarde';
    setMood(startMood);

    (async () => {
      const chosen = currentWorld(window.location.search, await adminWorldId());
      const live = await liveWorld(gameRepository(), worlds, chosen);
      // El mundo compacto de /mar (T50): el mapa compartido a escala, sin tocarlo.
      const world = marWorld(live.config);
      // three.js, el mar y el barco llegan aparte: la página pinta su pantalla de carga antes.
      const [{ Mar3D }, shipList] = await Promise.all([
        import('./engine/mar3d'),
        // Con las variantes del catálogo (T59: el barco exclusivo de la Fiestera).
        loadShipManifest().then((list) => withShipVariants(list, shipCatalogRef.current)),
      ]);
      // El barco del 2D: ?estilo= o lo equipado en la tienda (T40), si es tuyo;
      // si no, el del mundo.
      const want = await storedLook(progressApi(), live.theme.ship, window.location.search);
      const entry =
        shipList.find((b) => b.id === want.style) ??
        shipList.find((b) => b.id === live.theme.ship.style) ??
        shipList.find((b) => b.id === 'arcilla') ??
        shipList[0];
      const shipModel = entry ? await loadShipModel(entry, want.skin).catch(() => null) : null;
      if (cancelled) return;
      worldRef.current = world;
      liveRef.current = live;
      worldIdRef.current = live.id;
      setWorldName(live.theme.name);
      setWorldId(live.id);
      // `?delfin=<s>`: el delfín sale tras esos segundos de mar abierto (pruebas y demos).
      const every = Number(new URLSearchParams(window.location.search).get(DOLPHIN_PARAM));
      dolphinRef.current = findDolphinGuide(
        world.objects,
        every > 0 ? { tuning: { minInterval: every, maxInterval: every } } : undefined,
      );
      raceRef.current = newRace(world);

      const mspec = rescueMissionOf(world);
      const mission = mspec ? new RescueMission(world, mspec) : null;
      if (mission && mspec) {
        const savedMission = await loadMission(progressApi(), mspec.missionId).catch(() => null);
        mission.restore(savedMission);
      }
      if (cancelled) return;
      missionRef.current = mission;
      phaseRef.current = mission?.phase ?? null;
      // Entregada antes de que la entrega diera código (T59): se le da ahora, una vez.
      if (mission?.phase === 'delivered') {
        void missedDeliveryDiscount(
          progressApi(),
          mission.missionId,
          missionDiscountOf(world.objects, mission.destination),
          { sessionId, worldId: live.id },
        )
          .then((outs) => outs.forEach((o) => pushRef.current(o.notice)))
          .catch(() => undefined);
      }

      engine = new Mar3D({
        canvas,
        overlay,
        world,
        mood: startMood,
        sea: live.theme.sea,
        pins: pinsOf(world, mission?.phase ?? null),
        avoid: () => canvas.parentElement?.querySelectorAll(PIN_AVOID) ?? [],
        runtime: {
          ticketAvailable,
          minigames: MINIGAME_REGISTRY,
          sessionId,
          seasonId: live.id,
          // Bocadillos con tiempo de lectura (D-22), como en el 2D.
          readableDialogue: true,
          seed: (Date.now() % 2147483646) + 1,
        },
        onWorldEvent: (e) => handlers.current.onWorldEvent(e),
        onStep: (s, dt) => handlers.current.onStep(s, dt),
        onStats: (s) => handlers.current.onStats(s),
        onPin: (id) => handlers.current.onPin(id),
        onVoyageEnd: (id, how) => handlers.current.onVoyageEnd(id, how),
        onImpact: (speed) => handlers.current.onImpact(speed),
        // Las rampas de Los Rápidos (T73): despegue y chapuzón.
        onJump: (e) => (e.type === 'jump' ? whoosh() : plop()),
        raceStartLabel: msg('mar.race.startBanner'),
        onSwitch: (mode) => setSwitching(mode),
      });
      engineRef.current = engine;
      engine.setShipDressing(dressingFor(want.equipped));
      if (shipModel) engine.setShipModel(shipModel);
      setShips(shipList);
      const look = shipModel ? { style: shipModel.id, skin: shipModel.skin } : null;
      setShipLook(look);
      if (look && want.source === 'url' && look.style === want.style) {
        rememberLook(look);
        void equipLook(progressApi(), look);
      }
      const near = new URLSearchParams(window.location.search).get('cerca');
      // Enlaces profundos (T55): `?ir=`/`?evento=` navegan a su isla y `?menu=`
      // abre un panel cuando el mar está listo; se quitan ya de la URL.
      const links = readMarLinks(window.location.search);
      if (near) links.sail = null;
      linksRef.current = links;
      if (hasMarLinks(links)) {
        history.replaceState(history.state, '', withoutMarLinks(window.location.href));
      }
      // REQ-IDE-004 (T44): al recargar, el barco sigue donde estaba y con su rumbo.
      const positions = devicePositions();
      const restore =
        !near &&
        positions &&
        shouldRestorePosition({
          navigationType: documentNavigationType(),
          bootedBefore: bootedInDocument,
          handedOver: false,
          placeRequested: !!links.sail,
        })
          ? loadShipPosition(positions)
          : null;
      bootedInDocument = true;
      if (near) engine.startNear(near);
      else if (restore) engine.moveShip(restore.x, restore.y, restore.heading);
      setPhase(mission?.phase ?? null);
      setStatus('ready');
      // Lo descubierto en otras visitas: sus islas ofrecen «Explorar la isla»
      // y el delfín no guía hasta lo ya encontrado.
      void discoveredPlaces(progressApi())
        .then((ids) => ids.forEach((id) => discoveredRef.current.add(id)))
        .catch(() => undefined);
      void progressApi()
        .discoveries()
        .then((list) => {
          for (const { key } of list) {
            const m = /^objeto:[^:]+:(.+)$/.exec(key);
            if (m) foundObjectsRef.current.add(m[1]!);
          }
        })
        .catch(() => undefined);
    })().catch((err: unknown) => {
      console.error('[boia] el mar 3D no pudo arrancar', err);
      if (!cancelled) setStatus('error');
    });

    return () => {
      cancelled = true;
      engine?.destroy();
      engineRef.current = null;
    };
  }, [sessionId]);

  // Pines: la Fiestera deja de tener rótulo cuando sube a bordo.
  useEffect(() => {
    const g = engineRef.current;
    const w = worldRef.current;
    if (g && w) g.setPins(pinsOf(w, phase));
  }, [phase]);

  // El bocadillo sigue a quien habla.
  useEffect(() => {
    const g = engineRef.current;
    const el = bubbleRef.current;
    if (!g || !el) return;
    if (dialogue) g.anchor(el, dialogue.objectId, 1.4);
    return () => g.release(el);
  }, [dialogue]);

  // Navegar en este mundo cuenta (logro «Entre dos mundos»), con su aviso,
  // como al arrancar el 2D (T37: antes sólo se apuntaba, sin aviso).
  useEffect(() => {
    if (status !== 'ready') return;
    pushAll(
      recordSignal(gameRepository(), { trigger: 'visit_world', worldId: worldIdRef.current }),
    );
  }, [status, pushAll]);

  // Sonido (T46, O10): el primer gesto lo desbloquea (también en iOS), ocultar
  // la pestaña lo pausa, y al salir del mar se calla el ambiente.
  // Los cambios de Ajustes se aplican al cambiarlos (`updateSettings`).
  useEffect(() => {
    const off = installAudioLifecycle();
    if (settingsRef.current) applyAudioSettings(settingsRef.current);
    return () => {
      off();
      setAmbientWorld(null);
    };
  }, []);
  // Un loop de ambiente por mundo: cambia con el mundo.
  useEffect(() => {
    if (worldId) setAmbientWorld(worldId);
  }, [worldId]);

  // La posición del barco (REQ-IDE-004, T44): cada poco mientras se navega y
  // al irse; una recarga la restaura (arranque, arriba).
  useEffect(() => {
    if (status !== 'ready') return;
    const store = devicePositions();
    if (!store) return;
    let last: { x: number; y: number; heading: number } | null = null;
    const save = () => {
      const g = engineRef.current;
      // En pleno vuelo el barco no está en el agua: se guarda al posarse.
      if (!g || g.voyaging) return;
      const now = { x: g.ship.x, y: g.ship.y, heading: g.ship.heading };
      if (!movedEnough(last, now)) return;
      last = now;
      saveShipPosition(store, now);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') save();
    };
    const id = window.setInterval(save, SHIP_POSITION_SAVE_MS);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', save);
    return () => {
      save();
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', save);
    };
  }, [status]);

  // Tiempo a bordo (logros de tiempo jugado), sólo con la pestaña a la vista.
  useEffect(() => {
    if (status !== 'ready') return;
    const t = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      pushAll(
        recordSignal(gameRepository(), { trigger: 'time_played', seconds: TIME_PLAYED_TICK_S }),
      );
    }, TIME_PLAYED_TICK_S * 1000);
    return () => window.clearInterval(t);
  }, [status, pushAll]);

  // La tarjeta de abajo (T53: encima de la barra) tapa parte del mar en el
  // móvil: la cámara sube el barco por encima de ella, también al abrirla.
  // «Entradas» va en la barra y la tarjeta nunca la tapa.
  useEffect(() => {
    const g = engineRef.current;
    if (!g) return;
    const el = document.querySelector<HTMLElement>('.mar-sheet, .mar .juego-panel');
    const measure = () => {
      const narrow = window.innerWidth < 760;
      // offsetTop no cuenta la animación de entrada (un transform).
      const box = el?.offsetParent?.clientHeight ?? window.innerHeight;
      g.setBottomInset(el && narrow ? Math.max(0, box - el.offsetTop) : 0);
    };
    measure();
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sheet, minigameOffer, status]);

  // Encima del mar hay un diálogo modal o un minijuego: sin control (y sin pintar).
  useEffect(() => {
    const g = engineRef.current;
    if (!g) return;
    g.inputEnabled =
      !checkoutFor &&
      !minigameOpen &&
      !logros &&
      !tienda &&
      !hoja &&
      !entradas &&
      !bottleSheet &&
      !ranking &&
      !menu;
    g.paused = minigameOpen;
  }, [
    checkoutFor,
    minigameOpen,
    logros,
    tienda,
    hoja,
    entradas,
    bottleSheet,
    ranking,
    menu,
    status,
  ]);

  // Las botellas del repositorio en el mar (T56): con cada cambio y con cada mundo.
  useEffect(() => {
    const g = engineRef.current;
    const w = worldRef.current;
    if (status !== 'ready' || !g || !w || !bottleList) return;
    const placed = placeBottles(bottleList, seaWorld(), w, bottleMap());
    marBottlesRef.current = placed;
    g.setBottles(placed);
  }, [bottleList, status, worldId]);

  // Bandera y estela equipadas (T40), también si cambian desde otra pestaña.
  useEffect(() => {
    if (status !== 'ready' || !equippedNow) return;
    engineRef.current?.setShipDressing(dressingFor(equippedNow));
  }, [equippedNow, status]);

  /** Abre el panel de logros; como cualquier panel, anula la vuelta en curso (REQ-AVE-032). */
  const openLogros = () => {
    const r = raceRef.current;
    if (r?.race.active) raceEvents([r.race.invalidate('panel')!].filter(Boolean));
    setMenu(false);
    setHoja(null);
    setEntradas(false);
    setLogros(true);
  };

  /** Abre un panel de a bordo (Mi Carnet, Ajustes…, T55); también anula la vuelta en curso. */
  const openPanel = (panel: MarPanel) => {
    if (panel === 'logros') {
      openLogros();
      return;
    }
    const r = raceRef.current;
    if (r?.race.active) raceEvents([r.race.invalidate('panel')!].filter(Boolean));
    setMenu(false);
    setLogros(false);
    setTienda(false);
    setEntradas(false);
    setBottleSheet(null);
    setRanking(false);
    setCarnetForCheckout(null);
    setHoja(panel);
  };

  /** «Elige tu evento» (T58): como un panel de a bordo, anula la vuelta en curso. */
  const openEntradas = () => {
    const r = raceRef.current;
    if (r?.race.active) raceEvents([r.race.invalidate('panel')!].filter(Boolean));
    setMenu(false);
    setLogros(false);
    setTienda(false);
    setHoja(null);
    setBottleSheet(null);
    setRanking(false);
    setEntradas(true);
    track('tickets_panel_open', { source: 'world' });
  };

  // Los enlaces profundos (T55), una vez con el mar listo: el panel pedido y
  // el viaje hasta la isla del enlace (sale navegando; al llegar, su ficha).
  useEffect(() => {
    if (status !== 'ready') return;
    const links = linksRef.current;
    linksRef.current = null;
    const w = worldRef.current;
    if (!links || !w) return;
    if (links.menu) openPanel(links.menu);
    const next = links.sail ? linkTrip(w, links.sail, eventIdOf) : null;
    if (next) sailTrip(next);
    // Una vez, al estar listo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    // La capa del minijuego se monta en su propio nodo: se observa si tiene hijos.
    const host = document.querySelector('[data-testid="minijuego-capa"]');
    if (!host) return;
    const mo = new MutationObserver(() => setMinigameOpen(host.childElementCount > 0));
    mo.observe(host, { childList: true });
    return () => mo.disconnect();
  }, [status]);

  const chooseMood = (m: MoodId) => {
    setMood(m);
    writePref(MOOD_KEY, m);
    engineRef.current?.setMood(m);
  };

  /** Equipar en la tienda (T40): el modelo de ese estilo en esa skin, en el agua. */
  const shipRequest = useRef(0);
  const chooseShip = (look: ShipLook, remember = true) => {
    const entry = ships.find((b) => b.id === look.style);
    if (!entry) return;
    const request = ++shipRequest.current;
    setShipPending(true);
    loadShipModel(entry, look.skin)
      .then((m) => {
        if (request !== shipRequest.current || !engineRef.current) return;
        engineRef.current.setShipModel(m);
        const applied = { style: m.id, skin: m.skin };
        setShipLook(applied);
        // El barco del mundo (tras un cambio de mundo) no se apunta como elegido.
        if (remember) {
          rememberLook(applied);
          syncStyleParam(applied.style);
        }
      })
      .catch((err: unknown) => console.warn('[boia] no se pudo cargar el barco', err))
      .finally(() => {
        if (request === shipRequest.current) setShipPending(false);
      });
  };

  /** Abre la botella o el ranking (T56); como cualquier panel, anula la vuelta en curso. */
  const openSheet = (open: () => void) => {
    const r = raceRef.current;
    if (r?.race.active) raceEvents([r.race.invalidate('panel')!].filter(Boolean));
    setMenu(false);
    setLogros(false);
    setHoja(null);
    setEntradas(false);
    open();
  };
  const openBottle = (mode: BottleSheetMode) => openSheet(() => setBottleSheet(mode));
  const openRanking = () => openSheet(() => setRanking(true));

  /** Dónde cae la botella propia: junto a la popa del barco, guardada en el mapa compartido. */
  const bottleDrop = () => {
    const g = engineRef.current;
    const w = worldRef.current;
    return g && w ? dropSpot(seaWorld(), w, g.ship, bottleMap()) : null;
  };

  /** Abre la tienda «Barco»; como cualquier panel, anula la vuelta en curso. */
  const openTienda = () => {
    const r = raceRef.current;
    if (r?.race.active) raceEvents([r.race.invalidate('panel')!].filter(Boolean));
    setMenu(false);
    setHoja(null);
    setTienda(true);
  };

  /**
   * El menú del juego (T65): cierra la sección abierta y vuelve a él (el
   * botón de la izquierda y «‹ Menú» de cada sección).
   */
  const openMenu = () => {
    setAyuda(null);
    setLogros(false);
    setTienda(false);
    setHoja(null);
    setEntradas(false);
    setBottleSheet(null);
    setRanking(false);
    setSheet((s) => (s?.kind === 'codes' ? null : s));
    setMenu(true);
  };

  /** Una sección del menú del juego, en su hoja (con «‹ Menú» para volver). */
  const openSection = (section: MenuSection) => {
    switch (section) {
      case 'logros':
        openLogros();
        return;
      case 'barco':
        openTienda();
        return;
      case 'codigos':
        setMenu(false);
        setSheet({ kind: 'codes' });
        return;
      case 'botella':
        openBottle({ kind: 'mine' });
        return;
      case 'ranking':
        openRanking();
        return;
      default:
        openPanel(section);
    }
  };

  const courseTo = (placeId: string) => {
    const g = engineRef.current;
    if (!g) return;
    g.setCourse({ placeId });
    if (g.zoomLevel >= 0.5) g.backToBoat();
    setSheet(null);
    setAyuda(null);
  };

  /** El «?» (T68): el objetivo de ahora y la pista más cercana al barco; otro toque lo cierra. */
  const toggleAyuda = () => {
    const g = engineRef.current;
    const w = worldRef.current;
    if (ayuda || !g || !w) {
      setAyuda(null);
      return;
    }
    setAyuda(helpNow(spotsNow(w), missionRef.current?.phase ?? null, g.ship));
  };

  /** Ir en nave a un lugar (experimento): despega, vuela y se posa en su orilla. */
  const flyTo = (placeId: string) => {
    const g = engineRef.current;
    if (!g) return;
    // Sin animaciones (o si no despega), navega como siempre.
    if (prefersReducedMotion() || !g.startFlight(placeId)) {
      courseTo(placeId);
      return;
    }
    navigator.vibrate?.(20);
    setSheet(null);
  };

  const steerToEvent = (eventId: string): boolean => {
    const w = worldRef.current;
    const o = w ? islandOfEvent(w, eventId) : null;
    if (!o) return false;
    courseTo(o.identity.id);
    return true;
  };

  // --- Cambio de mundo (T41 en el 2D, T51 aquí) -----------------------------
  // Mismo mapa, otra piel: el mundo cae a un agujero negro centrado en el
  // barco, se cambia a oscuras y el nuevo se despliega; con movimiento
  // reducido, un fundido. El barco sigue donde está, con su misión.
  const worldRequest = useRef(0);
  /** El último mundo pedido (el que acabará en pantalla). */
  const wantedWorld = useRef<string | null>(null);
  const switchWorld = (chosen: ComposedWorld) => {
    const g = engineRef.current;
    if (!g || chosen.id === (wantedWorld.current ?? worldIdRef.current)) return;
    wantedWorld.current = chosen.id;
    const request = ++worldRequest.current;
    setWorldPending(true);
    setSheet(null);
    setTrip(null);
    let next = chosen;
    let nextWorld: WorldConfig | null = null;
    liveWorld(gameRepository(), worlds, chosen)
      .then((live) => {
        next = live;
        nextWorld = marWorld(live.config);
        return g.setWorld(nextWorld, {
          sea: live.theme.sea,
          runtime: { seasonId: live.id },
          transition: prefersReducedMotion() ? 'fade' : 'vortex',
        });
      })
      .then((ok) => {
        if (!ok || !nextWorld || request !== worldRequest.current || engineRef.current !== g)
          return;
        const w = nextWorld;
        worldRef.current = w;
        liveRef.current = next;
        worldIdRef.current = next.id;
        setWorldId(next.id);
        setWorldName(next.theme.name);
        syncWorldParam(next.id);
        // La misión sigue (mismo paso, mismo destino guardado) con la piel del mundo nuevo.
        missionRef.current?.setWorld(w);
        g.setPins(pinsOf(w, phaseRef.current));
        // El circuito es el mismo en cada mundo (El Freu, El Penyal): sin carrera a medias.
        if (raceRef.current?.race.active) {
          engineRef.current?.holdShip(null);
          engineRef.current?.setGhost(null);
          engineRef.current?.setNextGate(null);
          engineRef.current?.setSemaphore('off');
          engineRef.current?.setRoad(null);
        }
        engineRef.current?.setRouteHidden(false);
        raceRef.current = newRace(w);
        setRace(null);
        setRaceIntro(null);
        setRaceOffer(null);
        // Sin barco elegido (ni en la URL ni equipado), el del mundo nuevo (T40).
        void storedLook(progressApi(), next.theme.ship, window.location.search).then((want) => {
          if (want.source !== 'world') return;
          const now = shipLookRef.current;
          if (!now || want.style !== now.style || want.skin !== now.skin) {
            chooseShip({ style: want.style, skin: want.skin }, false);
          }
        });
      })
      .catch((err: unknown) => {
        console.warn('[boia] no se pudo cambiar de mundo', err);
        if (request === worldRequest.current) wantedWorld.current = null;
      })
      .finally(() => {
        if (request === worldRequest.current) setWorldPending(false);
      });
  };

  /** El visitante elige un mundo (menú «Mundos»): se recuerda en este navegador. */
  const chooseWorld = (id: string) => {
    if (!engineRef.current || id === (wantedWorld.current ?? worldIdRef.current)) return;
    const chosen = chooseWorldIn(worlds, visitorWorldChoice(), id);
    setMenu(false);
    if (chosen) switchWorld(chosen);
  };

  // El Admin cambia el mundo activo (T26) con /mar abierto (otra pestaña):
  // quien no eligió mundo ni lo trae en la URL pasa a él por el agujero negro.
  const switchWorldRef = useRef(switchWorld);
  switchWorldRef.current = switchWorld;
  useEffect(() => {
    if (status !== 'ready') return;
    let alive = true;
    const off = gameRepository().subscribe((change) => {
      if (!change.areas.includes('content')) return;
      void adminWorldId().then((adminId) => {
        if (alive) switchWorldRef.current(currentWorld(window.location.search, adminId));
      });
    });
    return () => {
      alive = false;
      off();
    };
  }, [status]);

  // Invitaciones al Carnet (T44, REQ-IDE-008/009): nunca sobre una carrera,
  // un diálogo, la compra, un panel o un cambio de mundo; esperan a que acaben.
  const inviteBlocked =
    !!sheet ||
    !!dialogue ||
    !!race ||
    !!raceResult ||
    !!raceOffer ||
    !!checkoutFor ||
    !!trip ||
    !!switching ||
    minigameOpen ||
    logros ||
    tienda ||
    !!hoja ||
    entradas ||
    !!bottleSheet ||
    ranking ||
    menu;
  const invitations = useCarnetInvitations({
    running: status === 'ready',
    blocked: inviteBlocked,
  });
  const inviteTrigger = invitations.trigger;
  // Al cerrar la galería del Puerto de Fotos.
  const galleryOpen = sheet?.kind === 'content' && sheet.target === 'photos';
  const wasGallery = useRef(false);
  useEffect(() => {
    if (wasGallery.current && !galleryOpen) inviteTrigger('gallery');
    wasGallery.current = galleryOpen;
  }, [galleryOpen, inviteTrigger]);
  const purchasedRef = useRef(false);

  const world = worldRef.current;
  // Los rótulos también van al minimapa (la isla del evento, destacada).
  // En carrera (T73), también la boia que toca, destacada: el trazado cruza el mapa.
  const raceNext = race?.phase === 'racing' ? race.next : null;
  const pins = useMemo(() => {
    if (!world) return [];
    const list = pinsOf(world, phase);
    const r = raceRef.current;
    if (raceNext === null || !r) return list;
    const target = lapTargets(world, r.spec)[raceNext - 1];
    if (!target) return list;
    const text =
      raceNext > r.spec.buoys
        ? msg('mar.race.chip.finish')
        : msg('mar.race.chip.buoy', { next: raceNext, buoys: r.spec.buoys });
    return [
      ...list.filter((p) => p.id !== target.id),
      { id: target.id, text, icon: '🎯', accent: true, always: true },
    ];
  }, [world, phase, raceNext]);
  // Los «?» del minimapa (T59): los códigos por encontrar, donde están.
  const missionDestination = missionRef.current?.destination ?? null;
  const marks = useMemo<MinimapMark[]>(() => {
    if (!world) return [];
    const found = new Set((foundDiscountList ?? []).map((f) => f.discount.id));
    return discountMarks(
      guideSpots(world.objects, {
        phase,
        destination: missionDestination,
        found: { has: () => false },
        foundDiscounts: found,
      }),
    ).map((m) => ({ placeId: m.placeId, discountId: m.discountId!, x: m.x, y: m.y }));
  }, [world, phase, missionDestination, foundDiscountList]);
  const sheetObject = useMemo(() => {
    if (!sheet || !('placeId' in sheet) || !world) return undefined;
    const placeId = sheet.placeId;
    return world.objects.find((o) => o.identity.id === placeId);
  }, [sheet, world]);

  const engine = engineRef.current;
  const ship = engine?.ship;
  // Por el camino más corto: el planeta da la vuelta (D-22).
  const distance =
    sheet && sheet.kind === 'preview' && sheetObject && ship && engine
      ? Math.round(
          engine.runtime.distance(ship.x, ship.y, sheetObject.position.x, sheetObject.position.y) *
            0.25,
        )
      : null;

  const courseName = (c: CourseInfo) =>
    c.placeId
      ? (world?.objects.find((o) => o.identity.id === c.placeId)?.identity.name ??
        msg('mar.client.destino'))
      : msg('mar.client.puntoMarcado');

  const turboReady = (stats?.turboReady ?? 1) >= 1;
  const countdown =
    race?.phase === 'countdown' && race.countdown !== null ? Math.ceil(race.countdown) : null;

  return (
    <main
      className="mar"
      data-status={status}
      data-mood={mood}
      data-flight={stats?.flight ?? undefined}
      data-ship-style={shipLook?.style}
      data-ship-skin={shipLook?.skin}
      data-ship-flag={shipLook ? equippedNow?.flag : undefined}
      data-ship-wake={shipLook ? equippedNow?.wake : undefined}
      data-mundo={worldId ?? undefined}
      data-cambio-mundo={
        switching === 'vortex' ? 'vortice' : switching === 'fade' ? 'fundido' : undefined
      }
      data-barco={stats ? `${Math.round(stats.x)},${Math.round(stats.y)}` : undefined}
      data-delfin={dolphinOut ? 'guiando' : undefined}
      data-delfin-hacia={dolphinOut && dolphinTo ? dolphinTo : undefined}
      data-mision={phase ?? undefined}
      data-modelos={stats?.models}
      data-llegada={arrivedAt ?? undefined}
      data-giro={stats ? `${stats.sensitivity.keyboard},${stats.sensitivity.touch}` : undefined}
    >
      <canvas
        ref={canvasRef}
        className="mar-canvas"
        data-testid="mar-canvas"
        aria-label={msg('mar.client.elMarDeBoia')}
      />
      <div ref={overlayRef} className="mar-overlay" />
      {/* Líneas de velocidad del vuelo de «Entradas» (sólo se ven en crucero). */}
      <div className="mar-speedlines" aria-hidden="true" />

      {status !== 'ready' ? (
        <div className="mar-splash" role="status">
          {status === 'error' ? (
            <>
              <p className="mar-splash__title">{msg('error.3d.title')}</p>
              <p>{msg('error.3d.body')}</p>
              <Link
                className="mar-btn mar-btn--primary"
                href="/#tickets"
                data-testid="mar-sin-3d-entradas"
              >
                {msg('error.3d.cta')}
              </Link>
            </>
          ) : (
            <>
              <div className="mar-splash__boia" aria-hidden="true" />
              <p className="mar-splash__title">{msg('mar.client.preparandoElMar')}</p>
            </>
          )}
        </div>
      ) : null}

      {/* El velo de la entrada (T64): la misma pantalla de carga, que se funde al estar listo. */}
      {velo && status !== 'error' ? (
        <div
          className="mar-velo"
          data-testid="mar-velo"
          data-out={status === 'ready' ? '' : undefined}
          aria-hidden="true"
        >
          <div className="mar-splash__boia" />
          <p className="mar-splash__title">{msg('mar.client.preparandoElMar')}</p>
        </div>
      ) : null}

      {/* Arriba (T65): los enlaces a la web; Carnet no sale del juego (abre el
          menú en Mi Carnet). Debajo, el minimapa (tocarlo abre el mapa grande,
          T34) y los saldos. */}
      {status === 'ready' ? (
        <nav className="mar-links" data-testid="mar-enlaces" aria-label={msg('mar.hud.enlaces')}>
          {LANDING_LINKS.map(([id, key, href]) => (
            <a key={id} className="mar-links__item" href={href} data-testid={`mar-enlace-${id}`}>
              {msg(key)}
            </a>
          ))}
          <button
            type="button"
            className="mar-links__item"
            data-testid="mar-enlace-carnet"
            aria-haspopup="dialog"
            aria-label={msg('mar.hud.carnetAria')}
            onClick={() => openPanel('carnet')}
          >
            {msg('mar.hud.carnet')}
          </button>
        </nav>
      ) : null}
      <header className="mar-top">
        {status === 'ready' ? (
          <div className={`mar-globe${stats?.mapMode ? ' is-map' : ''}`}>
            <MarMinimap
              engineRef={engineRef}
              pins={pins}
              marks={marks}
              mapMode={!!stats?.mapMode}
              onToggle={() => engineRef.current?.toggleMap()}
            />
          </div>
        ) : null}
        <div
          className="mar-balances"
          data-testid="mar-saldos"
          aria-label={msg('mar.client.saldos')}
        >
          <span title={msg('mar.client.puntos')}>★ {balances?.points ?? '–'}</span>
          <span title={msg('mar.client.monedas')}>🪙 {balances?.coins ?? '–'}</span>
        </div>
      </header>

      {/* A la izquierda (T65): el menú del juego, con el icono de logros y su
          número de premios por reclamar. */}
      {status === 'ready' ? (
        <button
          type="button"
          className="mar-menu-btn mar-logros-btn"
          data-testid="mar-logros"
          data-por-reclamar={readyToClaim}
          aria-label={claimLabel(msg('mar.menu.titulo'), readyToClaim)}
          aria-expanded={menu}
          aria-haspopup="dialog"
          title={claimLabel(msg('mar.menu.titulo'), readyToClaim)}
          onClick={() => (menu ? setMenu(false) : openMenu())}
        >
          <span aria-hidden="true">🏆</span>
          <small aria-hidden="true">{msg('mar.client.menu')}</small>
          <ClaimBadge count={readyToClaim} testId="mar-logros-contador" />
        </button>
      ) : null}

      {/* Debajo, el «?» de ayuda (T68): el objetivo y una pista, con su rumbo. */}
      {status === 'ready' ? (
        <button
          type="button"
          className="mar-ayuda-btn"
          data-testid="mar-ayuda-abrir"
          aria-label={msg('mar.ayuda.boton')}
          title={msg('mar.ayuda.boton')}
          aria-expanded={!!ayuda}
          onClick={toggleAyuda}
        >
          ?
        </button>
      ) : null}
      {ayuda && status === 'ready' ? (
        <MarAyuda help={ayuda} world={world} onCourse={courseTo} onClose={() => setAyuda(null)} />
      ) : null}

      {menu ? (
        <MarMenu
          worldName={worldName}
          readyToClaim={readyToClaim}
          mood={mood}
          hasShips={ships.length > 0}
          shipName={
            shipLook
              ? (shipCatalog?.styles.find((st) => st.id === shipLook.style)?.name ?? shipLook.style)
              : null
          }
          worlds={worlds.list()}
          worldId={worldId ?? ''}
          worldPending={worldPending}
          catalog={shipCatalog}
          onOpen={openSection}
          onMood={chooseMood}
          onWorld={chooseWorld}
          onClose={() => setMenu(false)}
        />
      ) : null}

      {/* Avisos (T53): un chip pequeño arriba que se va solo (tiempo de lectura, D-22). */}
      <div className="mar-notices" role="status" aria-live="polite">
        {notices.current ? (
          <div
            key={`${notices.current.notice.id}@${notices.current.shownAt}`}
            className={`mar-notice is-${notices.current.notice.kind}`}
          >
            <button
              type="button"
              className="mar-notice__body"
              data-testid="mar-aviso"
              data-kind={notices.current.notice.kind}
              onClick={() => {
                // «¡Logro completado! Reclama tu premio»: tocarlo lleva al panel (T37).
                const toClaim = notices.current?.notice.kind === 'achievement';
                notices.dismiss();
                if (toClaim) openLogros();
              }}
            >
              <span className="mar-notice__icon" aria-hidden="true">
                {NOTICE_ICON[notices.current.notice.kind]}
              </span>
              <span className="mar-notice__text">
                <strong>{notices.current.notice.title}</strong>
                {notices.current.notice.body ? <small>{notices.current.notice.body}</small> : null}
              </span>
            </button>
            <button
              type="button"
              className="mar-notice__x"
              data-testid="mar-aviso-cerrar"
              aria-label={msg('mar.client.cerrarAviso')}
              onClick={notices.dismiss}
            >
              ×
            </button>
          </div>
        ) : null}
      </div>

      {invitations.reason && !inviteBlocked ? (
        <CarnetInvite
          className="mar-invite"
          reason={invitations.reason}
          create={{
            onCreate: () => {
              invitations.dismiss();
              openPanel('carnet');
            },
          }}
          onLater={invitations.decline}
        />
      ) : null}

      {/* Un cambio de mundo: el agujero negro se ve en el lienzo; esto lo anuncia. */}
      {switching ? (
        <p className="mar-switch" data-testid="cambio-mundo" role="status">
          {msg('mar.client.entreDosMundos')}
        </p>
      ) : null}

      {/* Rumbo, circuito y misión */}
      <div className="mar-chips">
        {race ? <MarRaceChip race={race} /> : null}
        {!race && raceOffer ? (
          <MarRaceOffer offer={raceOffer} onStart={raceAgain} onClose={() => setRaceOffer(null)} />
        ) : null}
        {!race && !raceOffer && raceResult ? (
          <MarRaceResult
            result={raceResult}
            onAgain={raceAgain}
            onClose={() => setRaceResult(null)}
          />
        ) : null}
        {!race && !raceOffer && !raceResult && raceIntro ? <MarRaceIntro text={raceIntro} /> : null}
        {stats?.course ? (
          <div className="mar-chip mar-chip--course" data-testid="mar-rumbo-activo">
            🧭 {courseName(stats.course)} · {stats.course.meters} m
            <button
              type="button"
              className="mar-chip__x"
              aria-label={msg('mission.route.clear')}
              onClick={() => engineRef.current?.setCourse(null)}
            >
              ×
            </button>
          </div>
        ) : null}
      </div>

      {countdown !== null ? (
        <div className="mar-countdown" aria-live="assertive" key={countdown}>
          {countdown > 0 ? countdown : msg('mar.client.ya')}
        </div>
      ) : null}

      {/* Controles de la derecha */}
      <div className="mar-rail" aria-label={msg('mar.client.zoom')}>
        <button
          type="button"
          className="mar-round"
          aria-label={msg('mar.client.acercar')}
          onClick={() => engineRef.current?.zoomBy(-0.14)}
        >
          +
        </button>
        <div className="mar-zoom" aria-hidden="true">
          <span style={{ height: `${Math.round((1 - (stats?.zoom ?? 0)) * 100)}%` }} />
        </div>
        <button
          type="button"
          className="mar-round"
          aria-label={msg('mar.client.alejar')}
          onClick={() => engineRef.current?.zoomBy(0.14)}
        >
          −
        </button>
      </div>

      <div className="mar-speed" aria-hidden="true">
        <strong>{stats?.knots ?? 0}</strong>
        <small>{msg('mar.client.nudos')}</small>
      </div>

      {stats?.mapMode && !sheet ? (
        <div className="mar-maphint">
          <p>{msg('mar.client.tocaUnaIslaPara')}</p>
          <button
            type="button"
            className="mar-maphint__close"
            data-testid="mar-mapa-cerrar"
            onClick={() => engineRef.current?.backToBoat()}
          >
            {msg('mar.client.cerrar')}
          </button>
        </div>
      ) : null}

      {dialogue ? (
        <div ref={bubbleRef} className="mar-bubble" data-testid="mar-bocadillo">
          <button
            type="button"
            className="mar-bubble__text"
            onClick={() => {
              engineRef.current?.runtime.advanceDialogue();
              window.setTimeout(syncDialogue, 0);
            }}
          >
            <span>{dialogue.text}</span>
            {!dialogue.last ? <small>{msg('mar.client.tocaParaSeguir')}</small> : null}
          </button>
          <button
            type="button"
            className="mar-x mar-bubble__x"
            data-testid="mar-bocadillo-cerrar"
            aria-label={msg('mar.client.cerrarDialogo')}
            onClick={() => {
              engineRef.current?.runtime.skipDialogue();
              window.setTimeout(syncDialogue, 0);
            }}
          >
            ×
          </button>
        </div>
      ) : null}

      {/* Abajo (T65): sólo «Entradas», destacada (REQ-ENT-040), y el turbo;
          las tarjetas se abren encima. */}
      {status === 'ready' ? (
        <nav className="mar-bar" data-testid="mar-barra" aria-label={msg('mar.hud.abajo')}>
          <div
            className={`mar-tickets${trip ? ' is-sailing' : ''}`}
            data-testid="mar-viaje"
            data-lugar={trip?.placeId}
          >
            {trip ? (
              <button
                type="button"
                className="mar-tickets__skip"
                data-testid="mar-entradas-saltar"
                onClick={() => finishTrip(trip, 'skip')}
              >
                {msg('mar.client.saltar')}
              </button>
            ) : null}
            <button
              type="button"
              className="mar-tickets__btn"
              data-testid="mar-entradas"
              aria-haspopup={trip ? undefined : 'dialog'}
              aria-expanded={trip ? undefined : entradas}
              aria-label={
                trip
                  ? trip.then === 'sheet' || trip.then === 'place'
                    ? msg('mar.client.rumboATocaPara', { placeName: trip.placeName })
                    : msg('mar.client.entradasRumboAToca', { placeName: trip.placeName })
                  : msg('hud.tickets')
              }
              onClick={onTickets}
            >
              <span aria-hidden="true">🎟️</span>
              <strong>{msg('hud.tickets')}</strong>
              {trip ? (
                <small>
                  {msg('mar.client.a', {
                    v1: stats?.flight ? msg('mar.client.volando') : msg('mar.client.rumbo'),
                    placeName: trip.placeName,
                  })}
                </small>
              ) : null}
            </button>
          </div>
          <button
            type="button"
            className={`mar-turbo${turboReady ? ' is-ready' : ''}${(stats?.turbo ?? 0) > 0 ? ' is-on' : ''}`}
            style={{ '--p': stats?.turboReady ?? 1 } as CSSProperties}
            aria-label={msg('mar.client.turbo')}
            data-testid="mar-turbo"
            onClick={() => {
              if (engineRef.current?.turbo()) {
                navigator.vibrate?.(20);
                whoosh();
              }
            }}
          >
            <span>⚡</span>
            <small>{turboReady ? msg('mar.client.turbo') : '…'}</small>
          </button>
        </nav>
      ) : null}

      {sheet ? (
        <Sheet
          key={sheetKey(sheet)}
          state={sheet}
          object={sheetObject}
          distance={distance}
          onClose={() => setSheet(null)}
          onCourse={courseTo}
          onFly={flyTo}
          onBuy={(id) => {
            track('ticket_click_out', { eventId: id, source: 'island' });
            setCheckoutFor(id);
          }}
          onSteerEvent={steerToEvent}
          onGoToIsland={goToIsland}
        />
      ) : null}

      {status === 'ready' && liveRef.current && settings ? (
        <div className="mar-minigame">
          <MinigameLayer
            offer={sheet || checkoutFor ? null : minigameOffer}
            onDismiss={() => setMinigameOffer(null)}
            world={liveRef.current}
            settings={settings}
            sink={progressApi}
          />
        </div>
      ) : null}

      {/* Botellas cerca del barco (T56), encima de la barra, cuando no hay nada más abajo. */}
      {status === 'ready' && !sheet && !checkoutFor && !menu && !trip && !invitations.reason ? (
        <MarBottlesNear
          ids={nearBottles}
          bottles={bottleList ?? []}
          onRead={(id) => openBottle({ kind: 'read', id })}
        />
      ) : null}
      {bottleSheet ? (
        <MarBotella
          mode={bottleSheet}
          dropSpot={bottleDrop}
          onMine={() => setBottleSheet({ kind: 'mine' })}
          onNeedCarnet={() => openPanel('carnet')}
          onClose={() => setBottleSheet(null)}
          onMenu={openMenu}
        />
      ) : null}
      {ranking ? (
        <MarRanking
          season={worldId ?? ''}
          worldName={worldName}
          onOwnCarnet={() => openPanel('carnet')}
          onClose={() => setRanking(false)}
          onMenu={openMenu}
        />
      ) : null}
      {logros ? (
        <MarLogros
          onClose={() => setLogros(false)}
          onCarnet={() => openPanel('carnet')}
          onMenu={openMenu}
        />
      ) : null}
      {hoja ? (
        <MarABordo
          panel={hoja}
          settings={settings}
          onSettings={updateSettings}
          onBottles={() => openBottle({ kind: 'mine' })}
          // «Comprar entradas» de Welcome Aboard: «Elige tu evento», ya en el mar.
          {...(hoja === 'bienvenida' ? { onTickets: openEntradas } : {})}
          carnetCreate={hoja === 'carnet' && carnetForCheckout !== null}
          onCarnetCreated={() => {
            // Vuelta a la compra (T66): se vuelve a preparar, ya con el descuento del Carnet.
            const eventId = carnetForCheckout;
            if (!eventId) return;
            setCarnetForCheckout(null);
            setHoja(null);
            setCheckoutFor(eventId);
          }}
          onClose={() => {
            setCarnetForCheckout(null);
            setHoja(null);
          }}
          onMenu={() => {
            setCarnetForCheckout(null);
            openMenu();
          }}
        />
      ) : null}
      {tienda ? (
        <MarTienda
          catalog={shipCatalog}
          current={shipLook}
          pending={shipPending}
          onEquip={chooseShip}
          onClose={() => setTienda(false)}
          onMenu={openMenu}
        />
      ) : null}

      {entradas && world ? (
        <MarEntradas
          tickets={worldTickets(
            liveContent(),
            new Date(),
            (id) => islandOfEvent(world, id)?.identity.id ?? null,
          )}
          onBuy={buyFromPanel}
          onSail={sailToTickets}
          onClose={() => setEntradas(false)}
        />
      ) : null}

      {checkoutFor ? (
        <SandboxCheckout
          eventId={checkoutFor}
          source="world"
          className="checkout--mar"
          onClose={() => {
            setCheckoutFor(null);
            // Después de comprar, la invitación a crear el Carnet (REQ-IDE-008),
            // con «Elige tu evento» ya cerrado (con un panel abierto, espera).
            if (purchasedRef.current) {
              setEntradas(false);
              inviteTrigger('purchase');
            }
            purchasedRef.current = false;
          }}
          onConfirmed={(o, s) => {
            purchasedRef.current = true;
            for (const n of purchaseNotices(o, s.event.name)) push(n);
          }}
          carnet={{
            onOpen: () => {
              purchasedRef.current = false;
              setCheckoutFor(null);
              openPanel('carnet');
            },
          }}
          onCreateCarnet={() => {
            // «Crear Carnet» antes de comprar (T66): el alta de Mi Carnet dentro del mar.
            const eventId = checkoutFor;
            setCheckoutFor(null);
            openPanel('carnet');
            setCarnetForCheckout(eventId);
          }}
        />
      ) : null}
    </main>
  );
}
