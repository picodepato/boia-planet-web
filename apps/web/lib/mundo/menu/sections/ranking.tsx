'use client';

import { formatRaceTime, readRecord } from '@boia/engine/circuit';
import type { RankingRow } from '@boia/store';
import Link from 'next/link';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { requireAccount } from '../../../account/gate';
import { useAccount } from '../../../account/use-account';
import { isSupabaseConfigured } from '../../../supabase/config';
import { Avatar } from '../../carnet/avatar';
import { CarnetCard } from '../../carnet/carnet-card';
import '../../carnet/carnet.css';
import { carnetPath } from '../../carnet/share';
import { useCarnet } from '../../carnet/use-carnet';
import { worlds } from '../../demo-world';
import { discoverRandom, pickMember } from '../../discover';
import { type CircuitRow, circuitRanking } from '../../ranking-circuit';
import {
  type CircuitOption,
  type GlobalRow,
  type RankingBoard,
  appendPage,
  boardKey,
  circuitOptions,
  fetchRankingPage,
  hasMore,
  pinnedMine,
  rankingClient,
} from '../../ranking-global';
import { useRepoData } from '../../repo';
import type { MenuContext, MenuSection } from '../types';
import './ranking.css';
import { t } from '../../../i18n';

/**
 * Textos del ranking (docs/propuestas/textos-zonas.md, zona 25; los del
 * ranking global, T87 «i18n keys»). muestra.
 */
export const RANKING_COPY = {
  heading: t('juego.ranking.ranking'),
  localLabel: t('ranking.localLabel'),
  localNotice: t('ranking.localNotice'),
  allTime: t('ranking.tab.allTime'),
  circuit: t('ranking.tab.circuit'),
  tabsAria: t('ranking.tabs.aria'),
  circuitSelect: t('ranking.circuit.select'),
  circuitOption: (circuit: string, world: string) =>
    t('ranking.circuit.option', { circuit, world }),
  noTime: t('lib.ranking.sinVuelta'),
  circuitEmpty: (place: string) => t('ranking.circuit.empty', { place }),
  circuitEmptyAll: (place: string) => t('ranking.circuit.emptyAll', { place }),
  circuitMine: (place: string, time: string, n: number) =>
    t('lib.ranking.tuVuelta', { place, time, n }),
  circuitNote: t('circuit.localRecord'),
  you: t('juego.ranking.tu'),
  youChip: t('ranking.youChip'),
  yourPosition: (n: number, points: number) => t('ranking.yourPosition', { n, points }),
  mineTime: (n: number, total: number, time: string) => t('ranking.mine.time', { n, total, time }),
  minePoints: (n: number, total: number, points: string) =>
    t('ranking.mine.points', { n, total, points }),
  pointsNote: t('ranking.pointsNote'),
  empty: t('ranking.empty'),
  more: t('ranking.more'),
  loading: t('ranking.loading'),
  error: t('ranking.error'),
  retry: t('ranking.retry'),
  guestTime: (time: string) => t('ranking.guest.time', { time }),
  guestPoints: (points: string) => t('ranking.guest.points', { points }),
  guestNone: t('ranking.guest.none'),
  guestCta: t('ranking.guest.cta'),
  sampleTag: 'muestra',
  openCarnet: (name: string) => t('ranking.openCarnet.aria', { name }),
  discover: t('lib.ranking.descubrir'),
  discoverAgain: t('lib.ranking.descubrirOtro'),
  discoverNote: t('lib.ranking.descubrirNota'),
  discoverEmpty: t('lib.ranking.descubrirVacio'),
  discoveredMember: t('lib.ranking.descubiertoMiembro'),
  discoveredArtist: t('lib.ranking.descubiertoArtista'),
  seeCarnet: t('lib.ranking.verSuCarnet'),
} as const;

/**
 * Dos pestañas (T87): los tiempos de un circuito y los puntos de siempre. La
 * de temporada no sale hasta que Hernán defina qué es una temporada.
 */
type Tab = 'circuit' | 'all';
const TABS: readonly Tab[] = ['circuit', 'all'];

