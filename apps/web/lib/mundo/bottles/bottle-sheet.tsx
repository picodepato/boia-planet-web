'use client';

import { BOTTLE_MESSAGE_MAX, BOTTLE_REPORT_REASON_MAX, charLength } from '@boia/contracts';
import { type ShipPose, findDropSpot } from '@boia/engine/bottles';
import { type BoiaRepository, type BottleView, isStoreError } from '@boia/store';
import type { Vec2, WorldConfig } from '@boia/world';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { requireAccount } from '../../account/gate';
import { useAccount } from '../../account/use-account';
import { emitSignal } from '../achievements';
import { useRepoData } from '../repo';
import { t } from '../../i18n';

/**
 * Botellas (REQ-IDE-040…044): la propia (echarla junto al barco, editarla,
 * retirarla o echar otra, que la sustituye) y las que se encuentran en el mar (leerlas, ver el Carnet de
 * quien la escribió, reportarlas). Leer no la quita. Nunca dan puntos ni
 * monedas. Sin mensajería privada: esto es todo lo social del mar.
 *
 * Con Supabase (T93, decisión 12) las botellas son de todos: el mar enseña
 * las 10 más recientes de todas las cuentas, el invitado las lee y, para
 * echar o reportar una, se le pide la cuenta (`requireAccount('carnet')`),
 * que trae su Carnet. El mensaje pasa el filtro (sin enlaces, emails,
 * teléfonos ni palabras ofensivas) antes de mandarse.
 */

export type BottleSheetMode = { kind: 'mine' } | { kind: 'read'; id: string };

/** Textos de la interfaz. muestra */
export const BOTTLE_COPY = {
  rules: t('juego.bottleSheet.unaBotellaPorPersona'),
  localOnly: t('bottle.localOnly'),
  global: t('mar.botella.global'),
  needCarnet: t('juego.bottleSheet.paraEcharBotellasNecesitas'),
  needCarnetReport: t('juego.bottleSheet.paraReportarUnaBotella'),
  noSpot: t('juego.bottleSheet.aquiSoloHayTierra'),
  conflict: t('bottle.conflict'),
  gone: t('bottle.gone'),
  reported: t('bottle.report.done'),
  reportedAgain: t('bottle.report.again'),
  retireConfirm: t('bottle.retire.confirm'),
} as const;

function Sheet({
  title,
  onClose,
  children,
  testId,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  testId: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="juego-overlay" onClick={onClose}>
      <section
        ref={ref}
        tabIndex={-1}
        className="juego-map juego-sheet"
        role="dialog"
        aria-label={title}
        data-testid={testId}
        onClick={(e) => e.stopPropagation()}
        // El teclado de la hoja (escribir) no mueve el barco.
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') onClose();
        }}
      >
        <header className="juego-sheet-head">
          <h2>{title}</h2>
          <button
            type="button"
            className="juego-close"
            onClick={onClose}
            aria-label={t('juego.bottleSheet.cerrar')}
          >
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function MessageField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const n = charLength(value.trim());
  return (
    <label className="juego-field">
      <span>{label}</span>
      <textarea
        data-testid="botella-texto"
        value={value}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
      />
      <small className={n > BOTTLE_MESSAGE_MAX ? 'carnet-error' : 'juego-muted'}>
        {n}/{BOTTLE_MESSAGE_MAX}
      </small>
    </label>
  );
}

const messageOk = (v: string) => {
  const n = charLength(v.trim());
  return n >= 1 && n <= BOTTLE_MESSAGE_MAX;
};

/** Lo que el filtro no deja pasar (T93): enlaces, emails, teléfonos, palabras ofensivas. */
const FILTER_COPY = {
  text_link: 'mar.botella.filtro.link',
  text_email: 'mar.botella.filtro.email',
  text_phone: 'mar.botella.filtro.phone',
  text_offensive: 'mar.botella.filtro.offensive',
} as const;

