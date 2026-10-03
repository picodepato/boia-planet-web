/**
 * El Carnet público de un miembro, leído de Supabase (plan 008, T91,
 * decisiones 5 y 10): apodo, avatar, nº de miembro, «Miembro desde»,
 * artista, respuestas, puntos (para el rango) y sellos con su fiesta. Nunca
 * el email: no está en ninguna de estas tablas, y la RLS deja leerlas a
 * cualquiera (carnets, carnet_answers, point_balances, stamps, events).
 *
 * Se carga con `import()` sólo con Supabase.
 */
import { CARNET_QUESTIONS } from '@boia/contracts';
import { type BoiaRepository, type CarnetView, rankFor } from '@boia/store';
import { accountClient } from '../../account/session';
import type { StampEventFacts } from './use-carnet';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PublicCarnet {
  carnet: CarnetView;
  memberNumber: number | null;
  isArtist: boolean;
  /** Las fiestas de sus sellos, por slug. */
  events: Map<string, StampEventFacts>;
}

interface StampRow {
  granted_at: string;
  events: { slug: string; title: string; starts_at: string | null; is_sample: boolean } | null;
}

export async function fetchPublicCarnet(
  repo: BoiaRepository,
  userId: string,
): Promise<PublicCarnet | null> {
  if (!UUID.test(userId)) return null;
  const sb = await accountClient();
  if (!sb) return null;
  try {
    const [carnetRes, answersRes, pointsRes, stampsRes] = await Promise.all([
      sb
        .from('carnets')
        .select(
          'user_id, nickname, avatar_key, avatar_image, member_since, member_number, is_artist',
        )
        .eq('user_id', userId)
        .maybeSingle(),
      sb
        .from('carnet_answers')
        .select('question_id, question_version, answer')
        .eq('user_id', userId),
      sb.from('point_balances').select('points').eq('user_id', userId).maybeSingle(),
      sb
        .from('stamps')
        .select('granted_at, events(slug, title, starts_at, is_sample)')
        .eq('user_id', userId)
        .is('revoked_at', null)
        .order('granted_at', { ascending: false }),
    ]);
    const row = carnetRes.data;
    if (!row) return null;
    const points = Number(pointsRes.data?.points ?? 0);
    const ranks = await repo.content.list('ranks');
    const answers = CARNET_QUESTIONS.flatMap((q) => {
      const a = (answersRes.data ?? []).find((x) => x.question_id === q.id);
      return a
        ? [
            {
              questionId: q.id,
              question: q.prompt,
              questionVersion: a.question_version,
              answer: a.answer,
            },
          ]
        : [];
    });
    const events = new Map<string, StampEventFacts>();
    const stamps = ((stampsRes.data ?? []) as unknown as StampRow[]).flatMap((s) => {
      if (!s.events) return [];
      events.set(s.events.slug, {
        name: s.events.title,
        date: s.events.starts_at,
        sample: s.events.is_sample,
        image: null,
      });
      return [
        {
          eventId: s.events.slug,
          eventName: s.events.title,
          purchaseId: null,
          grantedAt: s.granted_at,
        },
      ];
    });
    const carnet: CarnetView = {
      userId: row.user_id,
      nickname: row.nickname,
      avatarKey: row.avatar_key,
      avatarImage: row.avatar_image,
      memberSince: row.member_since,
      answers,
      points,
      rank: rankFor(points, ranks),
      achievements: [],
      badges: [],
      stamps,
      cosmeticIds: [],
      equipped: {},
      isMine: false,
      isSample: false,
      moderated: { photo: false, nickname: false, answers: 0 },
    };
    return {
      carnet,
      memberNumber: row.member_number,
      isArtist: row.is_artist,
      events,
    };
  } catch {
    return null;
  }
}
