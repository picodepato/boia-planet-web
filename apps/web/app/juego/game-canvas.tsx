'use client';

import { EVENT_STATE_BEHAVIOR } from '@boia/contracts';
import type { Game, GameStats, WorldEvent, WorldRuntime } from '@boia/engine';
import { nearbyBottles } from '@boia/engine/bottles';
import {
  type MissionEvent,
  type MissionHost,
  RescueMission,
  type RescuePhase,
  rescueMissionOf,
} from '@boia/engine/mission';
import { MINIGAME_REGISTRY } from '@boia/engine/minigames';
import {
  DEFAULT_SETTINGS,
  DiscoveryTracker,
  type KeyValueStore,
  type MinimapZone,
  type Notice,
  type Settings,
  browserStore,
  compassAngle,
  discoveryTargets,
  hudLayout,
  loadMinimapZone,
  loadSettings,
  mapMarkers,
  parseSettings,
  safeMinimapZones,
  saveMinimapZone,
  saveSettings,
  setControlSensitivity,
} from '@boia/engine/ui';
import { voyagePreload } from '@boia/engine/streaming';
import type { FoundDiscount } from '@boia/store';
import { type ComposedWorld, chooseWorld as chooseWorldIn } from '@boia/world';
import Link from 'next/link';
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SKIN_LABELS, type ShipCatalog } from '../../lib/barco/catalog';
import { liveWorld } from '../../lib/admin/live-world';
import { track } from '../../lib/analytics';
import { liveContent } from '../../lib/landing/live-content';
import { SandboxCheckout } from '../../lib/ticketing/checkout';
import { purchaseNotices } from '../../lib/ticketing/notices';
import {
  claimWorld,
  offerWorld,
  readPlaceRequest,
  withoutPlaceRequest,
} from '../../lib/world-handoff';
import { type ArrivalPanel, approachPoint, planArrival, runArrival } from '../../lib/mundo/arrival';
import { CarnetInvite } from '../../lib/mundo/carnet/carnet-invite';
import {
  SHIP_POSITION_SAVE_MS,
  documentNavigationType,
  loadShipPosition,
  movedEnough,
  restoreShipPosition,
  saveShipPosition,
  shouldRestorePosition,
} from '../../lib/mundo/ship-position';
import { useCarnetInvitations } from '../../lib/mundo/use-invitations';
import {
  TIME_PLAYED_TICK_S,
  onAchievementNotices,
  recordBuoy,
  recordSignal,
  signalFromWorldEvent,
} from '../../lib/mundo/achievements';
import {
  VOYAGE_PARAM,
  type Voyage,
  isSteeringKey,
  planVoyage,
  stepVoyage,
} from '../../lib/mundo/autopilot';
import { BalancesChip } from '../../lib/mundo/balances';
import { BottleBar, bottleBarRect } from '../../lib/mundo/bottles/bottle-bar';
import { Celebration } from '../../lib/mundo/celebration';
import {
  boardedNotice,
  crewReaction,
  deliveredNotice,
  loadMission,
  persistMissionEvent,
} from '../../lib/mundo/mission';
import { BottleSheet, type BottleSheetMode } from '../../lib/mundo/bottles/bottle-sheet';
import { CarnetSheet } from '../../lib/mundo/carnet/carnet-sheet';
import { CircuitTimer, useCircuit } from '../../lib/mundo/circuit-hud';
import {
  DOLPHIN_PARAM,
  type DolphinAction,
  type DolphinGuide,
  WhirlpoolTimer,
  findDolphinGuide,
  inOpenSea,
  undiscoveredTarget,
} from '../../lib/mundo/encounters';
import { DiscountPanel, PlacePanel, type PlacePanelState } from '../../lib/mundo/place-panels';
import {
  type ProgressOutcome,
  discoverPlace,
  discoveredPlaces,
  grantEncounter,
  persistWorldEvent,
} from '../../lib/mundo/world-progress';
import { SHIP_PREF, type ShipPref, isShipPref } from '../../lib/mundo/carnet/use-carnet';
import { worlds } from '../../lib/mundo/demo-world';
import { ATLAS_URL, VOYAGE_WAIT_MS, requestedQuality } from '../../lib/mundo/streaming';
import { Compass, MenuAnchor } from '../../lib/mundo/hud-buttons';
import '../../lib/mundo/hud.css';
import './juego.css';
import '../../lib/mundo/carnet/carnet.css';
import { OnboardMenu } from '../../lib/mundo/menu/onboard-menu';
import type { MenuContext, ShipMenu, WorldMenu } from '../../lib/mundo/menu/types';
import { type MinigameOffer, MinigameLayer } from '../../lib/mundo/minigame-layer';
import { ExpandedMap, Minimap } from '../../lib/mundo/minimap';
import { discoveryNotice } from '../../lib/mundo/notice-copy';
import { NoticeToast, useNoticeQueue } from '../../lib/mundo/notices';
import { gameRepository, useRepoData } from '../../lib/mundo/repo';
import { type ShipDressing, dressingFor, dressingKey } from '../../lib/barco/dressing';
import {
  type ShipLook,
  equipLook,
  rememberLook,
  storedLook,
  syncStyleParam,
} from '../../lib/mundo/ship-look';
import { feedbackFor } from '../../lib/mundo/feedback';
import {
  applyAudioSettings,
  bump,
  chime,
  fanfare,
  installAudioLifecycle,
  playSound,
  plop,
  setAmbientWorld,
} from '../../lib/mundo/sound';
import { useViewport } from '../../lib/mundo/use-viewport';
import {
  adminWorldId,
  currentWorld,
  syncWorldParam,
  visitorWorldChoice,
} from '../../lib/mundo/world-choice';
import { EventPanel } from '../../lib/mundo/world-ui';
import { t as msg } from '../../lib/i18n';

const MANIFEST_URL = '/api/art/barco/manifest.json?optional=1';

/** Eventos del repositorio, con los cambios del Admin de la demo (T26). */
const findEvent = (id: string | undefined) => liveContent().events.find((e) => e.id === id);
const ticketAvailable = (id: string) => {
  const e = findEvent(id);
  return !!e && EVENT_STATE_BEHAVIOR[e.state].purchasable;
};

/** Premios de los minijuegos: el libro del repositorio local (T16). */
const minigameSink = () => gameRepository().progress;

/** Progreso del mar (premios, descuentos, récords): el mismo libro. */
const progressApi = () => gameRepository().progress;

/** u/s de golpe a partir de los cuales suena el choque, y el golpe que suena a tope. muestra */
const BUMP_MIN_SPEED = 40;
const BUMP_FULL_SPEED = 200;
/** s mínimos entre dos golpes: rozar una costa no es una ráfaga. muestra */
const BUMP_COOLDOWN_S = 0.35;

/** `?cerca=<lugar>`: empezar junto a un lugar (pruebas y enlaces), al sur de él. */
const NEAR_PARAM = 'cerca';

/** El juego ya arrancó en este documento: volver a /juego sin recargar sigue donde estaba. */
let bootedInDocument = false;

