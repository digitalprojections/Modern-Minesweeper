import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ChevronRight,
  ChevronLeft,
  Github,
  Twitter
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
import {
  countFlags,
  createEmptyGrid,
  createStartedGrid,
  hasWon,
  revealCells,
  toggleFlag,
} from './gameLogic';

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
    <div className="min-h-screen bg-[#050505] text-[#E4E3E0] font-sans selection:bg-[#F27D26] selection:text-white overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-white/10 p-3 sm:p-4 sticky top-0 bg-[#050505]/80 backdrop-blur-md z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-[#F27D26] rounded-lg flex items-center justify-center shadow-lg shadow-[#F27D26]/20">
              <Bomb className="text-white w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight uppercase italic">Minesweeper</h1>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono">Modern Edition v1.0</p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
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
                className="flex items-center gap-2 px-3 py-2 sm:px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-medium transition-all"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-3 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8">
        {/* Left Column: Game Area */}
        <div className="lg:col-span-8 space-y-4 sm:space-y-6">
          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <StatCard icon={<Flag className="w-4 h-4 text-[#F27D26]" />} label="Mines Left" value={SETTINGS[difficulty].mines - flagsUsed} />
            <StatCard icon={<Timer className="w-4 h-4 text-[#F27D26]" />} label="Time" value={time} />
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/5 rounded-lg">
                  <Settings className="w-4 h-4 text-white/60" />
                </div>
                <select 
                  value={difficulty} 
                  onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                  className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer"
                >
                  <option value="beginner" className="bg-[#141414]">Beginner</option>
                  <option value="intermediate" className="bg-[#141414]">Intermediate</option>
                  <option value="expert" className="bg-[#141414]">Expert</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs text-white/50">Tap to clear. Use Mark for flags.</p>
            <button
              type="button"
              onClick={() => setFlagMode(mode => !mode)}
              disabled={gameState !== 'playing'}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 sm:px-4 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40",
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

          {/* Game Board Container */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#F27D26] to-[#FF4444] rounded-3xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
            <div className="relative bg-[#141414] border border-white/10 rounded-2xl p-3 sm:p-6 lg:p-8 overflow-auto flex justify-center min-h-[320px] sm:min-h-[400px]">
              <div 
                className="grid gap-1"
                style={{ 
                  gridTemplateColumns: `repeat(${SETTINGS[difficulty].cols}, minmax(0, 1fr))`,
                  width: 'fit-content'
                }}
              >
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

              {/* Game Over Overlay */}
              <AnimatePresence>
                {(gameState === 'won' || gameState === 'lost') && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl z-10"
                  >
                    <div className="text-center space-y-6 p-8 bg-[#141414] border border-white/20 rounded-3xl shadow-2xl">
                      <div className={cn(
                        "w-20 h-20 mx-auto rounded-full flex items-center justify-center",
                        gameState === 'won' ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500"
                      )}>
                        {gameState === 'won' ? <Trophy className="w-10 h-10" /> : <Bomb className="w-10 h-10" />}
                      </div>
                      <div>
                        <h2 className="text-3xl font-bold uppercase italic tracking-tight">
                          {gameState === 'won' ? 'Victory!' : 'Game Over'}
                        </h2>
                        <p className="text-white/40 text-sm mt-1">
                          {gameState === 'won' ? `Completed in ${time} seconds` : 'Better luck next time'}
                        </p>
                      </div>
                      <button 
                        onClick={initGrid}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-[#F27D26] hover:bg-[#F27D26]/90 text-white font-bold rounded-xl transition-all shadow-lg shadow-[#F27D26]/20"
                      >
                        <RotateCcw className="w-5 h-5" />
                        Play Again
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Right Column: Leaderboard & Info */}
        <div className="lg:col-span-4 space-y-8">
          {/* Leaderboard Section */}
          <section className="bg-[#141414] border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#F27D26]" />
                <h3 className="text-sm font-bold uppercase tracking-widest italic">Leaderboard</h3>
              </div>
              <span className="text-[10px] text-white/40 uppercase tracking-widest font-mono">{difficulty}</span>
            </div>
            <div className="p-2">
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

          {/* Tips Section */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">Pro Tips</h3>
            <ul className="space-y-3">
              <TipItem text="Use Mark when you want to place or remove a flag." />
              <TipItem text="The numbers indicate how many mines are adjacent." />
              <TipItem text="First click is always safe and clears a space." />
              <TipItem text="Try to clear the board in the fastest time possible." />
            </ul>
          </section>

          {/* Footer Info */}
          <div className="flex items-center justify-center gap-6 text-white/20">
            <a href="#" className="hover:text-white transition-colors"><Twitter className="w-5 h-5" /></a>
            <a href="#" className="hover:text-white transition-colors"><Github className="w-5 h-5" /></a>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: number | string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-center gap-2 sm:gap-4">
      <div className="p-2 bg-white/5 rounded-lg shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono">{label}</p>
        <p className="text-xl font-mono font-bold">{value}</p>
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
    <motion.div
      whileHover={!cell.isRevealed && !isGameOver ? { scale: 1.05, backgroundColor: 'rgba(255,255,255,0.1)' } : {}}
      whileTap={!cell.isRevealed && !isGameOver ? { scale: 0.95 } : {}}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={cn(
        "w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-sm font-bold cursor-pointer transition-all duration-200 rounded-md select-none",
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
    </motion.div>
  );
}
