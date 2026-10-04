import { CARNET_QUESTIONS } from '@boia/contracts';
import {
  createLocalRepository,
  createMemberRepository,
  createSwitchableRepository,
  MemoryStorage,
  supabaseMemberServer,
} from '@boia/store';
import { afterEach, expect, it, vi } from 'vitest';
import { FakeSupabase } from '../../../../../packages/store/src/member/fake-supabase';
import { resetAccountForTests } from '../../account/session';
import {
  continueCarnetDraft,
  draftFrom,
  saveCarnet,
  saveCarnetContinuation,
} from './carnet-editor';

const UID = '11111111-2222-3333-4444-555555555555';
const first = CARNET_QUESTIONS[0]!;
const last = CARNET_QUESTIONS.at(-1)!;
afterEach(() => {
  resetAccountForTests();
  vi.restoreAllMocks();
});

it('guest questionnaire survives registration and writes to the switched fake-member repository', async () => {
  const guest = createLocalRepository({ storage: new MemoryStorage(), watch: false });
  const sw = createSwitchableRepository(guest);
  const draft = {
    ...draftFrom(null),
    nickname: 'Invitada',
    answers: { [first.id]: 'Mi respuesta' },
  };
  const fake = new FakeSupabase(UID);
  fake.carnet = {
    user_id: UID,
    nickname: 'Miembro',
    avatar_key: 'barco',
    avatar_image: null,
    member_since: '2026-10-01T00:00:00.000Z',
    member_number: 9,
    version: 1,
  };
  const member = createMemberRepository({
    userId: UID,
    cache: createLocalRepository({ storage: new MemoryStorage(), watch: false }),
    server: supabaseMemberServer(fake, UID),
    storage: new MemoryStorage(),
    snapshotDelayMs: 60_000,
    retryMs: [60_000],
  });
  try {
    await member.sync.ready();
    sw.switchTo(member);
    resetAccountForTests({ status: 'member', userId: UID });
    const saved = await saveCarnetContinuation(sw.repo, null, draft, CARNET_QUESTIONS);
    expect(saved).toMatchObject({ userId: UID, nickname: 'Miembro' });
    await member.sync.flush();
    expect(fake.answers).toContainEqual(
      expect.objectContaining({ question_id: first.id, answer: 'Mi respuesta' }),
    );
    expect(await guest.carnet.mine()).toBeNull();
    await member.sync.refresh();
    expect((await member.carnet.mine())?.answers).toContainEqual(
      expect.objectContaining({ questionId: first.id, answer: 'Mi respuesta' }),
    );
  } finally {
    member.sync.dispose();
  }
});

it('signing into an existing card preserves untouched answers/photo while normal editing can clear', async () => {
  const repo = createLocalRepository({ storage: new MemoryStorage(), watch: false });
  await repo.carnet.create({
    nickname: 'Existente',
    avatarKey: null,
    avatarImage: 'data:image/png;base64,AAAA',
  });
  await repo.carnet.answer(last.id, 'Respuesta existente');
  const existing = (await repo.carnet.mine())!;
  const offered = {
    ...draftFrom(null),
    nickname: 'Borrador',
    answers: { [first.id]: 'Respuesta nueva' },
  };
  const merged = continueCarnetDraft(existing, offered);
  expect(merged.avatarImage).toBe(existing.avatarImage);
  expect(merged.nickname).toBe('Existente');
  await saveCarnetContinuation(repo, null, offered, CARNET_QUESTIONS);
  const saved = (await repo.carnet.mine())!;
  expect(saved.answers.map((a) => a.answer)).toEqual(
    expect.arrayContaining(['Respuesta existente', 'Respuesta nueva']),
  );
  await saveCarnet(
    repo,
    saved,
    { ...draftFrom(saved), answers: { ...draftFrom(saved).answers, [last.id]: '' } },
    CARNET_QUESTIONS,
  );
  expect((await repo.carnet.mine())?.answers.some((a) => a.questionId === last.id)).toBe(false);
});

