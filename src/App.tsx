import React, { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  RotateCcw, 
  Flag, 
  Bomb, 
  Timer, 
  Settings, 
  LogOut, 
  LogIn,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { auth, db, signInWithGoogle, logout } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  serverTimestamp,
  doc,
  setDoc
} from 'firebase/firestore';

import { Difficulty, Cell, SETTINGS, HighScore } from './types';
import appIcon from './assets/images/512x512_play_store_icon.png';
import {
  countFlags,
  createEmptyGrid,
  createStartedGrid,
  hasWon,
  revealCells,
  toggleFlag,
} from './gameLogic';
import { initializeInterstitialAds, showGameOverInterstitial } from './lib/interstitialAds';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner');
  const [grid, setGrid] = useState<Cell[][]>([]);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'won' | 'lost'>('idle');
  const [time, setTime] = useState(0);
  const [flagsUsed, setFlagsUsed] = useState(0);
  const [highScores, setHighScores] = useState<HighScore[]>([]);
  const [flagMode, setFlagMode] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const settings = SETTINGS[difficulty];
  const boardStyle = {
    '--rows': settings.rows,
    '--cols': settings.cols,
    aspectRatio: `${settings.cols} / ${settings.rows}`,
    gridTemplateColumns: `repeat(${settings.cols}, minmax(0, 1fr))`,
    gridAutoRows: '1fr',
  } as CSSProperties;

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // Sync user profile
        setDoc(doc(db, 'users', u.uid), {
          uid: u.uid,
          displayName: u.displayName,
          photoURL: u.photoURL,
          email: u.email,
          createdAt: serverTimestamp(),
        }, { merge: true });
      }
    });
    return () => unsubscribe();
  }, []);

  // Leaderboard listener
  useEffect(() => {
    const q = query(
      collection(db, 'high_scores'),
      where('difficulty', '==', difficulty),
      orderBy('time', 'asc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const scores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HighScore));
      setHighScores(scores);
    });

    return () => unsubscribe();
  }, [difficulty]);

  // Game Logic
  const initGrid = useCallback(() => {
    setGrid(createEmptyGrid(SETTINGS[difficulty]));
    setGameState('idle');
    setTime(0);
    setFlagsUsed(0);
    setFlagMode(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, [difficulty]);

  useEffect(() => {
    initGrid();
  }, [initGrid]);

  useEffect(() => {
    void initializeInterstitialAds();
  }, []);

  const startGame = (firstX: number, firstY: number) => {
    const startedGrid = createStartedGrid(SETTINGS[difficulty], firstX, firstY);
    const result = revealCells(startedGrid, firstX, firstY);
    setGrid(result.grid);
    setGameState('playing');
    
    timerRef.current = setInterval(() => {
      setTime(t => t + 1);
    }, 1000);
  };

  const revealCell = (x: number, y: number, currentGrid: Cell[][]) => {
    const result = revealCells(currentGrid, x, y);
    if (result.hitMine) {
      setGameState('lost');
      if (timerRef.current) clearInterval(timerRef.current);
      setGrid(result.grid);
      void showGameOverInterstitial();
      return;
    }

    setGrid(result.grid);
    checkWin(result.grid);
  };

  const checkWin = (currentGrid: Cell[][]) => {
    if (hasWon(currentGrid, SETTINGS[difficulty])) {
      setGameState('won');
      if (timerRef.current) clearInterval(timerRef.current);
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
      
      if (user) {
        saveScore(time);
      }

      void showGameOverInterstitial();
    }
  };

  const saveScore = async (finalTime: number) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'high_scores'), {
        uid: user.uid,
        displayName: user.displayName || 'Anonymous',
        time: finalTime,
        difficulty,
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      console.error("Error saving score:", e);
    }
  };

  const handleCellClick = (x: number, y: number) => {
    if (gameState === 'won' || gameState === 'lost') return;
    if (flagMode && gameState === 'playing') {
      handleFlagToggle(x, y);
      return;
    }
    if (gameState === 'idle') {
      startGame(x, y);
    } else {
      revealCell(x, y, grid);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, x: number, y: number) => {
    e.preventDefault();
    handleFlagToggle(x, y);
  };

  const handleFlagToggle = (x: number, y: number) => {
    if (gameState === 'idle' || gameState === 'won' || gameState === 'lost') return;
    const newGrid = toggleFlag(grid, x, y);
    setFlagsUsed(countFlags(newGrid));
    setGrid(newGrid);
  };

  return (
    <div className="app-shell bg-[#050505] text-[#E4E3E0] font-sans selection:bg-[#F27D26] selection:text-white">
      <header className="shrink-0 border-b border-white/10 bg-[#050505]/90 px-3 py-2 backdrop-blur-md sm:px-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <img
              src={appIcon}
              alt=""
              className="h-10 w-10 shrink-0 rounded-lg shadow-lg shadow-[#F27D26]/20 sm:h-11 sm:w-11"
            />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold uppercase italic tracking-tight sm:text-xl">Minesweeper</h1>
              <p className="truncate font-mono text-[9px] uppercase tracking-widest text-white/40 sm:text-[10px]">Modern Edition v1.0</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium">{user.displayName}</p>
                  <button onClick={logout} className="text-[10px] text-white/40 hover:text-[#F27D26] uppercase tracking-wider transition-colors">Sign Out</button>
                </div>
                <img src={user.photoURL || ''} alt="" className="w-10 h-10 rounded-full border border-white/10" />
              </div>
            ) : (
              <button 
                onClick={signInWithGoogle}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium transition-all hover:bg-white/10 sm:px-4"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid min-h-0 w-full max-w-7xl flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-4">
        <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <StatCard icon={<Flag className="h-4 w-4 text-[#F27D26]" />} label="Mines" value={settings.mines - flagsUsed} />
            <StatCard icon={<Timer className="h-4 w-4 text-[#F27D26]" />} label="Time" value={time} />
            <div className="flex min-w-[142px] items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2">
              <div className="rounded-lg bg-white/5 p-2">
                <Settings className="h-4 w-4 text-white/60" />
              </div>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                className="min-w-0 flex-1 cursor-pointer bg-transparent text-sm font-semibold focus:outline-none"
                aria-label="Difficulty"
              >
                <option value="beginner" className="bg-[#141414]">Beginner</option>
                <option value="intermediate" className="bg-[#141414]">Intermediate</option>
                <option value="expert" className="bg-[#141414]">Expert</option>
              </select>
            </div>
          </div>

          <div className="relative grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2">
              <p className="min-w-0 truncate text-xs text-white/50">Tap to clear. Use Mark for flags.</p>
              <button
                type="button"
                onClick={initGrid}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition-all hover:bg-white/10"
                aria-label="New game"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setFlagMode(mode => !mode)}
                disabled={gameState !== 'playing'}
                className={cn(
                  "flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40",
                  flagMode
                    ? "border-[#F27D26] bg-[#F27D26] text-white shadow-lg shadow-[#F27D26]/20"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                )}
                aria-pressed={flagMode}
              >
                <Flag className="h-4 w-4" />
                Mark
              </button>
            </div>

            <div className="relative min-h-0">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#F27D26] to-[#FF4444] opacity-20 blur transition duration-1000"></div>
              <div className="relative grid h-full min-h-0 place-items-center rounded-xl border border-white/10 bg-[#141414] p-2">
                <div className="board-grid grid gap-1" style={boardStyle}>
                  {grid.map((row, y) => (
                    row.map((cell, x) => (
                      <CellComponent
                        key={`${x}-${y}`}
                        cell={cell}
                        onClick={() => handleCellClick(x, y)}
                        onContextMenu={(e) => handleContextMenu(e, x, y)}
                        gameState={gameState}
                      />
                    ))
                  ))}
                </div>

                <AnimatePresence>
                  {(gameState === 'won' || gameState === 'lost') && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/60 p-4 backdrop-blur-sm"
                    >
                      <div className="space-y-4 rounded-xl border border-white/20 bg-[#141414] p-5 text-center shadow-2xl">
                        <div className={cn(
                          "mx-auto flex h-16 w-16 items-center justify-center rounded-full",
                          gameState === 'won' ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500"
                        )}>
                          {gameState === 'won' ? <Trophy className="h-8 w-8" /> : <Bomb className="h-8 w-8" />}
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold uppercase italic tracking-tight">
                            {gameState === 'won' ? 'Victory!' : 'Game Over'}
                          </h2>
                          <p className="mt-1 text-sm text-white/40">
                            {gameState === 'won' ? `Completed in ${time} seconds` : 'Better luck next time'}
                          </p>
                        </div>
                        <button
                          onClick={initGrid}
                          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#F27D26] py-3 font-bold text-white shadow-lg shadow-[#F27D26]/20 transition-all hover:bg-[#F27D26]/90"
                        >
                          <RotateCcw className="h-5 w-5" />
                          Play Again
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </section>

        <aside className="hidden min-h-0 space-y-3 lg:block">
          <section className="flex max-h-full flex-col overflow-hidden rounded-xl border border-white/10 bg-[#141414]">
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#F27D26]" />
                <h3 className="text-sm font-bold uppercase tracking-widest italic">Leaderboard</h3>
              </div>
              <span className="text-[10px] text-white/40 uppercase tracking-widest font-mono">{difficulty}</span>
            </div>
            <div className="min-h-0 flex-1 p-2">
              {highScores.length > 0 ? (
                highScores.map((score, idx) => (
                  <div key={score.id} className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors group">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-white/20 w-4">{idx + 1}</span>
                      <div>
                        <p className="text-sm font-medium group-hover:text-[#F27D26] transition-colors">{score.displayName}</p>
                        <p className="text-[10px] text-white/40 uppercase font-mono">{new Date(score.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono font-bold text-[#F27D26]">{score.time}s</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <p className="text-sm text-white/20 italic">No records yet.<br/>Be the first!</p>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">Pro Tips</h3>
            <ul className="space-y-2">
              <TipItem text="Use Mark when you want to place or remove a flag." />
              <TipItem text="The numbers indicate how many mines are adjacent." />
              <TipItem text="First click is always safe and clears a space." />
              <TipItem text="Try to clear the board in the fastest time possible." />
            </ul>
          </section>
        </aside>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: number | string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2">
      <div className="shrink-0 rounded-lg bg-white/5 p-2">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate font-mono text-[9px] uppercase tracking-widest text-white/40 sm:text-[10px]">{label}</p>
        <p className="font-mono text-lg font-bold leading-tight sm:text-xl">{value}</p>
      </div>
    </div>
  );
}

function TipItem({ text }: { text: string }) {
  return (
    <li className="flex gap-3 text-sm text-white/60">
      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#F27D26]/40 shrink-0" />
      {text}
    </li>
  );
}

function CellComponent({ cell, onClick, onContextMenu, gameState }: { 
  cell: Cell, 
  onClick: () => void, 
  onContextMenu: (e: React.MouseEvent) => void,
  gameState: string,
  key?: string
}) {
  const isGameOver = gameState === 'won' || gameState === 'lost';
  
  const getNumberColor = (count: number) => {
    const colors = [
      '', 'text-blue-400', 'text-emerald-400', 'text-rose-400', 
      'text-indigo-400', 'text-amber-400', 'text-cyan-400', 
      'text-purple-400', 'text-pink-400'
    ];
    return colors[count] || 'text-white';
  };

  return (
    <motion.button
      type="button"
      whileHover={!cell.isRevealed && !isGameOver ? { scale: 1.05, backgroundColor: 'rgba(255,255,255,0.1)' } : {}}
      whileTap={!cell.isRevealed && !isGameOver ? { scale: 0.95 } : {}}
      onClick={onClick}
      onContextMenu={onContextMenu}
      aria-label={`Cell ${cell.x + 1}, ${cell.y + 1}${cell.isFlagged ? ', flagged' : ''}${cell.isRevealed ? ', revealed' : ''}`}
      data-testid={`cell-${cell.x}-${cell.y}`}
      data-flagged={cell.isFlagged}
      data-revealed={cell.isRevealed}
      className={cn(
        "cell-button flex appearance-none items-center justify-center rounded-md text-sm font-bold transition-all duration-200",
        cell.isRevealed 
          ? "bg-white/5 shadow-inner" 
          : "bg-white/10 shadow-md border border-white/5 hover:border-white/20",
        cell.isRevealed && cell.isMine && "bg-red-500/40 text-white",
        gameState === 'lost' && cell.isMine && !cell.isRevealed && "bg-red-500/10"
      )}
    >
      {cell.isRevealed ? (
        cell.isMine ? (
          <Bomb className="w-5 h-5" />
        ) : (
          cell.neighborCount > 0 && (
            <span className={cn("font-mono", getNumberColor(cell.neighborCount))}>
              {cell.neighborCount}
            </span>
          )
        )
      ) : (
        cell.isFlagged && <Flag className="w-4 h-4 text-[#F27D26] drop-shadow-[0_0_8px_rgba(242,125,38,0.5)]" />
      )}
    </motion.button>
  );
}
