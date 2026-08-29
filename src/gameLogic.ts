import { Cell, GameSettings } from './types';

export function createEmptyGrid(settings: GameSettings): Cell[][] {
  return Array.from({ length: settings.rows }, (_, y) =>
    Array.from({ length: settings.cols }, (_, x) => ({
      x,
      y,
      isMine: false,
      isRevealed: false,
      isFlagged: false,
      neighborCount: 0,
    })),
  );
}

export function createStartedGrid(
  settings: GameSettings,
  firstX: number,
  firstY: number,
  random: () => number = Math.random,
): Cell[][] {
  const grid = cloneGrid(createEmptyGrid(settings));
  let minesPlaced = 0;

  while (minesPlaced < settings.mines) {
    const x = Math.floor(random() * settings.cols);
    const y = Math.floor(random() * settings.rows);
    const inFirstTapZone = Math.abs(x - firstX) <= 1 && Math.abs(y - firstY) <= 1;

    if (!grid[y][x].isMine && !inFirstTapZone) {
      grid[y][x].isMine = true;
      minesPlaced++;
    }
  }

  return calculateNeighbors(grid);
}

export function revealCells(
  currentGrid: Cell[][],
  x: number,
  y: number,
): { grid: Cell[][]; hitMine: boolean } {
  const grid = cloneGrid(currentGrid);
  const firstCell = grid[y]?.[x];

  if (!firstCell || firstCell.isRevealed || firstCell.isFlagged) {
    return { grid, hitMine: false };
  }

  if (firstCell.isMine) {
    grid.forEach(row => row.forEach(cell => {
      if (cell.isMine) cell.isRevealed = true;
    }));
    return { grid, hitMine: true };
  }

  const stack: Cell[] = [firstCell];
  while (stack.length > 0) {
    const cell = stack.pop();
    if (!cell || cell.isRevealed || cell.isFlagged) continue;

    cell.isRevealed = true;
    if (cell.neighborCount !== 0) continue;

    forEachNeighbor(grid, cell.x, cell.y, neighbor => {
      if (!neighbor.isMine && !neighbor.isRevealed && !neighbor.isFlagged) {
        stack.push(neighbor);
      }
    });
  }

  return { grid, hitMine: false };
}

export function toggleFlag(currentGrid: Cell[][], x: number, y: number): Cell[][] {
  const grid = cloneGrid(currentGrid);
  const cell = grid[y]?.[x];
  if (!cell || cell.isRevealed) return grid;

  cell.isFlagged = !cell.isFlagged;
  return grid;
}

export function countFlags(grid: Cell[][]): number {
  return grid.flat().filter(cell => cell.isFlagged).length;
}

export function hasWon(grid: Cell[][], settings: GameSettings): boolean {
  const revealedCount = grid.flat().filter(cell => cell.isRevealed).length;
  return revealedCount === settings.rows * settings.cols - settings.mines;
}

function calculateNeighbors(grid: Cell[][]): Cell[][] {
  grid.forEach(row => row.forEach(cell => {
    if (cell.isMine) return;

    let count = 0;
    forEachNeighbor(grid, cell.x, cell.y, neighbor => {
      if (neighbor.isMine) count++;
    });
    cell.neighborCount = count;
  }));

  return grid;
}

function forEachNeighbor(grid: Cell[][], x: number, y: number, callback: (cell: Cell) => void) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;

      const neighbor = grid[y + dy]?.[x + dx];
      if (neighbor) callback(neighbor);
    }
  }
}

function cloneGrid(grid: Cell[][]): Cell[][] {
  return grid.map(row => row.map(cell => ({ ...cell })));
}