it('closing the editor or changing account cancels continuation before any write', async () => {
  const repo = createLocalRepository({ storage: new MemoryStorage(), watch: false });
  const create = vi.spyOn(repo.carnet, 'create');
  const draft = {
    ...draftFrom(null),
    nickname: 'Cancelada',
    answers: { [first.id]: 'Sin guardar' },
  };
  expect(
    await saveCarnetContinuation(repo, null, draft, CARNET_QUESTIONS, () => false),
  ).toBeUndefined();
  resetAccountForTests({ status: 'member', userId: UID });
  expect(await saveCarnetContinuation(repo, null, draft, CARNET_QUESTIONS)).toBeUndefined();
  expect(create).not.toHaveBeenCalled();
});

it('a partial save retry keeps the new-draft origin and untouched existing answers', async () => {
  const repo = createLocalRepository({ storage: new MemoryStorage(), watch: false });
  await repo.carnet.create({ nickname: 'Reintento' });
  const untouched = CARNET_QUESTIONS[1]!;
  await repo.carnet.answer(untouched.id, 'Conservar tras fallo');
  const before = (await repo.carnet.mine())!;
  const draft = {
    ...draftFrom(null),
    nickname: 'Invitada',
    answers: { [first.id]: 'Primera guardada', [last.id]: 'Última pendiente' },
  };
  const answer = repo.carnet.answer;
  const spy = vi.spyOn(repo.carnet, 'answer').mockImplementation(async (id, value) => {
    if (id === last.id) throw new Error('Temporary save failure');
    return answer(id, value);
  });
  await expect(saveCarnetContinuation(repo, null, draft, CARNET_QUESTIONS)).rejects.toThrow(
    'Temporary',
  );
  spy.mockRestore();
  const partial = (await repo.carnet.mine())!;
  expect(partial.userId).toBe(before.userId);
  const saved = await saveCarnetContinuation(repo, partial, draft, CARNET_QUESTIONS);
  expect(saved?.answers.map((a) => a.answer)).toEqual(
    expect.arrayContaining(['Conservar tras fallo', 'Primera guardada', 'Última pendiente']),
  );
});

it('an editor belonging to member A cannot write its draft to member B after a real repository switch', async () => {
  const another = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const members = [UID, another].map((userId) => {
    const fake = new FakeSupabase(userId);
    fake.carnet = {
      user_id: userId,
      nickname: userId === UID ? 'Cuenta A' : 'Cuenta B',
      avatar_key: null,
      avatar_image: null,
      member_since: '2026-10-01T00:00:00.000Z',
      member_number: 9,
      version: 1,
    };
    const member = createMemberRepository({
      userId,
      cache: createLocalRepository({ storage: new MemoryStorage(), watch: false }),
      server: supabaseMemberServer(fake, userId),
      storage: new MemoryStorage(),
      snapshotDelayMs: 60_000,
      retryMs: [60_000],
    });
    return { fake, member };
  });
  try {
    await Promise.all(members.map(({ member }) => member.sync.ready()));
    const sw = createSwitchableRepository(members[0]!.member);
    resetAccountForTests({ status: 'member', userId: UID });
    const a = (await sw.repo.carnet.mine())!;
    const draft = { ...draftFrom(a), answers: { [first.id]: 'Solo de A' } };
    sw.switchTo(members[1]!.member);
    resetAccountForTests({ status: 'member', userId: another });
    const reactiveBefore = (await sw.repo.carnet.mine())!;
    expect(
      await saveCarnetContinuation(
        sw.repo,
        reactiveBefore,
        draft,
        CARNET_QUESTIONS,
        () => true,
        UID,
      ),
    ).toBeUndefined();
    await members[1]!.member.sync.flush();
    expect(members[1]!.fake.answers).toEqual([]);
    expect(members[1]!.fake.calls).toEqual([]);
    expect((await members[1]!.member.carnet.mine())?.nickname).toBe('Cuenta B');
  } finally {
    for (const { member } of members) member.sync.dispose();
  }
});