const TAB_TEST_ID: Record<Tab, string> = {
  all: 'ranking-tab-siempre',
  circuit: 'ranking-tab-circuito',
};

const TAB_LABEL: Record<Tab, string> = {
  all: RANKING_COPY.allTime,
  circuit: RANKING_COPY.circuit,
};

const pointsFormat = new Intl.NumberFormat('es-ES');
const formatPoints = (n: number) => pointsFormat.format(n);

// ---------------------------------------------------------------------------
// Piezas comunes (modo local y global)

/** Una fila tal como se pinta. */
interface ListRow {
  userId: string;
  position: number | null;
  nickname: string | null;
  avatarKey: string | null;
  /** El valor ya escrito: «1:42,3» o «1420». */
  value: string;
  isMine: boolean;
  isSample: boolean;
  hasCarnet: boolean;
}

function rowName(r: Pick<ListRow, 'isMine' | 'nickname' | 'userId'>): string {
  if (r.isMine) return r.nickname ? `${r.nickname} (${RANKING_COPY.you})` : RANKING_COPY.you;
  return r.nickname ?? r.userId;
}

/** Cada fila abre su Carnet; la propia sin Carnet, la invitación a crearlo. */
function rowHref(r: Pick<ListRow, 'isMine' | 'hasCarnet' | 'userId'>): string {
  return r.isMine && (!r.hasCarnet || !r.userId) ? '/carnet' : carnetPath(r.userId);
}

/**
 * Una fila (T87): puesto, avatar, apodo y valor; toda la fila es el enlace
 * a su Carnet (REQ-IDE-017). Con `onOwnCarnet` (el mar 3D), la propia abre
 * «Mi Carnet» dentro del mundo.
 */
function RankRow({
  row,
  pinned = false,
  onOwnCarnet,
}: {
  row: ListRow;
  pinned?: boolean;
  onOwnCarnet: (() => void) | undefined;
}) {
  const name = rowName(row);
  return (
    <li
      className={row.isMine ? 'ranking-row is-mine' : 'ranking-row'}
      aria-current={row.isMine ? 'true' : undefined}
      data-testid={row.isMine ? 'ranking-fila-mia' : `ranking-fila-${row.userId}`}
      data-puesto={row.position ?? undefined}
      data-fijada={pinned ? 'si' : undefined}
    >
      <Link
        className="ranking-row__link"
        href={rowHref(row)}
        prefetch={false}
        aria-label={RANKING_COPY.openCarnet(name)}
        onClick={(e) => {
          if (!row.isMine || !onOwnCarnet) return;
          e.preventDefault();
          onOwnCarnet();
        }}
      >
        <span className="ranking-row__pos">{row.position ?? '–'}</span>
        <Avatar avatarKey={row.avatarKey} image={null} size={28} name={name} />
        <span className="ranking-row__name">
          <span className="ranking-row__nick">{row.nickname ?? RANKING_COPY.you}</span>
          {row.isMine ? <span className="ranking-chip">{RANKING_COPY.youChip}</span> : null}
          {row.isSample ? (
            <span className="ranking-row__sample">{RANKING_COPY.sampleTag}</span>
          ) : null}
        </span>
        <span className="ranking-row__value">{row.value}</span>
      </Link>
    </li>
  );
}

function RankList({
  rows,
  scope,
  pinned,
  onOwnCarnet,
  listRef,
}: {
  rows: readonly ListRow[];
  scope: 'all' | 'circuit';
  pinned?: ListRow | null;
  onOwnCarnet: (() => void) | undefined;
  listRef?: React.Ref<HTMLOListElement>;
}) {
  return (
    <ol className="ranking-list" data-testid="ranking-lista" data-scope={scope} ref={listRef}>
      {rows.map((r) => (
        <RankRow key={r.isMine ? `yo:${r.userId}` : r.userId} row={r} onOwnCarnet={onOwnCarnet} />
      ))}
      {pinned ? (
        <>
          <li className="ranking-sep" aria-hidden="true">
            ···
          </li>
          <RankRow row={pinned} pinned onOwnCarnet={onOwnCarnet} />
        </>
      ) : null}
    </ol>
  );
}

