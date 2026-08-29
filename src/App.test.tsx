// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';

const mocks = vi.hoisted(() => ({
  signInWithGoogle: vi.fn(),
  logout: vi.fn(),
  setDoc: vi.fn(),
  addDoc: vi.fn(),
}));

vi.mock('./firebase', () => ({
  auth: {},
  db: {},
  signInWithGoogle: mocks.signInWithGoogle,
  logout: mocks.logout,
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: null) => void) => {
    callback(null);
    return vi.fn();
  },
}));

vi.mock('firebase/firestore', () => ({
  addDoc: mocks.addDoc,
  collection: vi.fn((_db, name: string) => ({ name })),
  doc: vi.fn((_db, collectionName: string, id: string) => ({ collectionName, id })),
  limit: vi.fn((count: number) => ({ count })),
  onSnapshot: vi.fn((_query, callback: (snapshot: { docs: unknown[] }) => void) => {
    callback({ docs: [] });
    return vi.fn();
  }),
  orderBy: vi.fn((field: string, direction: string) => ({ field, direction })),
  query: vi.fn((...parts: unknown[]) => ({ parts })),
  serverTimestamp: vi.fn(() => 'server-time'),
  setDoc: mocks.setDoc,
  where: vi.fn((field: string, op: string, value: string) => ({ field, op, value })),
}));

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

describe('App gameplay', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockImplementation(createMineCoordinateSequence());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
    mocks.signInWithGoogle.mockClear();
    mocks.logout.mockClear();
    mocks.setDoc.mockClear();
    mocks.addDoc.mockClear();
  });

  it('renders a playable beginner board and starts the timer after the first tap', async () => {
    render(<App />);

    expect(screen.getAllByTestId(/^cell-/)).toHaveLength(81);
    expect(screen.getByText('Tap to clear. Use Mark for flags.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mark/i })).toBeDisabled();

    await userEvent.click(screen.getByTestId('cell-0-0'));

    expect(screen.getByRole('button', { name: /mark/i })).toBeEnabled();
    expect(screen.getByTestId('cell-0-0')).toHaveAttribute('data-revealed', 'true');
  });

  it('flags and unflags a tile through touch-friendly Mark mode', async () => {
    render(<App />);

    await userEvent.click(screen.getByTestId('cell-0-0'));
    await userEvent.click(screen.getByRole('button', { name: /mark/i }));
    await userEvent.click(screen.getByTestId('cell-8-8'));

    expect(screen.getByTestId('cell-8-8')).toHaveAttribute('data-flagged', 'true');
    expect(screen.getByText('9')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('cell-8-8'));

    expect(screen.getByTestId('cell-8-8')).toHaveAttribute('data-flagged', 'false');
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('still supports context-menu flagging for desktop players', async () => {
    render(<App />);

    await userEvent.click(screen.getByTestId('cell-0-0'));
    fireEvent.contextMenu(screen.getByTestId('cell-8-8'));

    expect(screen.getByTestId('cell-8-8')).toHaveAttribute('data-flagged', 'true');
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('resets the board when difficulty changes', async () => {
    render(<App />);

    await userEvent.click(screen.getByTestId('cell-0-0'));
    await userEvent.selectOptions(screen.getByRole('combobox'), 'intermediate');

    expect(screen.getAllByTestId(/^cell-/)).toHaveLength(256);
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mark/i })).toBeDisabled();
  });

  it('calls the Google sign-in flow from the header button', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(mocks.signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('can finish a deterministic game by marking mines and clearing safe cells', async () => {
    render(<App />);

    await userEvent.click(screen.getByTestId('cell-0-0'));
    await userEvent.click(screen.getByRole('button', { name: /mark/i }));

    const mines = new Set(['8-8', '7-8', '6-8', '5-8', '4-8', '3-8', '8-7', '7-7', '6-7', '5-7']);
    for (const key of mines) {
      const [x, y] = key.split('-');
      await userEvent.click(screen.getByTestId(`cell-${x}-${y}`));
    }

    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(1);
    await userEvent.click(screen.getByRole('button', { name: /mark/i }));

    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        if (!mines.has(`${x}-${y}`)) {
          await userEvent.click(screen.getByTestId(`cell-${x}-${y}`));
        }
      }
    }

    expect(screen.getByText('Victory!')).toBeInTheDocument();
  });
});

function createMineCoordinateSequence() {
  const values = [
    [8, 8],
    [7, 8],
    [6, 8],
    [5, 8],
    [4, 8],
    [3, 8],
    [8, 7],
    [7, 7],
    [6, 7],
    [5, 7],
  ].flatMap(([x, y]) => [(x + 0.1) / 9, (y + 0.1) / 9]);
  let index = 0;
  return () => values[index++ % values.length];
}
