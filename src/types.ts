export type Difficulty = 'beginner' | 'intermediate' | 'expert';

export interface Cell {
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  neighborCount: number;
  x: number;
  y: number;
}

export interface GameSettings {
  rows: number;
  cols: number;
  mines: number;
}

export const SETTINGS: Record<Difficulty, GameSettings> = {
  beginner: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 30, mines: 99 },
};

export interface HighScore {
  id?: string;
  uid: string;
  displayName: string;
  time: number;
  difficulty: Difficulty;
  createdAt: string;
}
