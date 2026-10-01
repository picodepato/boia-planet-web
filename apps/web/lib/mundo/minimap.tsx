'use client';

import {
  type DiscoveryTarget,
  LONG_PRESS_MS,
  type MapMarker,
  MinimapGesture,
  type MinimapZone,
  type Rect,
  type Viewport,
  minimapProjection,
  snapMinimap,
} from '@boia/engine/ui';
import type { WorldConfig } from '@boia/world';
import { useEffect, useRef, useState } from 'react';
import { FUNCTION_LABEL } from './notice-copy';
import { t as msg } from '../i18n';

/**
 * Minimapa (§10): toque = mapa ampliado con nombres y funciones de lo
 * descubierto; pulsación larga de 500 ms = moverlo, y al soltar se ajusta a
 * la zona segura más cercana (la zona se guarda fuera, en quien lo usa).
 */

export interface ShipMark {
  x: number;
  y: number;
  heading: number;
}

interface MapData {
  world: WorldConfig;
  markers: readonly MapMarker[];
  targets: readonly DiscoveryTarget[];
  discovered: ReadonlySet<string>;
  selectedId: string | null;
  ship: ShipMark | null;
}

const COLORS = {
  land: '#2a3b2a',
  water: '#1f7a9c',
  island: '#e8d3a2',
  islandUnknown: 'rgba(255,255,255,.28)',
  boia: '#f26a1b',
  obstacle: 'rgba(12,24,44,.7)',
  ship: '#ffffff',
  selected: '#f26a1b',
};

function MapSvg({
  data,
  w,
  h,
  detailed,
  onSelect,
}: {
  data: MapData;
  w: number;
  h: number;
  detailed: boolean;
  onSelect?: (id: string) => void;
}) {
  // Mientras el viewport cambia (rotar, teclado) el hueco puede quedar a 0 o
  // menos un instante: un SVG con tamaño negativo da error en consola (T29).
  w = Math.max(0, w);
  h = Math.max(0, h);
  const p = minimapProjection(data.world.bounds, w, h, detailed ? 12 : 4);
  const minR = detailed ? 5 : 2.5;
  const byId = new Map(data.targets.map((t) => [t.id, t]));
  const ship = data.ship;
  const shipPos = ship ? p.project(ship) : null;
  // Rumbo en pantalla: la proyección aplasta y a la mitad.
  const shipAngle = ship ? Math.atan2(Math.sin(ship.heading) * 0.5, Math.cos(ship.heading)) : 0;
  const shipLen = detailed ? 12 : 7;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden={!detailed}>
      <rect x={0} y={0} width={w} height={h} fill={COLORS.land} />
      <rect
        x={p.content.x}
        y={p.content.y}
        width={p.content.w}
        height={p.content.h}
        fill={COLORS.water}
      />
      {data.markers.map((m) => {
        const q = p.project(m);
        const t = byId.get(m.id);
        const known = t ? data.discovered.has(t.id) : true;
        const r = Math.max(minR, m.size * p.scale);
        if (m.kind === 'obstacle') {
          return (
            <circle key={m.id} cx={q.x} cy={q.y} r={detailed ? 3 : 1.5} fill={COLORS.obstacle} />
          );
        }
        if (m.kind === 'boia') {
          return (
            <circle
              key={m.id}
              cx={q.x}
              cy={q.y}
              r={detailed ? 5 : 2.5}
              fill={known ? COLORS.boia : COLORS.islandUnknown}
            />
          );
        }
        return (
          <ellipse
            key={m.id}
            cx={q.x}
            cy={q.y}
            rx={r}
            ry={r * 0.5 + 1}
            fill={known ? COLORS.island : COLORS.islandUnknown}
          />
        );
      })}
      {data.selectedId && byId.get(data.selectedId)
        ? (() => {
            const q = p.project(byId.get(data.selectedId)!);
            return (
              <circle
                cx={q.x}
                cy={q.y}
                r={detailed ? 14 : 6}
                fill="none"
                stroke={COLORS.selected}
                strokeWidth={detailed ? 2 : 1.5}
                strokeDasharray={detailed ? '4 3' : '2 2'}
              />
            );
          })()
        : null}
      {detailed
        ? data.targets.map((t) => {
            const q = p.project(t);
            const known = data.discovered.has(t.id);
            const label = known ? t.name : '?';
            const right = q.x < w * 0.6;
            return (
              <g
                key={`l-${t.id}`}
                className="juego-map-label"
                onClick={() => onSelect?.(t.id)}
                role="button"
                aria-label={
                  known
                    ? msg('juego.minimap.senalar', { name: t.name })
                    : msg('juego.minimap.senalarUnPuntoSin')
                }
              >
                <circle cx={q.x} cy={q.y} r={16} fill="transparent" />
                <text
                  x={q.x + (right ? 12 : -12)}
                  y={q.y + 4}
                  textAnchor={right ? 'start' : 'end'}
                  fontSize={12}
                  fontWeight={700}
                  fill="#fff"
                  stroke="rgba(18,35,63,.9)"
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  {label}
                </text>
              </g>
            );
          })
        : null}
      {shipPos ? (
        <polygon
          points={`${shipLen / 2},0 ${-shipLen / 2},${-shipLen / 3} ${-shipLen / 4},0 ${-shipLen / 2},${shipLen / 3}`}
          transform={`translate(${shipPos.x} ${shipPos.y}) rotate(${(shipAngle * 180) / Math.PI})`}
          fill={COLORS.ship}
          stroke="#12233f"
          strokeWidth={1}
        />
      ) : null}
    </svg>
  );
}