/** El control segmentado de las pestañas: un tablist de verdad (flechas, Inicio, Fin). */
function Tabs({
  tab,
  onChange,
  panelId,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
  panelId: string;
}) {
  const refs = useRef<Record<Tab, HTMLButtonElement | null>>({ all: null, circuit: null });
  const onKey = (e: ReactKeyboardEvent) => {
    const i = TABS.indexOf(tab);
    const next =
      e.key === 'ArrowRight'
        ? TABS[(i + 1) % TABS.length]
        : e.key === 'ArrowLeft'
          ? TABS[(i - 1 + TABS.length) % TABS.length]
          : e.key === 'Home'
            ? TABS[0]
            : e.key === 'End'
              ? TABS[TABS.length - 1]
              : null;
    if (!next) return;
    e.preventDefault();
    onChange(next);
    refs.current[next]?.focus();
  };
  return (
    <div className="ranking-tabs" role="tablist" aria-label={RANKING_COPY.tabsAria}>
      {TABS.map((id) => (
        <button
          key={id}
          ref={(el) => {
            refs.current[id] = el;
          }}
          type="button"
          role="tab"
          id={`${panelId}-tab-${id}`}
          className="ranking-tab"
          aria-selected={tab === id}
          aria-controls={panelId}
          tabIndex={tab === id ? 0 : -1}
          data-testid={TAB_TEST_ID[id]}
          onClick={() => onChange(id)}
          onKeyDown={onKey}
        >
          {TAB_LABEL[id]}
        </button>
      ))}
    </div>
  );
}