/** localStorage, si lo hay (la posición del barco vive en el dispositivo). */
function deviceStore(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Una visita = una carga de página: las recompensas «por sesión» vuelven en otra. */
const newSessionId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function GameCanvas({ shipCatalog = null }: { shipCatalog?: ShipCatalog | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vp = useViewport();
  const storeRef = useRef<KeyValueStore | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Aspecto del barco aplicado por el motor (T12) y si la superficie vino de la landing.
  const [shipLook, setShipLook] = useState<ShipLook | null>(null);
  const [shipPending, setShipPending] = useState(false);
  // Bandera y estela equipadas (T40): lo que se pintó con el barco que se ve.
  const [shipDress, setShipDress] = useState<Record<string, string>>({});
  const dressingRef = useRef<ShipDressing>({ flag: null, wakeTint: null });
  const equippedRef = useRef<Record<string, string>>({});
  const { data: equippedNow } = useRepoData((r) => r.progress.equipped());
  if (equippedNow) equippedRef.current = equippedNow;
  const [adopted, setAdopted] = useState<boolean | null>(null);
  const [menuPulse, setMenuPulse] = useState(0);
  const [minimapPulse, setMinimapPulse] = useState(0);
  const [panel, setPanel] = useState<{ objectId: string; eventId: string } | null>(null);
  const [ticketFor, setTicketFor] = useState<string | null>(null);
  // Isla Faro o Cañón al alcance (INICIAR_MINIJUEGO, T23).
  const [minigameOffer, setMinigameOffer] = useState<MinigameOffer | null>(null);
  // Compra de prueba abierta desde el panel de la isla (T25).
  const [checkoutFor, setCheckoutFor] = useState<string | null>(null);
  // Paneles de los demás lugares (T20): isla, fotos, tienda, WhatsApp; y el descuento encontrado.
  const [placePanel, setPlacePanel] = useState<PlacePanelState | null>(null);
  const [discountPanel, setDiscountPanel] = useState<FoundDiscount | null>(null);
  const [sessionId] = useState(newSessionId);
  // Encuentros guionizados por la web (T20): el delfín y el remolino.
  const dolphinRef = useRef<DolphinGuide | null>(null);
  // El delfín guía (O15, T45): el motor en que se escondió y el reloj de sus pasos.
  const dolphinRuntime = useRef<WorldRuntime | null>(null);
  const dolphinClock = useRef(0);
  const [dolphinOut, setDolphinOut] = useState(false);
  // Lo que ya se encontró sin ser un objetivo de la brújula (secretos, cofres…): el delfín no guía ahí.
  const foundObjectsRef = useRef(new Set<string>());
  // Islas ya visitadas: su panel ofrece «Explorar la isla» (REQ-AVE-013).
  const revisitRef = useRef(new Set<string>());
  const whirlpoolRef = useRef(new WhirlpoolTimer());
  // La misión de la Boia Fiestera (T21): la juega el motor en cada paso; aquí se guarda.
  const missionRef = useRef<RescueMission | null>(null);
  const missionHost = useRef<{ runtime: WorldRuntime; host: MissionHost } | null>(null);
  const [missionPhase, setMissionPhase] = useState<RescuePhase | null>(null);
  const missionPhaseRef = useRef<RescuePhase | null>(null);
  const rescueNotices = useRef<Promise<Notice[]> | null>(null);
  const [celebration, setCelebration] = useState(0);
  const reactions = useRef(0);
  const bumpCooldown = useRef(0);
  // «Ir a la isla» (T43): el barco navega solo hasta la isla de un código; se puede saltar.
  const voyageRef = useRef<Voyage | null>(null);
  /** Viaje pedido que espera al arte del primer tramo de su ruta (T47). */
  const pendingVoyage = useRef<Voyage | null>(null);
  const [voyage, setVoyage] = useState<{ placeId: string; name: string } | null>(null);

  // Preferencias guardadas (se leen al montar: el HUD no se pinta en servidor).
  const settingsRef = useRef<Settings>(DEFAULT_SETTINGS);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [zonePref, setZonePref] = useState<MinimapZone | null>(null);
  // `?debug`: la caja de fps y velocidad (O11); sin él no se pinta.
  const [debug, setDebug] = useState(false);

  // Mundo que se juega (T17). Arranca con el por defecto; al montar se elige el
  // de la URL o el guardado. Lo que el minimapa dibuja y la brújula persigue
  // sale de sus datos.
  const [world, setWorld] = useState<ComposedWorld>(() => worlds.get(worlds.defaultId));
  const [worldPending, setWorldPending] = useState(false);
  // Cambio de mundo en curso (T41): el vórtice o, con movimiento reducido, el fundido.
  const [switching, setSwitching] = useState<'vortex' | 'fade' | null>(null);
  // El motor ya arrancó: se puede cambiar de mundo.
  const [worldReady, setWorldReady] = useState(false);
  const targets = useMemo(() => discoveryTargets(world.config), [world]);
  const markers = useMemo(() => mapMarkers(world.config), [world]);

  // Descubrimiento, brújula y avisos. Lo descubierto va por id de lugar: sobrevive
  // al cambio de mundo, también si un mundo oculta el lugar (REQ-AVE-011).
  const foundRef = useRef(new Set<string>());
  const trackerRef = useRef<DiscoveryTracker | null>(null);
  trackerRef.current ??= new DiscoveryTracker(targets);
  const tracker = trackerRef.current;
  const [discovered, setDiscovered] = useState<readonly string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [achievements, setAchievements] = useState<readonly Notice[]>([]);
  const notified = useRef(new Set<string>());
  // Avisos y bocadillos con tiempo de lectura (D-22): al menos 3 s, más si el texto es largo.
  const notices = useNoticeQueue(() => chime(), { readable: true });
  // Hay bocadillo: su × vive en el lienzo; este botón es el mismo cierre para el lector de pantalla.
  const [talking, setTalking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuInitial, setMenuInitial] = useState<string | undefined>(undefined);
  const [mapOpen, setMapOpen] = useState(false);

  // Botellas (T22): las del mar vienen del repositorio; cerca del barco se pueden leer.
  const { data: bottleList, repo } = useRepoData((r) => r.bottles.list());
  const bottlesRef = useRef(bottleList ?? []);
  bottlesRef.current = bottleList ?? [];
  const nearRef = useRef<ReadonlySet<string>>(new Set());
  const [nearby, setNearby] = useState<readonly string[]>([]);
  const [bottleSheet, setBottleSheet] = useState<BottleSheetMode | null>(null);
  const [carnetOf, setCarnetOf] = useState<string | null>(null);
  // Llegada a un lugar con `?ir=` (T44, REQ-ENT-034): el barco entra navegando y abre su panel.
  const [arrival, setArrival] = useState<{ placeId: string; done: boolean } | null>(null);
  const purchasedRef = useRef(false);
  const openMenu = (section?: string) => {
    setMenuInitial(section);
    setMenuOpen(true);
  };

  const notify = (n: Notice) => {
    if (notified.current.has(n.id)) return;
    notified.current.add(n.id);
    notices.push(n);
    if (n.kind === 'achievement') setAchievements((a) => [...a, n]);
  };

  // El Freu (T20): carrera, cronómetro pequeño y récord local.
  const circuit = useCircuit(world, progressApi, (n) => notify(n), chime);

  /** Lo que el repositorio concedió de verdad: avisos y, si es un descuento, su panel. */
  const showOutcomes = (outcomes: ProgressOutcome[]) => {
    for (const o of outcomes) {
      notify(o.notice);
      if (o.kind === 'discount') {
        setPlacePanel(null);
        setDiscountPanel(o.found);
        // Embudo (REQ-ARQ-019): sólo la primera vez que se encuentra.
        track('discount_found', {
          discountId: o.found.discount.id,
          ...(o.found.discount.eventId ? { eventId: o.found.discount.eventId } : {}),
        });
      }
    }
  };
  const persist = (work: Promise<ProgressOutcome[]>) =>
    void work.then(showOutcomes, (err: unknown) =>
      console.warn('[boia] no se pudo guardar el progreso', err),
    );
  /** Avisos que sólo existen si el repositorio concedió algo (logros, premios de la misión). */
  const notifyGranted = (work: Promise<Notice[]>) =>
    void work.then(
      (ns) => {
        for (const n of ns) notify(n);
      },
      (err: unknown) => console.warn('[boia] no se pudo guardar el progreso', err),
    );

  const onStats = (s: GameStats) => {
    setStats(s);
    const t = trackerRef.current!;
    const fresh = t.update(s);
    if (fresh.length) {
      for (const f of fresh) foundRef.current.add(f.id);
      setDiscovered(t.discovered());
      for (const f of fresh) {
        if (f.kind !== 'island') continue;
        const n = discoveryNotice(f);
        // Con la Fiestera a bordo, reacciona a lo descubierto (REQ-AVE-007).
        if (missionRef.current?.aboard) {
          const r = crewReaction(reactions.current++);
          notify({ ...n, body: n.body ? `${n.body} · ${r}` : r });
        } else {
          notify(n);
        }
      }
      // Primera llegada, guardada por id de lugar (REQ-AVE-013).
      for (const f of fresh) {
        void discoverPlace(progressApi(), f.id, { sessionId, worldId: world.id }).catch(
          (err: unknown) => console.warn('[boia] no se pudo guardar el descubrimiento', err),
        );
      }
    }
    setSelectedId(t.selected?.id ?? null);
    const near = nearbyBottles(s, bottlesRef.current, nearRef.current);
    if (near.join() !== [...nearRef.current].join()) {
      nearRef.current = new Set(near);
      setNearby(near);
    }
  };

  /** Pasa la interfaz a otro mundo: objetivos nuevos, lo descubierto y lo elegido se quedan. */
  const adoptWorld = useCallback((w: ComposedWorld) => {
    const selected = trackerRef.current?.selected?.id ?? null;
    const next = new DiscoveryTracker(discoveryTargets(w.config), foundRef.current);
    next.select(selected);
    trackerRef.current = next;
    setWorld(w);
    setDiscovered(next.discovered());
    setSelectedId(next.selected?.id ?? null);
    setPanel(null);
    setPlacePanel(null);
    // `?delfin=<s>`: el delfín sale tras esos segundos de mar abierto (pruebas y demos).
    const every = Number(new URLSearchParams(window.location.search).get(DOLPHIN_PARAM));
    dolphinRef.current = findDolphinGuide(
      w.config.objects,
      every > 0 ? { tuning: { minInterval: every, maxInterval: every } } : undefined,
    );
    dolphinRuntime.current = null;
    setDolphinOut(false);
  }, []);

  const isWhirlpool = (id: string) =>
    world.config.objects.find((o) => o.identity.id === id)?.identity.category === 'remolino';

  const onWorldEvent = (e: WorldEvent) => {
    // Respuesta inmediata (REQ-PRO-011): el sonido del comportamiento o el de serie.
    const fb = feedbackFor(e, world.config);
    if (fb?.sound) playSound(fb.sound);
    // Premios y logros avisan cuando el repositorio los concede (world-progress.ts,
    // achievements.ts): un logro ya obtenido no vuelve a avisar.
    if (e.type === 'achievement') {
      foundObjectsRef.current.add(e.objectId);
      const signal = signalFromWorldEvent(e, world.config);
      // Una boia nueva avisa «Boia encontrada · n de 6» (O12, T45).
      if (signal?.trigger === 'find_buoy') {
        notifyGranted(recordBuoy(gameRepository(), signal.objectId, world.config));
      } else if (signal) notifyGranted(recordSignal(gameRepository(), signal));
    }
    if (e.type === 'reward') foundObjectsRef.current.add(e.objectId);
    circuit.onWorldEvent(e);
    const ctx = { sessionId, worldId: world.id };
    switch (e.type) {
      case 'reward':
        persist(persistWorldEvent(progressApi(), e, ctx));
        break;
      case 'proximity_enter':
        if (isWhirlpool(e.objectId)) whirlpoolRef.current.enter(performance.now());
        break;
      default:
        break;
    }
    if (e.type === 'dialogue_line' || e.type === 'dialogue_reaction') setTalking(true);
    else if (e.type === 'dialogue_end') setTalking(false);
    switch (e.type) {
      case 'dialogue_line':
        plop();
        if (e.cue === 'pulse_menu') setMenuPulse((x) => x + 1);
        if (e.cue === 'pulse_minimap') setMinimapPulse((x) => x + 1);
        break;
      case 'content_open':
        if (e.target === 'event' && e.ref && findEvent(e.ref)) {
          setPanel({ objectId: e.objectId, eventId: e.ref });
        } else if (e.target === 'info' || e.target === 'photos' || e.target === 'store') {
          setDiscountPanel(null);
          setPlacePanel({
            objectId: e.objectId,
            target: e.target,
            ...(e.ref ? { ref: e.ref } : {}),
            // Visitas posteriores: acceso directo a «Explorar la isla» (REQ-AVE-013).
            ...(revisitRef.current.has(e.objectId) ? { revisit: true } : {}),
          });
        }
        break;
      case 'content_close':
        revisitRef.current.add(e.objectId);
        setPanel((p) => (p?.objectId === e.objectId ? null : p));
        setPlacePanel((p) => (p?.objectId === e.objectId ? null : p));
        break;
      case 'ticket':
        setTicketFor(e.eventId);
        break;
      case 'minigame':
        if (e.available && e.gameId) setMinigameOffer({ objectId: e.objectId, gameId: e.gameId });
        break;
      case 'proximity_exit':
        setMinigameOffer((m) => (m?.objectId === e.objectId ? null : m));
        if (isWhirlpool(e.objectId)) {
          // REQ-AVE-019: más premio cuanto más se aguanta dentro; cada tramo, una vez al día.
          const { tiers } = whirlpoolRef.current.exit(performance.now());
          for (const t of tiers) {
            persist(
              grantEncounter(progressApi(), `lugar:remolino:${t.seconds}s`, t.coins, 'daily'),
            );
          }
        }
        break;
      default:
        break;
    }
  };

  const onMissionEvent = (e: MissionEvent) => {
    const ctx = { worldId: world.id };
    switch (e.type) {
      case 'croc_dive':
      case 'croc_emerge':
        plop();
        break;
      case 'rescued':
        // Se guarda ya; sus avisos (el logro) salen tras el de «a bordo».
        rescueNotices.current = persistMissionEvent(gameRepository(), e, ctx).catch(
          (err: unknown) => {
            console.warn('[boia] no se pudo guardar la misión', err);
            return [];
          },
        );
        break;
      case 'boarded': {
        chime();
        notify(boardedNotice(e.missionId));
        const granted = rescueNotices.current;
        rescueNotices.current = null;
        if (granted) notifyGranted(granted);
        break;
      }
      case 'delivered':
        setCelebration(Date.now());
        fanfare();
        notify(deliveredNotice(e.missionId));
        notifyGranted(persistMissionEvent(gameRepository(), e, ctx));
        break;
      default:
        break;
    }
  };

  /** Lo que hace el delfín guía (O15), aplicado al motor. */
  const applyDolphin = (rt: WorldRuntime, d: DolphinGuide, actions: DolphinAction[]) => {
    for (const a of actions) {
      if (a.type === 'place') rt.moveObject(d.objectId, a.x, a.y);
      else if (a.type === 'surface') {
        rt.setObjectPresent(d.objectId, true);
        setDolphinOut(true);
        plop();
      } else if (a.type === 'dive') rt.setObjectPresent(d.objectId, false);
      else if (a.type === 'gone') {
        setDolphinOut(false);
        // Seguirlo hasta el final da su premio (una vez al día) y su logro.
        if (a.followed) {
          persist(grantEncounter(progressApi(), `lugar:${d.objectId}:seguir`, d.coins, 'daily'));
        }
      }
    }
  };

  /**
   * El delfín (O15, REQ-AVE-018): escondido en su sitio de descanso hasta que,
   * tras 2–4 minutos de mar abierto (sin carrera, panel ni diálogo), aparece
   * junto al barco y guía hacia lo más cercano sin descubrir.
   */
  const stepDolphin = (g: Game, ship: { x: number; y: number }, dt: number) => {
    const d = dolphinRef.current;
    if (!d) return;
    const rt = g.runtime;
    if (dolphinRuntime.current !== rt) {
      dolphinRuntime.current = rt;
      d.reset();
      rt.setObjectPresent(d.objectId, false);
      setDolphinOut(false);
    }
    dolphinClock.current += dt;
    if (dolphinClock.current < 0.2) return;
    const elapsed = dolphinClock.current;
    dolphinClock.current = 0;
    const objects = world.config.objects;
    const calm =
      !anyPanel &&
      !talking &&
      !minigameOffer &&
      !voyageRef.current &&
      circuit.state.phase === 'idle';
    const found = {
      has: (id: string) => foundRef.current.has(id) || foundObjectsRef.current.has(id),
    };
    const openSea = calm && !d.active && inOpenSea(objects, ship);
    const target = d.active || openSea ? undiscoveredTarget(objects, found, ship) : null;
    const heading = g.stats().heading;
    applyDolphin(rt, d, d.step(elapsed, { ...ship, heading }, { openSea, target }));
  };

  /** Cada paso fijo del motor: la misión mueve cocodrilos, Fiestera y tripulante. */
  const onStep = (ship: { x: number; y: number; impact?: number }, dt: number) => {
    // Golpe contra una costa o una roca: suena según lo fuerte que fue.
    bumpCooldown.current = Math.max(0, bumpCooldown.current - dt);
    const impact = ship.impact ?? 0;
    if (impact >= BUMP_MIN_SPEED && bumpCooldown.current === 0) {
      bumpCooldown.current = BUMP_COOLDOWN_S;
      bump(impact / BUMP_FULL_SPEED);
    }
    const v = voyageRef.current;
    if (v) {
      const r = stepVoyage(v, ship, dt);
      gameRef.current?.moveShip(r.x, r.y, r.heading);
      if (r.kind === 'arrive') endVoyage();
    }
    if (gameRef.current) stepDolphin(gameRef.current, ship, dt);
    const m = missionRef.current;
    const g = gameRef.current;
    if (!m || !g) return;
    const rt = g.runtime;
    // Runtime nuevo (cambio de mundo): otro anfitrión, y la misión se vuelve a poner.
    if (missionHost.current?.runtime !== rt) {
      missionHost.current = {
        runtime: rt,
        host: {
          moveObject: (id, x, y, z) => rt.moveObject(id, x, y, z),
          setObjectPresent: (id, on) => rt.setObjectPresent(id, on),
          setObjectInteractive: (id, on) => rt.setObjectInteractive(id, on),
          setPassenger: (on) => g.setPassenger(on),
        },
      };
    }
    const events = m.step(missionHost.current.host, ship, dt);
    if (m.phase !== missionPhaseRef.current) {
      missionPhaseRef.current = m.phase;
      setMissionPhase(m.phase);
    }
    for (const e of events) onMissionEvent(e);
  };

  // El motor arranca una vez; sus callbacks leen siempre la última versión.
  const handlers = useRef({ onStats, onWorldEvent, onStep });
  handlers.current = { onStats, onWorldEvent, onStep };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let g: Game | null = null;
    let stopArrival: (() => void) | null = null;
    /** El panel del lugar al que se llegó con `?ir=`: como si el barco lo hubiera abierto. */
    const openArrivalPanel = (p: ArrivalPanel | null) => {
      if (!p) return;
      if (p.kind === 'event') {
        setPlacePanel(null);
        setTicketFor(p.eventId);
        setPanel({ objectId: p.objectId, eventId: p.eventId });
        if (trackerRef.current?.selectEvent(p.eventId)) {
          setSelectedId(trackerRef.current.selected?.id ?? null);
        }
      } else {
        setDiscountPanel(null);
        setPlacePanel({
          objectId: p.objectId,
          target: p.target,
          ...(p.ref ? { ref: p.ref } : {}),
        });
      }
    };

    // EXPLORAR desde la landing (REQ-ENT-012): la escena llega ya en el
    // encuadre del puerto (T28) y su canvas se enseña al momento, mientras el
    // juego carga; después el juego adopta su WebGL y su mar.
    const surface = claimWorld();
    let handed = false;
    let target = canvas;
    if (surface) {
      target = surface.app.canvas;
      target.className = 'juego-canvas';
      target.removeAttribute('style');
      delete target.dataset.ready;
      // El canvas de React se queda oculto: React sigue siendo dueño de su nodo.
      canvas.style.display = 'none';
      canvas.before(target);
    }

    const store = browserStore();
    storeRef.current = store;
    const saved = loadSettings(store);
    settingsRef.current = saved;
    setSettings(saved);
    applyAudioSettings(saved);
    setControlSensitivity(saved.sensitivity);
    setZonePref(loadMinimapZone(store));

    const query = new URLSearchParams(window.location.search);
    setDebug(query.has('debug'));
    // `?mundo=<id>` o el elegido en este navegador (T17); el activo del Admin
    // vive en el repositorio y se lee antes de arrancar el motor (abajo).
    const base = currentWorld(window.location.search);
    adoptWorld(base);
    // `?evento=<id>`: al entrar desde un evento, la brújula señala su isla.
    // `?menu=<sección>` abre el Menú de a bordo en esa sección (p. ej. desde /carnet).
    const section = query.get('menu');
    if (section) {
      setMenuInitial(section);
      setMenuOpen(true);
    }
    const fromEvent = query.get('evento');
    if (fromEvent && trackerRef.current?.selectEvent(fromEvent)) {
      setSelectedId(trackerRef.current.selected?.id ?? null);
    }
    // Lo encontrado en otras visitas (secretos, cofres…): el delfín no guía hasta ahí.
    void progressApi()
      .discoveries()
      .then((list) => {
        for (const { key } of list) {
          const m = /^objeto:[^:]+:(.+)$/.exec(key);
          if (m) foundObjectsRef.current.add(m[1]!);
        }
      })
      .catch((err: unknown) => console.warn('[boia] no se pudo leer lo encontrado', err));
    // Lo descubierto en otras visitas (T20): la brújula no vuelve a señalarlo y
    // sus islas ofrecen «Explorar la isla» (REQ-AVE-013).
    void discoveredPlaces(progressApi())
      .then((ids) => {
        if (cancelled || ids.length === 0) return;
        for (const id of ids) {
          foundRef.current.add(id);
          revisitRef.current.add(id);
        }
        const t = trackerRef.current!;
        const next = new DiscoveryTracker(t.targets, foundRef.current);
        next.select(t.selected?.id ?? null);
        trackerRef.current = next;
        setDiscovered(next.discovered());
      })
      .catch((err: unknown) => console.warn('[boia] no se pudo leer lo descubierto', err));

    (async () => {
      // Sin URL ni elección propia, el mundo activo que fijó el Admin (T24), con
      // los cambios del Admin de la demo (T26): lugares, nombres, textos y eventos.
      const chosen = currentWorld(window.location.search, await adminWorldId());
      const initial = await liveWorld(gameRepository(), worlds, chosen);
      if (cancelled) return;
      adoptWorld(initial);
      if (fromEvent && trackerRef.current?.selectEvent(fromEvent)) {
        setSelectedId(trackerRef.current.selected?.id ?? null);
      }
      const { createGame, loadShipStyle } = await import('@boia/engine');
      // `?barco=provisional` fuerza el barco dibujado por código, para comparar.
      const forceProvisional = query.get('barco') === 'provisional';
      // `?estilo=<id>`, lo equipado en la tienda (T40) o lo último elegido eligen el
      // aspecto (T11, T12), sólo si es tuyo; si no, el barco del mundo (T17).
      const want = await storedLook(progressApi(), initial.theme.ship, window.location.search);
      dressingRef.current = dressingFor(want.equipped);
      const styled = forceProvisional
        ? null
        : await loadShipStyle(MANIFEST_URL, want.style, want.skin);
      const manifest = styled?.loaded ? { ...styled.loaded, dressing: dressingRef.current } : null;
      if (cancelled) return;
      const look = styled?.style && manifest ? { style: styled.style.id, skin: styled.skin } : null;
      // Un ?estilo= tuyo queda equipado; uno desconocido o bloqueado no pisa lo guardado.
      if (look && want.source === 'url' && look.style === want.style) {
        rememberLook(look);
        void equipLook(progressApi(), look);
      }
      handed = true;
      // Dónde empieza el barco, antes de crear el juego: lo primero que se
      // carga es el arte de ese sector (T47, REQ-ARQ-014), no el del puerto.
      // `?cerca=<lugar>`: al sur de ese lugar, fuera de su radio (pruebas y enlaces).
      const near = query.get(NEAR_PARAM);
      const nearObject = near
        ? initial.config.objects.find((o) => o.identity.id === near && o.identity.active)
        : undefined;
      // `?ir=<lugar>` (accesos de la landing, T44): entra navegando hasta el
      // punto seguro del lugar y abre su panel, sin conducir (REQ-ENT-034).
      const place = nearObject ? null : readPlaceRequest(window.location.search);
      const plan = place
        ? planArrival(initial.config.objects, place, (id) => !!findEvent(id))
        : null;
      const booted = bootedInDocument;
      const restoreWhen = {
        navigationType: documentNavigationType(),
        bootedBefore: booted,
        handedOver: !!surface,
        placeRequested: !!place,
      };
      const positions = deviceStore();
      const saved =
        !nearObject && !plan && positions && shouldRestorePosition(restoreWhen)
          ? loadShipPosition(positions)
          : null;
      const start = nearObject
        ? { ...approachPoint(nearObject), heading: -Math.PI / 2 }
        : plan
          ? { ...plan.from, heading: plan.heading }
          : saved;
      const created = await createGame(target, {
        start,
        ...(plan ? { preload: [plan.to] } : {}),
        atlas: ATLAS_URL,
        quality: requestedQuality(window.location.search),
        world: initial.config,
        sea: initial.theme.sea,
        manifest,
        surface,
        keyboardMode: settingsRef.current.keyboardMode,
        onStats: (s) => handlers.current.onStats(s),
        onSwitch: (mode) => setSwitching(mode),
        onWorldEvent: (e) => handlers.current.onWorldEvent(e),
        onStep: (ship, dt) => handlers.current.onStep(ship, dt),
        runtime: {
          ticketAvailable,
          minigames: MINIGAME_REGISTRY,
          sessionId,
          readableDialogue: true,
          // Restos y cofres reaparecen en otro sitio en cada visita (REQ-AVE-016).
          seed: (Date.now() % 2147483646) + 1,
        },
        // `?arte=marcadores`: el mismo mundo sin arte, para ver que se comporta igual.
        ...(query.get('arte') === 'marcadores' ? { artUrl: null } : {}),
      });
      if (cancelled) {
        created.destroy();
        return;
      }
      g = created;
      gameRef.current = created;
      setGame(created);
      setShipLook(created.stats().shipSource === 'manifest' ? look : null);
      setShipDress(created.stats().shipSource === 'manifest' ? want.equipped : {});
      setAdopted(created.adoptedSurface);
      // Por si los ajustes cambiaron mientras cargaba.
      created.setKeyboardMode(settingsRef.current.keyboardMode);
      // La misión de la Fiestera (T21): lo guardado decide si está en el remanso,
      // a bordo o ya en su isla. `?pasajera=1` sólo enseña el slot TRIPULANTE, sin misión.
      const spec = rescueMissionOf(initial.config);
      if (spec) void created.setCrewArt(spec.crewAsset);
      if (query.get('pasajera') === '1') {
        created.setPassenger(true);
      } else if (spec) {
        const m = new RescueMission(initial.config, spec);
        missionRef.current = m;
        void loadMission(progressApi(), spec.missionId).then(
          (saved) => m.restore(saved),
          (err: unknown) => {
            console.warn('[boia] no se pudo leer la misión', err);
            m.restore(null);
          },
        );
      }
      bootedInDocument = true;
      if (nearObject) {
        const p = approachPoint(nearObject);
        created.moveShip(p.x, p.y, -Math.PI / 2);
      } else if (plan) {
        setArrival({ placeId: plan.placeId, done: false });
        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        stopArrival = runArrival(
          created,
          plan,
          () => {
            setArrival({ placeId: plan.placeId, done: true });
            openArrivalPanel(plan.panel);
            // Una recarga sigue donde está el barco, sin repetir el viaje.
            history.replaceState(history.state, '', withoutPlaceRequest(location.href));
          },
          { reducedMotion },
        );
      } else {
        if (place) history.replaceState(history.state, '', withoutPlaceRequest(location.href));
        // REQ-IDE-004: al recargar, el barco sigue donde estaba y con su rumbo.
        restoreShipPosition(created, positions, restoreWhen);
      }
      // Acceso para pruebas desde la consola; no existe en producción.
      if (process.env.NODE_ENV !== 'production') {
        (window as Window & { __boiaGame?: Game }).__boiaGame = created;
      }
      setWorldReady(true);
    })().catch((err: unknown) => {
      console.error(err);
      if (!cancelled) setError(msg('juego.gameCanvas.noSePudoArrancar'));
    });

    return () => {
      cancelled = true;
      stopArrival?.();
      gameRef.current = null;
      missionRef.current = null;
      missionHost.current = null;
      g?.destroy();
      // Desmontado antes de arrancar (StrictMode, o se fue): la escena vuelve a
      // estar en oferta para el siguiente montaje, que la recoge.
      if (surface && !handed) {
        target.remove();
        canvas.style.display = '';
        offerWorld(surface);
      }
    };
  }, [shipCatalog, adoptWorld, sessionId]);

  // Sonido (O10): el primer gesto lo desbloquea (también en iOS), ocultar la
  // pestaña lo pausa, y al salir de /juego se calla el ambiente.
  useEffect(() => {
    const off = installAudioLifecycle();
    return () => {
      off();
      setAmbientWorld(null);
    };
  }, []);
  // Un loop de ambiente por mundo: cambia con el mundo.
  useEffect(() => {
    setAmbientWorld(world.id);
  }, [world.id]);

  // Tiempo a bordo para los logros de 5 y 20 minutos: sólo con la pestaña a la vista.
  useEffect(() => {
    if (!game) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      notifyGranted(
        recordSignal(gameRepository(), { trigger: 'time_played', seconds: TIME_PLAYED_TICK_S }),
      );
    }, TIME_PLAYED_TICK_S * 1000);
    return () => window.clearInterval(id);
    // `notifyGranted` sólo encola avisos; basta con el motor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  // REQ-IDE-004 (T44): posición y rumbo del barco, guardados en el dispositivo
  // mientras se navega y al irse; una recarga los restaura (arranque, arriba).
  useEffect(() => {
    if (!game) return;
    const store = deviceStore();
    if (!store) return;
    let last: { x: number; y: number; heading: number } | null = null;
    const save = () => {
      try {
        const s = game.stats();
        const now = { x: s.x, y: s.y, heading: s.heading };
        if (!movedEnough(last, now)) return;
        last = now;
        saveShipPosition(store, now);
      } catch {
        // El motor ya no está: lo último guardado vale.
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') save();
    };
    const id = window.setInterval(save, SHIP_POSITION_SAVE_MS);
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', onVisibility);
      save();
    };
  }, [game]);

  // Logros (T36): navegar en este mundo cuenta, y los avisos de las señales
  // sueltas (botellas, Carnet, minijuegos) llegan a la cola de avisos.
  useEffect(() => {
    if (!game) return;
    notifyGranted(recordSignal(gameRepository(), { trigger: 'visit_world', worldId: world.id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, world.id]);
  useEffect(
    () =>
      onAchievementNotices((ns) => {
        for (const n of ns) notify(n);
      }),
    // `notify` sólo encola avisos con refs y colas estables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Tomar el timón (teclas de rumbo o tocar el mar) cancela el viaje a la isla (T43).
  useEffect(() => {
    if (!voyage) return;
    const cancel = () => {
      voyageRef.current = null;
      pendingVoyage.current = null;
      setVoyage(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (isSteeringKey(e.code)) cancel();
    };
    const onPointer = (e: PointerEvent) => {
      if (e.target instanceof HTMLCanvasElement) cancel();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [voyage]);

  // `?evento=<id>&piloto=1` (tarjetas de descuento fuera del mar): al arrancar,
  // el barco navega solo hasta la isla de ese evento (T43).
  const voyageFromUrl = useRef(false);
  useEffect(() => {
    if (!game || !worldReady || voyageFromUrl.current) return;
    voyageFromUrl.current = true;
    const q = new URLSearchParams(window.location.search);
    const eventId = q.get('evento');
    const pilot = q.get(VOYAGE_PARAM);
    if (pilot === '1' && eventId) goToEventIsland(eventId);
    // `?piloto=<lugar>`: el mismo viaje hasta un lugar sin evento (T47: enlaces y pruebas).
    else if (pilot && pilot !== '1') sailTo(pilot);
    // Una vez, con el motor y el mundo ya puestos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, worldReady]);

  // Sección «Barco»: aplica estilo y skin al barco en el agua, sin recargar.
  // `remember: false` (el barco por defecto de un mundo) no lo guarda como elección.
  const shipRequest = useRef(0);
  const chooseShip = (want: ShipLook, remember = true) => {
    const g = gameRef.current;
    if (!g) return;
    const request = ++shipRequest.current;
    setShipPending(true);
    const dressing = dressingRef.current;
    const dressIds = { ...equippedRef.current };
    (async () => {
      const { loadShipStyle } = await import('@boia/engine');
      const r = await loadShipStyle(MANIFEST_URL, want.style, want.skin);
      if (!r.loaded || !r.style) return;
      // Bandera y estela (T40) van con el barco: se pintan encima, no navegan.
      const ok = await g.setShip(Object.assign({ dressing }, r.loaded));
      if (!ok || request !== shipRequest.current || gameRef.current !== g) return;
      const look = { style: r.style.id, skin: r.skin };
      setShipLook(look);
      setShipDress(dressIds);
      if (!remember) return;
      rememberLook(look);
      syncStyleParam(look.style);
    })()
      .catch((err: unknown) => console.warn('[boia] no se pudo cambiar el barco', err))
      .finally(() => {
        if (request === shipRequest.current) setShipPending(false);
      });
  };

  // Equipar en la tienda (T40): un barco o una skin llegan por `choose`; si
  // cambia la bandera o la estela (también desde otra pestaña), se repinta el
  // barco que se lleva con ellas.
  useEffect(() => {
    if (!game || !equippedNow || !shipLook) return;
    const next = dressingFor(equippedNow);
    if (dressingKey(next) === dressingKey(dressingRef.current)) return;
    dressingRef.current = next;
    chooseShip(shipLook, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, equippedNow]);

  // Las botellas del repositorio, en el agua (T22).
  useEffect(() => {
    if (!game || !bottleList) return;
    void game.setBottles(bottleList.map((b) => ({ id: b.id, x: b.x, y: b.y, mine: b.isMine })));
  }, [game, bottleList]);

  // El barco que se lleva, para el Carnet (vive en este navegador).
  useEffect(() => {
    if (!repo || !shipLook) return;
    const name = shipCatalog?.styles.find((s) => s.id === shipLook.style)?.name ?? shipLook.style;
    const next: ShipPref = {
      style: shipLook.style,
      skin: shipLook.skin,
      label: `${name} · ${SKIN_LABELS[shipLook.skin] ?? shipLook.skin}`,
    };
    void repo.progress.pref(SHIP_PREF).then((old) => {
      if (isShipPref(old) && old.label === next.label && old.skin === next.skin) return;
      return repo.progress.setPref(SHIP_PREF, { ...next });
    });
  }, [repo, shipLook, shipCatalog]);

  // Cambio de mundo (T17): mismo mapa, otra piel. El barco sigue donde está.
  // Con un agujero negro centrado en el barco (T41): el mundo cae, se cambia a
  // oscuras y el nuevo se despliega; con movimiento reducido, un fundido.
  const worldRequest = useRef(0);
  /** El último mundo pedido (el que acabará en pantalla). */
  const wantedWorld = useRef<string | null>(null);
  const switchWorld = (chosen: ComposedWorld) => {
    const g = gameRef.current;
    if (!g || chosen.id === (wantedWorld.current ?? world.id)) return;
    wantedWorld.current = chosen.id;
    const request = ++worldRequest.current;
    setWorldPending(true);
    let next = chosen;
    liveWorld(gameRepository(), worlds, chosen)
      .then((live) => {
        next = live;
        return g.setWorld(next.config, {
          sea: next.theme.sea,
          transition: prefersReducedMotion() ? 'fade' : 'vortex',
        });
      })
      .then((ok) => {
        if (!ok || request !== worldRequest.current || gameRef.current !== g) return;
        adoptWorld(next);
        syncWorldParam(next.id);
        // La misión sigue (mismo paso, mismo destino guardado) con la piel del mundo nuevo.
        missionRef.current?.setWorld(next.config);
        void g.setCrewArt(rescueMissionOf(next.config)?.crewAsset ?? null);
        // Sin barco elegido (ni en la URL ni equipado), el del mundo nuevo.
        void storedLook(progressApi(), next.theme.ship, window.location.search).then((want) => {
          if (!shipLook || want.source !== 'world') return;
          if (want.style !== shipLook.style || want.skin !== shipLook.skin)
            chooseShip({ style: want.style, skin: want.skin }, false);
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
    if (!gameRef.current || id === (wantedWorld.current ?? world.id)) return;
    const chosen = chooseWorldIn(worlds, visitorWorldChoice(), id);
    if (chosen) switchWorld(chosen);
  };

  // El Admin cambia el mundo activo (T26) con /juego abierto (otra pestaña):
  // quien no eligió mundo ni lo trae en la URL pasa a él por el agujero negro.
  const switchWorldRef = useRef(switchWorld);
  switchWorldRef.current = switchWorld;
  useEffect(() => {
    if (!worldReady) return;
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
  }, [worldReady]);

  // Cambio de mundo para pruebas desde la consola; no existe en producción.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    (window as Window & { __boiaWorld?: (id: string) => void }).__boiaWorld = chooseWorld;
  });

  const updateSettings = (change: (s: Settings) => Settings) => {
    const next = parseSettings(change(settingsRef.current));
    settingsRef.current = next;
    setSettings(next);
    if (storeRef.current) saveSettings(storeRef.current, next);
    applyAudioSettings(next);
    setControlSensitivity(next.sensitivity);
    gameRef.current?.setKeyboardMode(next.keyboardMode);
  };

  const setMinimapZone = (z: MinimapZone) => {
    setZonePref(z);
    if (storeRef.current) saveMinimapZone(storeRef.current, z);
  };

  const selectTarget = (id: string | null) => {
    const t = trackerRef.current!;
    t.select(id);
    setSelectedId(t.selected?.id ?? null);
  };

  const panelEvent = panel ? findEvent(panel.eventId) : undefined;

  // REQ-AVE-032: abrir un panel (lugar, descuento, compra, menú, mapa, botella) anula la vuelta.
  const anyPanel =
    !!panelEvent ||
    !!placePanel ||
    !!discountPanel ||
    !!checkoutFor ||
    menuOpen ||
    mapOpen ||
    !!bottleSheet;
  const invalidateLap = circuit.invalidate;
  useEffect(() => {
    if (anyPanel) invalidateLap('panel');
  }, [anyPanel, invalidateLap]);

  // Invitaciones al Carnet (T44, REQ-IDE-008/009): nunca sobre una carrera, un
  // diálogo, el pago, un panel o la llegada a un lugar; esperan a que acaben.
  const inviteBlocked =
    anyPanel ||
    talking ||
    circuit.state.phase !== 'idle' ||
    !!minigameOffer ||
    !!carnetOf ||
    (arrival !== null && !arrival.done);
  const invitations = useCarnetInvitations({ running: !!game, blocked: inviteBlocked });
  const inviteTrigger = invitations.trigger;
  // Al cerrar la galería del Puerto de Fotos.
  const galleryOpen = placePanel?.target === 'photos';
  const wasGallery = useRef(false);
  useEffect(() => {
    if (wasGallery.current && !galleryOpen) inviteTrigger('gallery');
    wasGallery.current = galleryOpen;
  }, [galleryOpen, inviteTrigger]);

  const steerToEvent = (eventId: string) => {
    const t = trackerRef.current!;
    const ok = t.selectEvent(eventId);
    setSelectedId(t.selected?.id ?? null);
    return ok;
  };

  /**
   * «Ir a la isla» de un código (T43, REQ-COM-036): cierra lo abierto, pone
   * la brújula en la isla del evento y el barco navega solo hasta ella, en
   * turbo. Con movimiento reducido llega de un salto. Sin isla en este mundo,
   * sólo la brújula. `false` si no hay isla a la que ir.
   */
  const goToEventIsland = (eventId: string): boolean => {
    const event = findEvent(eventId);
    const g = gameRef.current;
    const island = event?.islandId
      ? world.config.objects.find((o) => o.identity.id === event.islandId && o.identity.active)
      : undefined;
    setMenuOpen(false);
    setDiscountPanel(null);
    setPlacePanel(null);
    setPanel(null);
    const t = trackerRef.current!;
    t.select(
      island && t.targets.some((x) => x.id === island.identity.id) ? island.identity.id : null,
    );
    setSelectedId(t.selected?.id ?? null);
    if (!island || !g) return steerToEvent(eventId);
    startVoyage(g, planVoyage(island, g.stats(), eventId));
    return true;
  };

  /** Viaje en turbo hasta un lugar del mapa (`?piloto=<lugar>`), sin evento. */
  const sailTo = (placeId: string): boolean => {
    const g = gameRef.current;
    const o = world.config.objects.find((x) => x.identity.id === placeId && x.identity.active);
    if (!g || !o) return false;
    startVoyage(g, planVoyage(o, g.stats(), null));
    return true;
  };

  function startVoyage(g: Game, v: Voyage) {
    // T47: el arte del primer tramo y del destino se pide ya; el barco sale en
    // turbo cuando el primer tramo está (como mucho VOYAGE_WAIT_MS), así no
    // aparece nada de golpe en el arranque.
    const ready = g.preload(voyagePreload(g.stats(), v.arrival, v.speed));
    if (prefersReducedMotion()) {
      g.moveShip(v.arrival.x, v.arrival.y);
      return;
    }
    voyageRef.current = null;
    pendingVoyage.current = v;
    setVoyage({ placeId: v.placeId, name: v.name });
    void Promise.race([ready, new Promise((r) => setTimeout(r, VOYAGE_WAIT_MS))]).then(() => {
      if (pendingVoyage.current !== v) return;
      pendingVoyage.current = null;
      voyageRef.current = v;
    });
  }

  /** Termina el viaje: `skip` lleva el barco a la llegada de un salto. */
  function endVoyage(skip = false) {
    const v = voyageRef.current ?? pendingVoyage.current;
    voyageRef.current = null;
    pendingVoyage.current = null;
    setVoyage(null);
    if (skip && v) gameRef.current?.moveShip(v.arrival.x, v.arrival.y);
  }
  const layout = vp ? hudLayout(vp, zonePref, { debug }) : null;
  const ship = stats ? { x: stats.x, y: stats.y, heading: stats.heading } : null;
  const target = ship ? tracker.nextTarget(ship) : null;
  const discoveredSet = new Set(discovered);
  const mapData = {
    world: world.config,
    markers,
    targets,
    discovered: discoveredSet,
    selectedId,
    ship,
  };

  const menuCtx: MenuContext | null = layout
    ? {
        settings,
        updateSettings,
        achievements,
        discovered: targets.filter((t) => discoveredSet.has(t.id)),
        minimapZone: layout.minimapZone,
        minimapZones: safeMinimapZones(vp!, { debug }),
        setMinimapZone,
        ship: {
          catalog: shipCatalog,
          current: shipLook,
          pending: shipPending,
          choose: chooseShip,
        } satisfies ShipMenu,
        world: {
          worlds: worlds.list(),
          current: world.id,
          pending: worldPending || !worldReady,
          choose: chooseWorld,
        } satisfies WorldMenu,
        openBottles: () => {
          setMenuOpen(false);
          setBottleSheet({ kind: 'mine' });
        },
        goToIsland: (eventId) => void goToEventIsland(eventId),
        game,
        close: () => setMenuOpen(false),
      }
    : null;

  return (
    <div
      data-testid="juego"
      data-world={adopted === null ? undefined : adopted ? 'adoptado' : 'nuevo'}
      data-ship-style={shipLook?.style}
      data-ship-skin={shipLook?.skin}
      data-ship-flag={shipLook ? shipDress.flag : undefined}
      data-ship-wake={shipLook ? shipDress.wake : undefined}
      data-mundo={world.id}
      data-mision={missionPhase ?? undefined}
      data-delfin={dolphinOut ? 'guiando' : undefined}
      data-tripulante={missionPhase === 'aboard' ? 'a-bordo' : undefined}
      // Dónde está el barco (u, redondeado) y a qué lugar llegó con `?ir=` (T44).
      data-barco={ship ? `${Math.round(ship.x)},${Math.round(ship.y)}` : undefined}
      data-llegada={arrival ? (arrival.done ? arrival.placeId : 'navegando') : undefined}
      // Carga por sectores (T47): sectores pedidos, vistas cargando, calidad y
      // fotogramas con algún objeto a la vista sin su arte (debe ser 0).
      data-sectores={stats?.sectors.join(' ')}
      data-arte-cargando={stats?.artLoading}
      data-arte-faltante={stats?.artMissingFrames}
      data-calidad={stats?.quality}
      // Cambio de mundo (T41): `vortice` o `fundido` mientras dura; y dónde
      // queda en pantalla el origen del mundo (px), para ver cada lugar en su sitio.
      data-cambio-mundo={
        switching === 'vortex' ? 'vortice' : switching === 'fade' ? 'fundido' : undefined
      }
      data-vista={stats ? `${stats.view.x},${stats.view.y}` : undefined}
      style={{
        ...({
          '--mundo-acento': world.theme.ui.accent,
          '--mundo-sobre-acento': world.theme.ui.onAccent,
        } as CSSProperties),
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        overscrollBehavior: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        background: world.theme.sea.base,
      }}
    >
      <canvas ref={canvasRef} className="juego-canvas" />
      {layout && vp ? (
        <div className="juego-hud" data-testid="hud-capa" data-joystick-top={layout.joystick.y}>
          <Link
            href="/"
            className="juego-hud-button juego-home"
            data-hud="inicio"
            style={{
              left: layout.home.x,
              top: layout.home.y,
              width: layout.home.w,
              height: layout.home.h,
            }}
          >
            {msg('juego.gameCanvas.inicio')}
          </Link>
          {layout.balances ? <BalancesChip rect={layout.balances} /> : null}
          {/* Datos del motor: caja visible sólo con `?debug` (O11). Sin él quedan
              ocultos, fuera de la vista y del lector de pantalla: sólo los leen
              las pruebas para saber que el motor ya corre. */}
          <div
            data-testid="hud"
            data-hud="datos"
            className="juego-stats"
            hidden={!layout.stats}
            style={
              layout.stats
                ? {
                    left: layout.stats.x,
                    top: layout.stats.y,
                    width: layout.stats.w,
                    height: layout.stats.h,
                  }
                : undefined
            }
          >
            <div>
              {msg('juego.gameCanvas.fpsUS', {
                v1: stats ? stats.fps.toFixed(0) : '–',
                v2: stats ? stats.speed.toFixed(0) : '–',
                v3: stats?.drifting ? msg('juego.gameCanvas.drift') : '',
              })}
            </div>
            <div style={{ opacity: 0.65 }}>
              {stats
                ? `${stats.direction} · ${stats.shipSource === 'manifest' ? msg('juego.gameCanvas.sprites01') : 'provisional'}`
                : ''}
            </div>
          </div>
          <Compass
            rect={layout.compass}
            angle={ship && target ? compassAngle(ship, target) : null}
            selected={selectedId !== null}
            onClick={() => setMapOpen(true)}
          />
          <MenuAnchor
            rect={layout.menu}
            pulse={menuPulse}
            open={menuOpen}
            onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}
          />
          <BottleBar
            rect={bottleBarRect(vp)}
            found={nearby.flatMap((id) => bottleList?.filter((b) => b.id === id) ?? [])}
            hasOwn={!!bottleList?.some((b) => b.isMine)}
            onOwn={() => setBottleSheet({ kind: 'mine' })}
            onRead={(id) => setBottleSheet({ kind: 'read', id })}
          />
          <Minimap
            data={mapData}
            rect={layout.minimap}
            vp={vp}
            pulse={minimapPulse}
            onExpand={() => setMapOpen(true)}
            onZoneChange={setMinimapZone}
          />
          <NoticeToast shown={notices.current} rect={layout.notice} onDismiss={notices.dismiss} />
          {invitations.reason && !inviteBlocked ? (
            // Sobre la barra de botellas, fuera de la zona del joystick.
            <CarnetInvite
              reason={invitations.reason}
              create={{
                onCreate: () => {
                  invitations.dismiss();
                  openMenu('carnet');
                },
              }}
              onLater={invitations.decline}
              style={{
                left: layout.notice.x,
                width: layout.notice.w,
                bottom: vp.height - bottleBarRect(vp).y + 8,
              }}
            />
          ) : null}
          {talking ? (
            <button
              type="button"
              className="juego-sr-only"
              data-testid="bocadillo-cerrar"
              aria-label={msg('juego.gameCanvas.cerrarDialogo')}
              onClick={() => gameRef.current?.skipDialogue()}
            >
              ×
            </button>
          ) : null}
          <CircuitTimer
            state={circuit.state}
            rect={{ x: layout.home.x, y: layout.home.y + layout.home.h + 6 }}
          />
          {voyage ? (
            <div
              className="juego-rumbo"
              role="status"
              data-testid="rumbo"
              data-lugar={voyage.placeId}
            >
              <span>
                {msg('juego.gameCanvas.rumboA')} <strong>{voyage.name}</strong>…
              </span>
              <button
                type="button"
                className="juego-rumbo-saltar"
                data-testid="rumbo-saltar"
                onClick={() => endVoyage(true)}
              >
                {msg('juego.gameCanvas.saltar')}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {panelEvent && (
        <EventPanel
          event={panelEvent}
          showTicket={ticketFor === panelEvent.id}
          onBuy={() => {
            track('ticket_click_out', { eventId: panelEvent.id, source: 'island' });
            setCheckoutFor(panelEvent.id);
          }}
          onClose={() => setPanel(null)}
        />
      )}
      {!panelEvent && placePanel ? (
        <PlacePanel
          key={placePanel.objectId}
          state={placePanel}
          object={world.config.objects.find((o) => o.identity.id === placePanel.objectId)}
          onClose={() => setPlacePanel(null)}
          onSteer={steerToEvent}
        />
      ) : null}
      {!panelEvent && !placePanel && discountPanel ? (
        <DiscountPanel
          found={discountPanel}
          onClose={() => setDiscountPanel(null)}
          onGoToIsland={(id) => void goToEventIsland(id)}
        />
      ) : null}
      <MinigameLayer
        offer={panelEvent || checkoutFor || placePanel || discountPanel ? null : minigameOffer}
        onDismiss={() => setMinigameOffer(null)}
        world={world}
        settings={settings}
        sink={minigameSink}
      />
      {checkoutFor ? (
        <SandboxCheckout
          eventId={checkoutFor}
          onClose={() => {
            setCheckoutFor(null);
            // Después de comprar, la invitación al Carnet (REQ-IDE-008).
            if (purchasedRef.current) inviteTrigger('purchase');
            purchasedRef.current = false;
          }}
          onConfirmed={(o, s) => {
            purchasedRef.current = true;
            for (const n of purchaseNotices(o, s.event.name)) notify(n);
          }}
          carnet={{
            onOpen: () => {
              purchasedRef.current = false;
              setCheckoutFor(null);
              openMenu('carnet');
            },
          }}
        />
      ) : null}
      {mapOpen && vp ? (
        <ExpandedMap
          data={mapData}
          vp={vp}
          onSelect={selectTarget}
          onClose={() => setMapOpen(false)}
        />
      ) : null}
      {menuOpen && menuCtx ? <OnboardMenu ctx={menuCtx} initial={menuInitial} /> : null}
      {bottleSheet ? (
        <BottleSheet
          mode={bottleSheet}
          world={world.config}
          ship={() => gameRef.current?.stats() ?? null}
          onClose={() => setBottleSheet(null)}
          onOpenCarnet={(userId) => setCarnetOf(userId)}
          onNeedCarnet={() => {
            setBottleSheet(null);
            openMenu('carnet');
          }}
          onMine={() => setBottleSheet({ kind: 'mine' })}
        />
      ) : null}
      {carnetOf ? <CarnetSheet userId={carnetOf} onClose={() => setCarnetOf(null)} /> : null}
      {celebration ? <Celebration key={celebration} onDone={() => setCelebration(0)} /> : null}
      {switching ? (
        // Mientras el mundo cambia, nada responde (T41); el lector de pantalla lo anuncia.
        <div
          className="juego-cambio-mundo"
          data-testid="cambio-mundo"
          role="status"
          onPointerDownCapture={(e) => e.preventDefault()}
        >
          <span className="juego-sr-only">{msg('juego.gameCanvas.cambiandoDeMundo')}</span>
        </div>
      ) : null}
      {error && (
        <p style={{ position: 'absolute', bottom: 16, left: 16, right: 16, textAlign: 'center' }}>
          {error}
        </p>
      )}
    </div>
  );
}
