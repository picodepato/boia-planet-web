import type * as React from 'react';
import type { ReactElement } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { CarnetPanel } from './carnet-panel';

const state = vi.hoisted(() => ({
  signedOut: false,
  newlyRegistered: false,
  calls: 0,
  edit: vi.fn(),
  creating: vi.fn(),
  gate: vi.fn(),
  mine: vi.fn(),
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
  useEffect: () => {},
  useState: (initial: unknown) => [initial, state.calls++ === 0 ? state.edit : state.creating],
}));
vi.mock('../../account/use-account', () => ({
  useAccount: () => ({ status: 'guest', signedOut: state.signedOut }),
}));
vi.mock('../../account/gate', () => ({
  requireAccount: (...args: unknown[]) => state.gate(...args),
}));
vi.mock('./use-carnet', () => ({
  useCarnet: () => ({ data: { carnet: null, extras: {} }, repo: { carnet: { mine: state.mine } } }),
}));
vi.mock('../repo', () => ({ useRepoData: () => ({ data: null }) }));

beforeEach(() => {
  vi.clearAllMocks();
  state.calls = 0;
  state.signedOut = false;
  state.newlyRegistered = false;
  state.mine.mockResolvedValue({ userId: 'member' });
  state.gate.mockImplementation(async (_reason, options) => {
    if (state.newlyRegistered) options.onRegistered();
    return true;
  });
});

function createButton(element: ReactElement): (() => Promise<void>) | undefined {
  const props = element.props as {
    'data-testid'?: string;
    onClick?: () => Promise<void>;
    children?: unknown;
  };
  if (props['data-testid'] === 'carnet-crear') return props.onClick;
  for (const child of [props.children].flat()) {
    if (child && typeof child === 'object' && 'props' in child) {
      const found = createButton(child as ReactElement);
      if (found) return found;
    }
  }
  return undefined;
}

it('a fresh online guest opens the questionnaire before asking for an account', async () => {
  await createButton(CarnetPanel({}))!();
  expect(state.edit).toHaveBeenCalledWith(true);
  expect(state.gate).not.toHaveBeenCalled();
});

it('after sign-out, a new registration opens questions instead of silently creating an empty card', async () => {
  state.signedOut = true;
  state.newlyRegistered = true;
  await createButton(CarnetPanel({}))!();
  expect(state.gate).toHaveBeenCalledWith(
    'carnet',
    expect.objectContaining({ onRegistered: expect.any(Function) }),
  );
  expect(state.edit).toHaveBeenCalledWith(true);
});

it('after sign-out, signing into an existing card does not force the questionnaire', async () => {
  state.signedOut = true;
  await createButton(CarnetPanel({}))!();
  expect(state.gate).toHaveBeenCalled();
  expect(state.edit).not.toHaveBeenCalled();
});
