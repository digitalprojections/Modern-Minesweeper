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
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  
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
    const { rows, cols } = SETTINGS[difficulty];
    const newGrid: Cell[][] = [];
    for (let y = 0; y < rows; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < cols; x++) {
        row.push({
          x, y,
          isMine: false,
          isRevealed: false,
          isFlagged: false,
          neighborCount: 0
        });
      }
      newGrid.push(row);
    }
    setGrid(newGrid);
    setGameState('idle');
    setTime(0);
    setFlagsUsed(0);
    if (timerRef.current) clearInterval(timerRef.current);
  }, [difficulty]);

  useEffect(() => {
    initGrid();
  }, [initGrid]);

  const startGame = (firstX: number, firstY: number) => {
    const { rows, cols, mines } = SETTINGS[difficulty];
    const newGrid = [...grid.map(row => [...row])];
    
    // Place mines
    let minesPlaced = 0;
    while (minesPlaced < mines) {
      const x = Math.floor(Math.random() * cols);
      const y = Math.floor(Math.random() * rows);
      
      // Don't place mine on first click or already placed mine
      if (!newGrid[y][x].isMine && (Math.abs(x - firstX) > 1 || Math.abs(y - firstY) > 1)) {
        newGrid[y][x].isMine = true;
        minesPlaced++;
      }
    }

    // Calculate neighbors
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (!newGrid[y][x].isMine) {
          let count = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const ny = y + dy;
              const nx = x + dx;
              if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && newGrid[ny][nx].isMine) {
                count++;
              }
            }
          }
          newGrid[y][x].neighborCount = count;
        }
      }
    }

    setGrid(newGrid);
    setGameState('playing');
    revealCell(firstX, firstY, newGrid);
    
    timerRef.current = setInterval(() => {
      setTime(t => t + 1);
    }, 1000);
  };

  const revealCell = (x: number, y: number, currentGrid: Cell[][]) => {
    if (currentGrid[y][x].isRevealed || currentGrid[y][x].isFlagged) return;

    const newGrid = [...currentGrid.map(row => [...row])];
    const cell = newGrid[y][x];
    cell.isRevealed = true;

    if (cell.isMine) {
      setGameState('lost');
      if (timerRef.current) clearInterval(timerRef.current);
      // Reveal all mines
      newGrid.forEach(row => row.forEach(c => {
        if (c.isMine) c.isRevealed = true;
      }));
      setGrid(newGrid);
      return;
    }

    if (cell.neighborCount === 0) {
      const { rows, cols } = SETTINGS[difficulty];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) {
            revealCell(nx, ny, newGrid);
          }
        }
      }
    }

    setGrid(newGrid);
    checkWin(newGrid);
  };

  const checkWin = (currentGrid: Cell[][]) => {
    const { rows, cols, mines } = SETTINGS[difficulty];
    let revealedCount = 0;
    currentGrid.forEach(row => row.forEach(c => {
      if (c.isRevealed) revealedCount++;
    }));

    if (revealedCount === rows * cols - mines) {
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
    if (gameState === 'idle') {
      startGame(x, y);
    } else {
      revealCell(x, y, grid);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, x: number, y: number) => {
    e.preventDefault();
    if (gameState === 'idle' || gameState === 'won' || gameState === 'lost') return;
    if (grid[y][x].isRevealed) return;

    const newGrid = [...grid.map(row => [...row])];
    const cell = newGrid[y][x];
    cell.isFlagged = !cell.isFlagged;
    setFlagsUsed(prev => cell.isFlagged ? prev + 1 : prev - 1);
    setGrid(newGrid);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#E4E3E0] font-sans selection:bg-[#F27D26] selection:text-white overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-white/10 p-4 sticky top-0 bg-[#050505]/80 backdrop-blur-md z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#F27D26] rounded-lg flex items-center justify-center shadow-lg shadow-[#F27D26]/20">
              <Bomb className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight uppercase italic">Minesweeper</h1>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono">Modern Edition v1.0</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
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
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-medium transition-all"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Game Area */}
        <div className="lg:col-span-8 space-y-6">
          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-4">
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

          {/* Game Board Container */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#F27D26] to-[#FF4444] rounded-3xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
            <div className="relative bg-[#141414] border border-white/10 rounded-2xl p-4 sm:p-8 overflow-auto flex justify-center min-h-[400px]">
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
              <TipItem text="Right-click to place a flag on suspected mines." />
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
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4">
      <div className="p-2 bg-white/5 rounded-lg">
        {icon}
      </div>
      <div>
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