function errorText(e: unknown): string {
  if (isStoreError(e, 'invalid') && e.message in FILTER_COPY) {
    return t(FILTER_COPY[e.message as keyof typeof FILTER_COPY]);
  }
  if (isStoreError(e, 'conflict')) return BOTTLE_COPY.conflict;
  if (isStoreError(e, 'no_carnet')) return BOTTLE_COPY.needCarnet;
  if (isStoreError(e, 'not_found')) return BOTTLE_COPY.gone;
  if (isStoreError(e, 'invalid')) {
    return /tierra|mar/.test((e as Error).message)
      ? t('juego.bottleSheet.aquiNoPuedeFlotar', {
          message: (e as Error).message.replace(/^botella: /, ''),
        })
      : t('juego.bottleSheet.revisaElMensaje', {
          message: (e as Error).message.replace(/^botella: /, ''),
        });
  }
  return t('juego.bottleSheet.noSeHaPodido');
}

/**
 * La botella propia: echarla, editarla o retirarla. `dropSpot` dice dónde
 * cae (posición del mapa compartido, junto al barco), o null si alrededor
 * sólo hay tierra. También la usa /mar (T56).
 */
export function MyBottle({
  repo,
  dropSpot,
  onNeedCarnet,
  onClose,
}: {
  repo: BoiaRepository;
  dropSpot: () => Vec2 | null;
  onNeedCarnet: () => void;
  onClose: () => void;
}) {
  const { data } = useRepoData(async (r) => ({
    carnet: await r.carnet.mine(),
    bottle: await r.bottles.mine(),
  }));
  const account = useAccount();
  /** Con Supabase las botellas son de todos y echarlas pide la cuenta (T93). */
  const global = account.status !== 'local';
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  /** Escribiendo otra con la suya aún en el mar: al echarla, la sustituye. */
  const [replacing, setReplacing] = useState(false);
  const [confirmRetire, setConfirmRetire] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  if (!data || account.status === 'loading')
    return <p className="juego-muted">{t('empty.loading')}</p>;
  if (global ? account.status !== 'member' : !data.carnet) {
    return (
      <div data-testid="botella-sin-carnet">
        <p>{global ? t('mar.botella.pideCuenta') : BOTTLE_COPY.needCarnet}</p>
        <button
          type="button"
          className="juego-button"
          onClick={() => (global ? void requireAccount('carnet') : onNeedCarnet())}
        >
          {global ? t('mar.botella.entrar') : t('carnet.create')}
        </button>
      </div>
    );
  }

  const run = (fn: () => Promise<unknown>, done?: () => void) => {
    setBusy(true);
    setError(null);
    fn()
      .then(() => done?.())
      .catch((e: unknown) => setError(errorText(e)))
      .finally(() => setBusy(false));
  };

  const bottle = data.bottle;
  const errorLine = error ? (
    <p className="carnet-error" role="alert" data-testid="botella-error">
      {error}
    </p>
  ) : null;

  if (!bottle || replacing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const spot = dropSpot();
          if (!spot) {
            setError(BOTTLE_COPY.noSpot);
            return;
          }
          run(
            () =>
              repo.bottles
                .place({ message: text.trim(), x: spot.x, y: spot.y })
                .then((b) => emitSignal(repo, { trigger: 'throw_bottle', bottleId: b.id })),
            () => {
              setText('');
              setReplacing(false);
              onClose();
            },
          );
        }}
      >
        {note ? <p>{note}</p> : null}
        <p className="juego-muted">{BOTTLE_COPY.rules}</p>
        {bottle ? (
          <p className="juego-muted" data-testid="botella-sustituye">
            {t('juego.bottleSheet.sustituyeALaTuya')}
          </p>
        ) : null}
        <p
          className="juego-muted"
          data-testid={global ? 'botella-aviso-global' : 'botella-aviso-local'}
        >
          {global ? BOTTLE_COPY.global : BOTTLE_COPY.localOnly}
        </p>
        <MessageField value={text} onChange={setText} label={t('bottle.field')} />
        {errorLine}
        <button
          type="submit"
          className="juego-button"
          data-testid="botella-echar"
          disabled={busy || !messageOk(text)}
        >
          {t('bottle.throw')}
        </button>
        {bottle ? (
          <button
            type="button"
            className="juego-button is-quiet"
            onClick={() => setReplacing(false)}
          >
            {t('carnet.cancel')}
          </button>
        ) : null}
      </form>
    );
  }

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => repo.bottles.edit(bottle.id, { message: text.trim() }),
            () => {
              setEditing(false);
              setNote(t('bottle.status.updated'));
            },
          );
        }}
      >
        <MessageField value={text} onChange={setText} label={t('bottle.field')} />
        {errorLine}
        <div className="carnet-actions">
          <button
            type="submit"
            className="juego-button"
            data-testid="botella-guardar"
            disabled={busy || !messageOk(text)}
          >
            {t('juego.bottleSheet.guardar')}
          </button>
          <button type="button" className="juego-button is-quiet" onClick={() => setEditing(false)}>
            {t('carnet.cancel')}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div data-testid="botella-mia">
      {note ? <p>{note}</p> : null}
      <p className="juego-muted">
        {t('juego.bottleSheet.tuBotellaFlotaEn', {
          localOnly: global ? BOTTLE_COPY.global : BOTTLE_COPY.localOnly,
        })}
      </p>
      <blockquote className="botella-mensaje" data-testid="botella-mensaje">
        {bottle.message}
      </blockquote>
      {errorLine}
      {confirmRetire ? (
        <div className="carnet-actions">
          <p>{BOTTLE_COPY.retireConfirm}</p>
          <button
            type="button"
            className="juego-button"
            data-testid="botella-retirar-si"
            disabled={busy}
            onClick={() =>
              run(
                () => repo.bottles.retire(bottle.id),
                () => {
                  setConfirmRetire(false);
                  setNote(t('bottle.status.retired'));
                },
              )
            }
          >
            {t('bottle.retire.yes')}
          </button>
          <button
            type="button"
            className="juego-button is-quiet"
            onClick={() => setConfirmRetire(false)}
          >
            {t('juego.bottleSheet.no')}
          </button>
        </div>
      ) : (
        <div className="carnet-actions">
          <button
            type="button"
            className="juego-button"
            data-testid="botella-editar"
            onClick={() => {
              setText(bottle.message);
              setNote(null);
              setEditing(true);
            }}
          >
            {t('juego.bottleSheet.editar')}
          </button>
          <button
            type="button"
            className="juego-button"
            data-testid="botella-echar-otra"
            onClick={() => {
              setText('');
              setNote(null);
              setReplacing(true);
            }}
          >
            {t('juego.bottleSheet.echarOtra')}
          </button>
          <button
            type="button"
            className="juego-button is-quiet"
            data-testid="botella-retirar"
            onClick={() => setConfirmRetire(true)}
          >
            {t('bottle.retire')}
          </button>
        </div>
      )}
    </div>
  );
}