export function Minimap({
  data,
  rect,
  vp,
  pulse,
  onExpand,
  onZoneChange,
}: {
  data: MapData;
  rect: Rect;
  vp: Viewport;
  pulse: number;
  onExpand: () => void;
  onZoneChange: (z: MinimapZone) => void;
}) {
  const gesture = useRef(new MinimapGesture());
  const timer = useRef<number | undefined>(undefined);
  const suppressClick = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ dx: 0, dy: 0 });

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const reset = () => {
    window.clearTimeout(timer.current);
    setDragging(false);
    setOffset({ dx: 0, dy: 0 });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Sin captura, el arrastre sigue mientras el dedo esté encima.
    }
    gesture.current.down(performance.now(), e.clientX, e.clientY);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (gesture.current.tick(performance.now())) {
        setDragging(true);
        navigator.vibrate?.(12);
      }
    }, LONG_PRESS_MS + 5);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    if (!g.pressing && !g.dragging) return;
    g.move(performance.now(), e.clientX, e.clientY);
    if (g.dragging) {
      setDragging(true);
      setOffset(g.offset());
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    const off = g.offset();
    const r = g.up(performance.now());
    reset();
    if (!r) return;
    e.preventDefault();
    suppressClick.current = true;
    if (r.kind === 'tap') onExpand();
    if (r.kind === 'drop') {
      const center = { x: rect.x + rect.w / 2 + off.dx, y: rect.y + rect.h / 2 + off.dy };
      onZoneChange(snapMinimap(vp, center));
    }
  };

  return (
    <button
      type="button"
      key={pulse}
      data-testid="minimapa"
      data-hud="minimapa"
      className={`juego-minimap${pulse ? ' juego-pulse-long' : ''}${dragging ? ' is-dragging' : ''}`}
      aria-label={msg('hud.minimap.aria')}
      title={msg('juego.minimap.tocaParaAmpliarManten')}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        transform: dragging ? `translate(${offset.dx}px, ${offset.dy}px) scale(1.06)` : undefined,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        gesture.current.cancel();
        reset();
      }}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        // El toque ya lo resolvió el gesto; aquí sólo llega el teclado.
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        onExpand();
      }}
    >
      <MapSvg data={data} w={rect.w - 4} h={rect.h - 4} detailed={false} />
    </button>
  );
}

export function ExpandedMap({
  data,
  vp,
  onSelect,
  onClose,
}: {
  data: MapData;
  vp: Viewport;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  const size = Math.max(200, Math.min(vp.width - 32, vp.height - 200, 520));
  const known = data.targets.filter((t) => data.discovered.has(t.id));
  const unknown = data.targets.length - known.length;
  const ref = useRef<HTMLElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="juego-overlay" onClick={onClose}>
      <section
        ref={ref}
        tabIndex={-1}
        className="juego-map"
        role="dialog"
        aria-label={msg('juego.minimap.mapa')}
        data-testid="minimapa-ampliado"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') onClose();
        }}
      >
        <header className="juego-sheet-head">
          <h2>{msg('juego.minimap.mapa')}</h2>
          <button
            type="button"
            className="juego-close"
            onClick={onClose}
            aria-label={msg('juego.minimap.cerrar')}
          >
            ×
          </button>
        </header>
        <div className="juego-map-canvas" style={{ width: size, height: size }}>
          <MapSvg data={data} w={size} h={size} detailed onSelect={onSelect} />
        </div>
        <ul className="juego-map-list">
          {known.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                aria-pressed={data.selectedId === t.id}
                onClick={() => onSelect(data.selectedId === t.id ? null : t.id)}
              >
                <strong>{t.name}</strong>
                {t.functions.length ? (
                  <span> · {t.functions.map((f) => FUNCTION_LABEL[f]).join(' · ')}</span>
                ) : null}
              </button>
            </li>
          ))}
          {unknown > 0 ? (
            <li className="juego-map-unknown">
              {msg('juego.minimap.porDescubrir', {
                v1:
                  unknown === 1
                    ? msg('juego.minimap.queda1Sitio')
                    : msg('juego.minimap.quedanSitios', { unknown }),
              })}
            </li>
          ) : null}
        </ul>
        <p className="juego-map-hint">{msg('juego.minimap.tocaUnSitioPara')}</p>
      </section>
    </div>
  );
}
