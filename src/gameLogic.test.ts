import { describe, expect, it } from 'vitest';

import { createEmptyGrid, createStartedGrid, hasWon, revealCells, toggleFlag } from './gameLogic';
import { GameSettings } from './types';

describe('gameLogic', () => {
  const settings: GameSettings = { rows: 4, cols: 4, mines: 2 };

  it('creates an empty hidden board', () => {
    const grid = createEmptyGrid(settings);

    expect(grid).toHaveLength(4);
    expect(grid[0]).toHaveLength(4);
    expect(grid.flat().every(cell => !cell.isMine && !cell.isRevealed && !cell.isFlagged)).toBe(true);
  });

  it('keeps the first tap and adjacent cells mine-free', () => {
    const numbers = [0, 0, 0.25, 0.25, 0.99, 0.99, 0.75, 0.5];
    const grid = createStartedGrid(settings, 0, 0, () => numbers.shift() ?? 0.75);

    const firstTapZone = grid.flat().filter(cell => cell.x <= 1 && cell.y <= 1);
    expect(firstTapZone.every(cell => !cell.isMine)).toBe(true);
    expect(grid.flat().filter(cell => cell.isMine)).toHaveLength(2);
  });

  it('reveals connected empty cells without revealing flagged cells', () => {
    const grid = createEmptyGrid({ rows: 3, cols: 3, mines: 0 });
    const flagged = toggleFlag(grid, 1, 1);
    const result = revealCells(flagged, 0, 0);

    expect(result.hitMine).toBe(false);
    expect(result.grid[1][1].isFlagged).toBe(true);
    expect(result.grid[1][1].isRevealed).toBe(false);
    expect(result.grid.flat().filter(cell => cell.isRevealed)).toHaveLength(8);
  });

  it('reveals all mines after a mine is tapped', () => {
    const grid = createEmptyGrid(settings);
    grid[0][0].isMine = true;
    grid[3][3].isMine = true;

    const result = revealCells(grid, 0, 0);

    expect(result.hitMine).toBe(true);
    expect(result.grid[0][0].isRevealed).toBe(true);
    expect(result.grid[3][3].isRevealed).toBe(true);
  });

  it('detects a completed board', () => {
    const grid = createEmptyGrid(settings);
    grid[0][0].isMine = true;
    grid[3][3].isMine = true;
    grid.flat().forEach(cell => {
      if (!cell.isMine) cell.isRevealed = true;
    });

    expect(hasWon(grid, settings)).toBe(true);
  });
});