/** Una botella encontrada en el mar: se lee (queda registrado) y sigue flotando. También en /mar. */
export function FoundBottle({
  repo,
  id,
  onOpenCarnet,
  onNeedCarnet,
  onMine,
}: {
  repo: BoiaRepository;
  id: string;
  onOpenCarnet: (userId: string) => void;
  onNeedCarnet: () => void;
  onMine: () => void;
}) {
  const [bottle, setBottle] = useState<BottleView | null | undefined>(undefined);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [needCarnet, setNeedCarnet] = useState(false);
  const global = useAccount().status !== 'local';

  useEffect(() => {
    let alive = true;
    repo.bottles.read(id).then(
      (b) => {
        if (!b.isMine) void emitSignal(repo, { trigger: 'read_bottle', bottleId: b.id });
        if (alive) setBottle(b);
      },
      () => alive && setBottle(null),
    );
    return () => {
      alive = false;
    };
  }, [repo, id]);

  if (bottle === undefined)
    return <p className="juego-muted">{t('juego.bottleSheet.abriendoLaBotella')}</p>;
  if (bottle === null) return <p>{BOTTLE_COPY.gone}</p>;

  return (
    <div data-testid="botella-leida">
      <p className="carnet-kicker">
        {bottle.isMine
          ? t('bottle.title.own')
          : t('bottle.title.from', { name: bottle.authorNickname ?? 'alguien' })}
      </p>
      <blockquote className="botella-mensaje" data-testid="botella-mensaje">
        {bottle.message}
      </blockquote>
      {bottle.isMine ? (
        <button type="button" className="juego-button" onClick={onMine}>
          {t('juego.bottleSheet.editarORetirar')}
        </button>
      ) : (
        <>
          <div className="carnet-actions">
            <button
              type="button"
              className="juego-button"
              data-testid="botella-ver-carnet"
              onClick={() => onOpenCarnet(bottle.authorId)}
            >
              {t('bottle.viewCarnet')}
            </button>
            {!reporting && !result ? (
              <button
                type="button"
                className="juego-button is-quiet"
                data-testid="botella-reportar"
                onClick={() => setReporting(true)}
              >
                {t('bottle.report')}
              </button>
            ) : null}
          </div>
          {reporting ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                repo.bottles.report(bottle.id, reason.trim() || null).then(
                  (r) => {
                    setReporting(false);
                    setResult(r.first ? BOTTLE_COPY.reported : BOTTLE_COPY.reportedAgain);
                  },
                  (err: unknown) => {
                    if (isStoreError(err, 'no_carnet')) setNeedCarnet(true);
                    else setResult(errorText(err));
                  },
                );
              }}
            >
              <label className="juego-field">
                <span>{t('bottle.report.reason')}</span>
                <textarea
                  value={reason}
                  maxLength={BOTTLE_REPORT_REASON_MAX}
                  rows={2}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              {needCarnet ? (
                <p className="carnet-error" data-testid="botella-reporte-sin-carnet">
                  {global ? t('mar.botella.pideCuentaReporte') : BOTTLE_COPY.needCarnetReport}{' '}
                  <button
                    type="button"
                    className="juego-link"
                    onClick={() =>
                      global
                        ? void requireAccount('carnet').then((ok) => ok && setNeedCarnet(false))
                        : onNeedCarnet()
                    }
                  >
                    {global ? t('mar.botella.entrar') : t('carnet.create')}
                  </button>
                </p>
              ) : null}
              <div className="carnet-actions">
                <button
                  type="submit"
                  className="juego-button"
                  data-testid="botella-reportar-enviar"
                >
                  {t('bottle.report.send')}
                </button>
                <button
                  type="button"
                  className="juego-button is-quiet"
                  onClick={() => setReporting(false)}
                >
                  {t('carnet.cancel')}
                </button>
              </div>
            </form>
          ) : null}
          {result ? <p data-testid="botella-reporte">{result}</p> : null}
        </>
      )}
    </div>
  );
}

export function BottleSheet({
  mode,
  world,
  ship,
  onClose,
  onOpenCarnet,
  onNeedCarnet,
  onMine,
}: {
  mode: BottleSheetMode;
  world: WorldConfig;
  ship: () => ShipPose | null;
  onClose: () => void;
  onOpenCarnet: (userId: string) => void;
  onNeedCarnet: () => void;
  onMine: () => void;
}) {
  const { repo } = useRepoData(async () => null);
  const title = mode.kind === 'mine' ? t('bottle.title.own') : t('bottle.title.found');
  return (
    <Sheet title={title} onClose={onClose} testId="botella">
      {!repo ? (
        <p className="juego-muted">{t('empty.loading')}</p>
      ) : mode.kind === 'mine' ? (
        <MyBottle
          repo={repo}
          dropSpot={() => {
            const pose = ship();
            return pose ? findDropSpot(world, pose) : null;
          }}
          onNeedCarnet={onNeedCarnet}
          onClose={onClose}
        />
      ) : (
        <FoundBottle
          key={mode.id}
          repo={repo}
          id={mode.id}
          onOpenCarnet={onOpenCarnet}
          onNeedCarnet={onNeedCarnet}
          onMine={onMine}
        />
      )}
    </Sheet>
  );
}
