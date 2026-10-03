'use client';

import type { BoiaEvent } from '@boia/contracts';
import type { BoiaRepository, CarnetView, StampView } from '@boia/store';
import { accountClient, accountSnapshot } from '../../account/session';
import { isSupabaseConfigured } from '../../supabase/config';
import { useRepoData } from '../repo';
import type { CarnetExtras } from './carnet-card';
import type { StampArt } from './id-card-model';

/** Preferencia del invitado con el barco que lleva (la escribe el barco elegido). */
export const SHIP_PREF = 'barco';

export interface ShipPref {
  style: string;
  skin: string;
  /** «Estilo · Skin», listo para enseñar. */
  label: string;
}

export function isShipPref(v: unknown): v is ShipPref {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof (v as ShipPref).style === 'string' &&
    typeof (v as ShipPref).label === 'string'
  );
}

export interface CarnetData {
  carnet: CarnetView | null;
  extras: CarnetExtras;
}

/** Lo de un evento que pinta su sello. */
export interface StampEventFacts {
  name: string;
  date: string | null;
  sample: boolean;
  /** Imagen del sello que puso el Admin (T94); sin ella, el sello generado. */
  image: string | null;
}

/**
 * La imagen del sello de un evento del contenido (`stampImageUrl`, T94). Con
 * cuentas manda la del servidor (`events.stamp_image_url`, la copia que guarda
 * el Admin): ver `stampArtFor`.
 */
export function eventStampImage(event: BoiaEvent): string | null {
  const image = event.stampImageUrl;
  return typeof image === 'string' && image.length > 0 ? image : null;
}

/**
 * Las fiestas de los sellos según el servidor (con cuentas): nombre, fecha y
 * la imagen del sello que puso el Admin. Vacío en modo local o sin red.
 */
async function serverEvents(slugs: string[]): Promise<Map<string, StampEventFacts>> {
  const out = new Map<string, StampEventFacts>();
  if (slugs.length === 0 || !isSupabaseConfigured()) return out;
  try {
    const sb = await accountClient();
    if (!sb) return out;
    const { data } = await sb
      .from('events')
      .select('slug, title, starts_at, is_sample, stamp_image_url')
      .in('slug', slugs);
    for (const e of data ?? []) {
      out.set(e.slug, {
        name: e.title,
        date: e.starts_at,
        sample: e.is_sample,
        image: e.stamp_image_url,
      });
    }
  } catch {
    // sin red: el sello con lo que se sepa
  }
  return out;
}

function stampTime(s: StampView, facts: StampEventFacts | undefined): number {
  const iso = s.grantedAt ?? facts?.date ?? null;
  const t = iso ? new Date(iso).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Los sellos de un Carnet como se pintan (más recientes primero): el nombre
 * y la fecha de la fiesta del contenido, o del servidor si no está aquí.
 */
export async function stampArtFor(
  repo: BoiaRepository,
  carnet: CarnetView,
  known: ReadonlyMap<string, StampEventFacts> = new Map(),
): Promise<StampArt[]> {
  const events = await repo.content.list('events');
  const facts = new Map<string, StampEventFacts>(known);
  for (const e of events) {
    const f = {
      name: e.name,
      date: e.startsAt,
      sample: e.sample,
      image: eventStampImage(e),
    };
    facts.set(e.id, f);
    if (!facts.has(e.slug)) facts.set(e.slug, f);
  }
  // Con cuentas, las fiestas de los sellos se leen también del servidor: las
  // que no están en el contenido de este navegador y la imagen del sello que
  // puso el Admin (T94), que manda sobre la del contenido.
  const slugs = [...new Set(carnet.stamps.map((s) => s.eventId).filter(Boolean))];
  for (const [slug, f] of await serverEvents(slugs)) {
    const known = facts.get(slug);
    facts.set(slug, known ? { ...known, image: f.image ?? known.image } : f);
  }
  return [...carnet.stamps]
    .sort((a, b) => stampTime(b, facts.get(b.eventId)) - stampTime(a, facts.get(a.eventId)))
    .map((s) => {
      const f = facts.get(s.eventId);
      return {
        eventId: s.eventId,
        name: f?.name ?? s.eventName ?? s.eventId,
        date: f?.date ?? s.grantedAt,
        image: f?.image ?? null,
        sample: carnet.isSample || !!f?.sample,
      };
    });
}

async function readCarnet(repo: BoiaRepository, userId: string | null): Promise<CarnetData> {
  let carnet = userId ? await repo.carnet.get(userId) : await repo.carnet.mine();
  let memberNumber: number | null = null;
  let isArtist = false;
  let known: Map<string, StampEventFacts> | undefined;
  // Con cuentas (T91): el Carnet público de otro miembro se lee del servidor.
  if (!carnet && userId && isSupabaseConfigured()) {
    const { fetchPublicCarnet } = await import('./public-carnet');
    const found = await fetchPublicCarnet(repo, userId);
    if (found) {
      carnet = found.carnet;
      memberNumber = found.memberNumber;
      isArtist = found.isArtist;
      known = found.events;
    }
  }
  if (carnet?.isMine) {
    const account = accountSnapshot();
    if (account.status === 'member' && account.profile) {
      memberNumber = account.profile.memberNumber;
      isArtist = account.profile.isArtist;
    }
  }
  const cosmetics = await repo.content.list('cosmetics');
  const cosmeticNames = Object.fromEntries(cosmetics.map((c) => [c.id, c.name]));
  let shipLabel: string | null = null;
  if (carnet?.isMine) {
    const pref = await repo.progress.pref(SHIP_PREF);
    if (isShipPref(pref)) shipLabel = pref.label;
  }
  const stamps = carnet ? await stampArtFor(repo, carnet, known) : [];
  return {
    carnet,
    extras: { shipLabel, cosmeticNames, memberNumber, isArtist, stamps },
  };
}

/** El Carnet de `userId` (o el propio con null), al día con cada cambio. */
export function useCarnet(userId: string | null) {
  return useRepoData((repo) => readCarnet(repo, userId), [userId]);
}