/** El selector de circuito (sólo en la pestaña Circuito): un circuito por mundo. */
function CircuitSelect({
  options,
  value,
  onChange,
}: {
  options: readonly CircuitOption[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <label className="ranking-select">
      <span className="ranking-select__label">{RANKING_COPY.circuitSelect}</span>
      <select
        data-testid="ranking-circuito"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {RANKING_COPY.circuitOption(o.place, o.worldName)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Las opciones del selector y la elegida (por defecto, la del mundo que se juega). */
function useCircuitChoice(season: string) {
  const options = useMemo(
    () =>
      circuitOptions(
        worlds.list().map((w) => ({ id: w.id, name: w.name, config: worlds.get(w.id).config })),
        season,
      ),
    [season],
  );
  const [picked, setPicked] = useState<string | null>(null);
  const option = options.find((o) => o.key === picked) ?? options[0] ?? null;
  return { options, option, pick: setPicked };
}

/**
 * «Descubrir a un BOIERO» (T66): enseña aquí mismo el Carnet de un miembro
 * al azar, que también puede ser uno de los artistas (sus Carnets salen de
 * su ficha). Otro toque, otro distinto.
 */
function Discover() {
  const { data: members } = useRepoData((r) => r.carnet.members());
  const [shown, setShown] = useState<string | null>(null);
  const discover = () => {
    const next = pickMember(members ?? [], discoverRandom, shown);
    if (next) setShown(next.userId);
  };
  const kind = members?.find((m) => m.userId === shown)?.kind ?? null;
  return (
    <div className="juego-ranking-descubrir" data-testid="ranking-descubrir-zona">
      <button
        type="button"
        className="juego-button"
        data-testid="ranking-descubrir"
        disabled={!members}
        onClick={discover}
      >
        {shown ? RANKING_COPY.discoverAgain : RANKING_COPY.discover}
      </button>
      <p className="juego-muted">
        {members && members.length === 0 ? RANKING_COPY.discoverEmpty : RANKING_COPY.discoverNote}
      </p>
      {shown && kind ? <Discovered userId={shown} kind={kind} /> : null}
    </div>
  );
}

function Discovered({ userId, kind }: { userId: string; kind: 'member' | 'artist' }) {
  const { data } = useCarnet(userId);
  if (!data?.carnet) return null;
  return (
    <section
      className="juego-ranking-descubierto"
      data-testid="ranking-descubierto"
      data-user-id={userId}
      data-kind={kind}
      aria-live="polite"
    >
      <p className="juego-ranking-rotulo">
        {kind === 'artist' ? RANKING_COPY.discoveredArtist : RANKING_COPY.discoveredMember}
      </p>
      <CarnetCard carnet={data.carnet} extras={data.extras} />
      <p>
        <Link href={carnetPath(userId)} prefetch={false} className="juego-link">
          {RANKING_COPY.seeCarnet}
        </Link>
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Modo local (D-20): el ranking de este navegador con los miembros de muestra

function localPointsRow(r: RankingRow): ListRow {
  return {
    userId: r.userId,
    position: r.position,
    nickname: r.nickname,
    avatarKey: null,
    value: formatPoints(r.points),
    isMine: r.isMine,
    isSample: r.isSample,
    hasCarnet: r.hasCarnet,
  };
}

function localCircuitRow(r: CircuitRow): ListRow {
  return {
    userId: r.userId,
    position: r.position,
    nickname: r.nickname,
    avatarKey: null,
    value: r.ms !== null ? formatRaceTime(r.ms) : RANKING_COPY.noTime,
    isMine: r.isMine,
    isSample: r.isSample,
    hasCarnet: r.hasCarnet,
  };
}

/** El récord del circuito de este navegador entre los tiempos de muestra (T56). */
function LocalCircuit({
  option,
  onOwnCarnet,
}: {
  option: CircuitOption | null;
  onOwnCarnet: (() => void) | undefined;
}) {
  const place = option?.place ?? RANKING_COPY.circuit;
  const { data } = useRepoData(
    async (r) => {
      const [carnet, record] = await Promise.all([
        r.carnet.mine(),
        option
          ? readRecord(r.progress, { id: option.circuit, version: option.version })
          : Promise.resolve(null),
      ]);
      return circuitRanking({
        nickname: carnet?.nickname ?? null,
        hasCarnet: !!carnet,
        bestMs: record?.bestMs ?? null,
        ...(carnet ? { userId: carnet.userId } : {}),
      });
    },
    [option?.key],
  );
  if (!data) return <p className="ranking-mine">{RANKING_COPY.loading}</p>;
  const mine = data.mine;
  return (
    <>
      <p className="ranking-mine" data-testid="ranking-mi-puesto">
        {mine.ms !== null && mine.position !== null
          ? RANKING_COPY.circuitMine(place, formatRaceTime(mine.ms), mine.position)
          : RANKING_COPY.circuitEmpty(place)}
      </p>
      <RankList rows={data.rows.map(localCircuitRow)} scope="circuit" onOwnCarnet={onOwnCarnet} />
      <p className="juego-muted">{RANKING_COPY.circuitNote}</p>
    </>
  );
}

/** Los puntos de siempre de este navegador y de los miembros de muestra. */
function LocalPoints({ onOwnCarnet }: { onOwnCarnet: (() => void) | undefined }) {
  const { data } = useRepoData((r) => r.progress.ranking({}), []);
  if (!data) return <p className="ranking-mine">{RANKING_COPY.loading}</p>;
  return (
    <>
      <p className="ranking-mine" data-testid="ranking-mi-puesto">
        {RANKING_COPY.yourPosition(data.mine.position, data.mine.points)}
      </p>
      <RankList rows={data.rows.map(localPointsRow)} scope="all" onOwnCarnet={onOwnCarnet} />
      <p className="juego-muted">{RANKING_COPY.pointsNote}</p>
    </>
  );
}

function LocalRanking({
  season,
  onOwnCarnet,
}: {
  season: string;
  onOwnCarnet: (() => void) | undefined;
}) {
  const [tab, setTab] = useState<Tab>('circuit');
  const circuit = useCircuitChoice(season);
  const panelId = 'ranking-panel-local';
  return (
    <div className="juego-ranking ranking" data-testid="ranking" data-modo="local">
      <p className="juego-ranking-rotulo" data-testid="ranking-rotulo">
        {RANKING_COPY.localLabel}
      </p>
      <p className="juego-muted">{RANKING_COPY.localNotice}</p>
      <Tabs tab={tab} onChange={setTab} panelId={panelId} />
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${panelId}-tab-${tab}`}
        className="ranking-panel"
      >
        {tab === 'circuit' ? (
          <>
            {circuit.option ? (
              <CircuitSelect
                options={circuit.options}
                value={circuit.option.key}
                onChange={circuit.pick}
              />
            ) : null}
            <LocalCircuit option={circuit.option} onOwnCarnet={onOwnCarnet} />
          </>
        ) : (
          <LocalPoints onOwnCarnet={onOwnCarnet} />
        )}
      </div>
      <Discover />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Con cuentas (plan 008, T92): las tablas globales de Supabase

interface BoardState {
  key: string;
  status: 'loading' | 'ready' | 'error';
  rows: GlobalRow[];
  total: number;
  mine: GlobalRow | null;
  /** Filas de la última página que llegó (0: no hay más). */
  lastSize: number;
  loadingMore: boolean;
}

function emptyBoard(key: string): BoardState {
  return {
    key,
    status: 'loading',
    rows: [],
    total: 0,
    mine: null,
    lastSize: 0,
    loadingMore: false,
  };
}

/**
 * Una tabla global por páginas: el top al abrir y la siguiente página con
 * `more()`. Vuelve a empezar al cambiar de tabla o de cuenta, o con `reload()`.
 */
function useGlobalBoard(board: RankingBoard | null, viewer: string | null) {
  const key = board ? `${boardKey(board)}|${viewer ?? ''}` : '';
  const boardRef = useRef(board);
  boardRef.current = board;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<BoardState>(() => emptyBoard(key));
  useEffect(() => {
    const b = boardRef.current;
    if (!b) return;
    let alive = true;
    setState(emptyBoard(key));
    rankingClient()
      .then((c) => {
        if (!c) throw new Error('sin Supabase');
        return fetchRankingPage(c, b, 0);
      })
      .then(
        (p) =>
          alive &&
          setState({
            key,
            status: 'ready',
            rows: p.rows,
            total: p.total,
            mine: p.mine,
            lastSize: p.rows.length,
            loadingMore: false,
          }),
        (err: unknown) => {
          console.warn('[boia] no se pudo leer el ranking', err);
          if (alive) setState({ ...emptyBoard(key), status: 'error' });
        },
      );
    return () => {
      alive = false;
    };
  }, [key, attempt]);

  const current = state.key === key ? state : emptyBoard(key);

  const more = async (): Promise<number> => {
    const b = boardRef.current;
    if (!b || current.status !== 'ready' || current.loadingMore) return -1;
    const from = current.rows.length;
    setState((s) => (s.key === key ? { ...s, loadingMore: true } : s));
    try {
      const c = await rankingClient();
      if (!c) throw new Error('sin Supabase');
      const p = await fetchRankingPage(c, b, from);
      setState((s) =>
        s.key === key
          ? {
              ...s,
              rows: appendPage(s.rows, p.rows),
              total: p.total,
              mine: p.mine,
              lastSize: p.rows.length,
              loadingMore: false,
            }
          : s,
      );
      return from;
    } catch (err) {
      console.warn('[boia] no se pudo leer el ranking', err);
      setState((s) => (s.key === key ? { ...s, loadingMore: false } : s));
      return -1;
    }
  };

  return { state: current, more, reload: () => setAttempt((n) => n + 1) };
}

function globalRow(r: GlobalRow, board: RankingBoard): ListRow {
  return {
    userId: r.userId,
    position: r.position,
    nickname: r.nickname,
    avatarKey: r.avatarKey,
    value: board.kind === 'points' ? formatPoints(r.value) : formatRaceTime(r.value),
    isMine: r.isMine,
    isSample: false,
    hasCarnet: true,
  };
}

/**
 * Lo que ve un invitado arriba (T87): su récord o sus puntos de este
 * navegador y «Entrar en el ranking», que abre la hoja de acceso con el
 * motivo `ranking`. Al entrar, lo del navegador pasa a la cuenta (decisión 4).
 */
function GuestBox({ board, onEntered }: { board: RankingBoard; onEntered: () => void }) {
  const { data } = useRepoData(
    async (r) =>
      board.kind === 'points'
        ? { points: (await r.progress.ranking({})).mine.points, ms: null }
        : {
            points: 0,
            ms:
              (await readRecord(r.progress, { id: board.circuit, version: board.version }))
                ?.bestMs ?? null,
          },
    [boardKey(board)],
  );
  const text =
    board.kind === 'points'
      ? data && data.points > 0
        ? RANKING_COPY.guestPoints(formatPoints(data.points))
        : RANKING_COPY.guestNone
      : data?.ms != null
        ? RANKING_COPY.guestTime(formatRaceTime(data.ms))
        : RANKING_COPY.guestNone;
  return (
    <div className="ranking-guest" data-testid="ranking-invitado">
      <p className="ranking-guest__text">
        <span aria-hidden="true">🏆</span>
        <span>{text}</span>
      </p>
      <button
        type="button"
        className="ranking-cta"
        data-testid="ranking-entrar"
        onClick={() => {
          void requireAccount('ranking').then((ok) => {
            if (ok) onEntered();
          });
        }}
      >
        {RANKING_COPY.guestCta}
      </button>
    </div>
  );
}

function GlobalBoard({
  board,
  place,
  viewer,
  onOwnCarnet,
  reloadSignal,
}: {
  board: RankingBoard;
  place: string;
  viewer: string | null;
  onOwnCarnet: (() => void) | undefined;
  reloadSignal: number;
}) {
  const { state, more, reload } = useGlobalBoard(board, viewer);
  const listRef = useRef<HTMLOListElement>(null);
  const [focusFrom, setFocusFrom] = useState<number | null>(null);
  const signal = useRef(reloadSignal);
  useEffect(() => {
    if (signal.current === reloadSignal) return;
    signal.current = reloadSignal;
    reload();
  }, [reloadSignal, reload]);
  // «Mostrar más» lleva el foco a la primera fila nueva (T87, accesibilidad).
  useEffect(() => {
    if (focusFrom === null) return;
    const rows = listRef.current?.querySelectorAll<HTMLElement>('.ranking-row:not([data-fijada])');
    rows?.[focusFrom]?.querySelector<HTMLElement>('a')?.focus();
    setFocusFrom(null);
  }, [state.rows.length, focusFrom]);

  if (state.status === 'loading') {
    return (
      <p className="ranking-mine" role="status">
        {RANKING_COPY.loading}
      </p>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="ranking-error" role="alert" data-testid="ranking-error">
        <p>{RANKING_COPY.error}</p>
        <button type="button" className="ranking-more" onClick={reload}>
          {RANKING_COPY.retry}
        </button>
      </div>
    );
  }
  const mine = state.mine;
  const mineLine = mine
    ? board.kind === 'points'
      ? RANKING_COPY.minePoints(mine.position, state.total, formatPoints(mine.value))
      : RANKING_COPY.mineTime(mine.position, state.total, formatRaceTime(mine.value))
    : board.kind === 'circuit' && viewer
      ? RANKING_COPY.circuitEmpty(place)
      : null;
  const pinned = pinnedMine(state.rows, mine);
  const moreLeft = hasMore(state.rows.length, state.total, state.lastSize);
  return (
    <>
      {mineLine ? (
        <p className="ranking-mine" data-testid="ranking-mi-puesto">
          {mineLine}
        </p>
      ) : null}
      {state.rows.length === 0 ? (
        <p className="ranking-empty" data-testid="ranking-vacio">
          {board.kind === 'points' ? RANKING_COPY.empty : RANKING_COPY.circuitEmptyAll(place)}
        </p>
      ) : (
        <RankList
          rows={state.rows.map((r) => globalRow(r, board))}
          scope={board.kind === 'points' ? 'all' : 'circuit'}
          pinned={pinned ? globalRow(pinned, board) : null}
          onOwnCarnet={onOwnCarnet}
          listRef={listRef}
        />
      )}
      {moreLeft ? (
        <button
          type="button"
          className="ranking-more"
          data-testid="ranking-mas"
          disabled={state.loadingMore}
          aria-busy={state.loadingMore}
          onClick={() => {
            void more().then((from) => {
              if (from >= 0) setFocusFrom(from);
            });
          }}
        >
          {state.loadingMore ? RANKING_COPY.loading : RANKING_COPY.more}
        </button>
      ) : null}
    </>
  );
}

function GlobalRanking({
  season,
  onOwnCarnet,
}: {
  season: string;
  onOwnCarnet: (() => void) | undefined;
}) {
  const account = useAccount();
  const member = account.status === 'member' && !!account.userId;
  const viewer = member ? account.userId : null;
  const [tab, setTab] = useState<Tab>('circuit');
  const [reloadSignal, setReloadSignal] = useState(0);
  const circuit = useCircuitChoice(season);
  const board: RankingBoard | null =
    tab === 'all'
      ? { kind: 'points' }
      : circuit.option
        ? { kind: 'circuit', circuit: circuit.option.circuit, version: circuit.option.version }
        : null;
  const place = circuit.option?.place ?? RANKING_COPY.circuit;
  const panelId = 'ranking-panel-global';
  return (
    <div
      className="juego-ranking ranking"
      data-testid="ranking"
      data-modo="global"
      data-cuenta={member ? 'miembro' : 'invitado'}
    >
      <Tabs tab={tab} onChange={setTab} panelId={panelId} />
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${panelId}-tab-${tab}`}
        className="ranking-panel"
      >
        {tab === 'circuit' && circuit.option ? (
          <CircuitSelect
            options={circuit.options}
            value={circuit.option.key}
            onChange={circuit.pick}
          />
        ) : null}
        {board && !member && account.status !== 'loading' ? (
          <GuestBox board={board} onEntered={() => setReloadSignal((n) => n + 1)} />
        ) : null}
        {board ? (
          <GlobalBoard
            key={boardKey(board)}
            board={board}
            place={place}
            viewer={viewer}
            onOwnCarnet={onOwnCarnet}
            reloadSignal={reloadSignal}
          />
        ) : (
          <p className="ranking-empty">{RANKING_COPY.circuitEmptyAll(place)}</p>
        )}
      </div>
      <Discover />
    </div>
  );
}

/**
 * 🏆 El ranking (REQ-IDE-053, REQ-AVE-034, decisión 8 del plan 008) en el
 * diseño de T87: «Circuito» (los tiempos de un circuito, con su selector) y
 * «De siempre» (los puntos), cada fila abre su Carnet (REQ-IDE-017).
 *
 * - Con Supabase: las tablas globales de todos los miembros, el top 50 y
 *   «Mostrar más» hasta listar a todos, la fila «tú» en su sitio o fijada
 *   debajo; un invitado las lee y tiene «Entrar en el ranking».
 * - En modo local (D-20): los puntos y el récord de este navegador junto a
 *   los miembros de muestra, rotulado como local.
 *
 * Lo usan el Menú de a bordo y /mar (T56).
 */
export function RankingPanel({
  season,
  onOwnCarnet,
}: {
  /** El mundo que se juega: su circuito sale primero en el selector. */
  season: string;
  /** Ya no se usa (era la pestaña de temporada); se acepta por compatibilidad. */
  worldName?: string;
  /** La fila propia abre esto en vez de /carnet (el Carnet dentro del mar, T56). */
  onOwnCarnet?: () => void;
}) {
  return isSupabaseConfigured() ? (
    <GlobalRanking season={season} onOwnCarnet={onOwnCarnet} />
  ) : (
    <LocalRanking season={season} onOwnCarnet={onOwnCarnet} />
  );
}

function Ranking({ ctx }: { ctx: MenuContext }) {
  return <RankingPanel season={ctx.world.current} />;
}

export const rankingSection: MenuSection = {
  id: 'ranking',
  icon: '🏆',
  label: RANKING_COPY.heading,
  group: 'progress',
  Component: Ranking,
};
