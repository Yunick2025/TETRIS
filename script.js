import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, RotateCcw, ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';

// --- Constants & Types ---
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

type TetrominoShape = number[][];
type TetrominoType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';

const TETROMINOES: Record<TetrominoType, { shape: TetrominoShape; color: string }> = {
  I: { shape: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], color: 'bg-cyan-400' },
  J: { shape: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], color: 'bg-blue-500' },
  L: { shape: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], color: 'bg-orange-500' },
  O: { shape: [[1, 1], [1, 1]], color: 'bg-yellow-400' },
  S: { shape: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], color: 'bg-green-500' },
  T: { shape: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], color: 'bg-purple-500' },
  Z: { shape: [[1, 1, 0], [0, 1, 1], [0, 0, 0]], color: 'bg-red-500' },
};

const TETROMINO_KEYS = Object.keys(TETROMINOES) as TetrominoType[];

type BoardCell = string | null; // null = empty, string = tailwind bg color class
type Board = BoardCell[][];

const createEmptyBoard = (): Board =>
  Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));

const randomTetromino = () => {
  const key = TETROMINO_KEYS[Math.floor(Math.random() * TETROMINO_KEYS.length)];
  return { type: key, ...TETROMINOES[key] };
};

// Custom hook for accurate intervals with React state
function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay !== null) {
      const id = setInterval(() => savedCallback.current(), delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

export default function TetrisGame() {
  // --- State ---
  const [board, setBoard] = useState<Board>(createEmptyBoard());
  const [currentPiece, setCurrentPiece] = useState({
    ...randomTetromino(),
    pos: { x: Math.floor(BOARD_WIDTH / 2) - 1, y: 0 },
  });
  const [nextPiece, setNextPiece] = useState(randomTetromino());
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  // --- Game Logic Helpers ---
  const checkCollision = useCallback(
    (piecePos: { x: number; y: number }, pieceShape: TetrominoShape, boardState: Board) => {
      for (let y = 0; y < pieceShape.length; y += 1) {
        for (let x = 0; x < pieceShape[y].length; x += 1) {
          // Check if cell is part of the piece
          if (pieceShape[y][x] !== 0) {
            const newX = piecePos.x + x;
            const newY = piecePos.y + y;

            // Bounds check
            if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT) {
              return true;
            }
            // Occupied cell check (make sure we don't check above the board for initial spawns)
            if (newY >= 0 && boardState[newY][newX] !== null) {
              return true;
            }
          }
        }
      }
      return false;
    },
    []
  );

  const rotateMatrix = (matrix: TetrominoShape): TetrominoShape => {
    // Transpose then reverse each row
    return matrix[0].map((val, index) => matrix.map((row) => row[index]).reverse());
  };

  // --- Actions ---
  const move = (dirX: number, dirY: number) => {
    if (gameOver || isPaused || !gameStarted) return false;

    const newPos = { x: currentPiece.pos.x + dirX, y: currentPiece.pos.y + dirY };
    if (!checkCollision(newPos, currentPiece.shape, board)) {
      setCurrentPiece((prev) => ({ ...prev, pos: newPos }));
      return true;
    }
    return false;
  };

  const rotate = () => {
    if (gameOver || isPaused || !gameStarted) return;
    const rotatedShape = rotateMatrix(currentPiece.shape);
    // Basic wall kick: try normally, if fail try shifting left/right
    if (!checkCollision(currentPiece.pos, rotatedShape, board)) {
      setCurrentPiece((prev) => ({ ...prev, shape: rotatedShape }));
    } else if (!checkCollision({ ...currentPiece.pos, x: currentPiece.pos.x - 1 }, rotatedShape, board)) {
       setCurrentPiece((prev) => ({ ...prev, pos: { ...prev.pos, x: prev.pos.x - 1 }, shape: rotatedShape }));
    } else if (!checkCollision({ ...currentPiece.pos, x: currentPiece.pos.x + 1 }, rotatedShape, board)) {
        setCurrentPiece((prev) => ({ ...prev, pos: { ...prev.pos, x: prev.pos.x + 1 }, shape: rotatedShape }));
    }
  };

  const drop = useCallback(() => {
    if (gameOver || isPaused || !gameStarted) return;

    const newPos = { x: currentPiece.pos.x, y: currentPiece.pos.y + 1 };
    if (!checkCollision(newPos, currentPiece.shape, board)) {
      setCurrentPiece((prev) => ({ ...prev, pos: newPos }));
    } else {
      // Lock piece
      lockPiece();
    }
  }, [currentPiece, board, gameOver, isPaused, gameStarted, checkCollision]);

  const hardDrop = () => {
    if (gameOver || isPaused || !gameStarted) return;
    let currentY = currentPiece.pos.y;
    while (!checkCollision({ x: currentPiece.pos.x, y: currentY + 1 }, currentPiece.shape, board)) {
      currentY += 1;
    }
    setCurrentPiece(prev => ({...prev, pos: { ...prev.pos, y: currentY }}));
    // We need to force a lock immediately after updating state. 
    // Since state update is async, we pass the *future* confirmed position to a lock helper or rely on next tick.
    // Better approach for hard drop: calculate final position and lock immediately in one go to avoid visual stutter.
    
    // Re-calculate to be safe inside the intense logic
    let finalY = currentPiece.pos.y;
     while (!checkCollision({ x: currentPiece.pos.x, y: finalY + 1 }, currentPiece.shape, board)) {
      finalY += 1;
    }

    const lockedBoard = [...board.map((row) => [...row])];
    currentPiece.shape.forEach((row, y) => {
        row.forEach((cell, x) => {
            if (cell !== 0) {
                const boardY = finalY + y;
                const boardX = currentPiece.pos.x + x;
                if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
                    lockedBoard[boardY][boardX] = currentPiece.color;
                }
            }
        });
    });

    processBoardUpdate(lockedBoard);
  };

  const lockPiece = () => {
    const newBoard = [...board.map((row) => [...row])]; // Deepish copy
    
    // 1. Merge piece into board
    currentPiece.shape.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell !== 0) {
          const boardY = currentPiece.pos.y + y;
          const boardX = currentPiece.pos.x + x;
          // If piece locks above visible board, it's game over usually, but we handle it by just ignoring OOB writes if they are super high, 
          // or declaring game over if it's at row 0.
          if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
            newBoard[boardY][boardX] = currentPiece.color;
          }
        }
      });
    });

    processBoardUpdate(newBoard);
  };

  const processBoardUpdate = (nextBoardState: Board) => {
    // 2. Check for cleared lines
    let linesCleared = 0;
    const finalBoard = nextBoardState.filter((row) => {
      const isFull = row.every((cell) => cell !== null);
      if (isFull) linesCleared += 1;
      return !isFull;
    });

    // 3. Add new empty lines at the top
    while (finalBoard.length < BOARD_HEIGHT) {
      finalBoard.unshift(Array(BOARD_WIDTH).fill(null));
    }

    // 4. Update stats
    if (linesCleared > 0) {
      setLines((prev) => prev + linesCleared);
      // Classic scoring: 100/300/500/800 * level
      const scoreMultipliers = [0, 100, 300, 500, 800];
      setScore((prev) => prev + scoreMultipliers[linesCleared] * level);
      
      // Level up every 10 lines
      setLevel(prevLevel => {
          const newTotalLines = lines + linesCleared;
          return Math.floor(newTotalLines / 10) + 1;
      });
    }

    setBoard(finalBoard);

    // 5. Spawn next piece & check Game Over
    const newPiece = {
      ...nextPiece,
      pos: { x: Math.floor(BOARD_WIDTH / 2) - Math.floor(nextPiece.shape[0].length / 2), y: 0 },
    };

    if (checkCollision(newPiece.pos, newPiece.shape, finalBoard)) {
      setGameOver(true);
      setGameStarted(false);
    } else {
      setCurrentPiece(newPiece);
      setNextPiece(randomTetromino());
    }
  }

  // --- Game Loop ---
  // Speed formula: starts at 800ms, decreases by ~10% per level
  const tickRate = gameStarted && !isPaused && !gameOver ? Math.max(100, 800 * Math.pow(0.9, level - 1)) : null;
  
  useInterval(() => {
    drop();
  }, tickRate);

  // --- Inputs ---
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (gameOver || !gameStarted) return;

      // Prevent default scrolling for game keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (!isPaused) {
        switch (e.key) {
          case 'ArrowLeft':
            move(-1, 0);
            break;
          case 'ArrowRight':
            move(1, 0);
            break;
          case 'ArrowDown':
            drop(); // Soft drop
            setScore(s => s + 1); // 1 point for soft drop
            break;
          case 'ArrowUp':
            rotate();
            break;
          case ' ': // Spacebar
            hardDrop();
            break;
        }
      }
      
      if (e.key === 'p' || e.key === 'P') {
        setIsPaused((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameOver, isPaused, gameStarted, currentPiece, board]); // Deps needed for latest state in closures if not careful, but move/rotate use functional state mostly.


  // --- Controls UI Handlers ---
  const startGame = () => {
    setBoard(createEmptyBoard());
    setCurrentPiece({ ...randomTetromino(), pos: { x: Math.floor(BOARD_WIDTH / 2) - 1, y: 0 } });
    setNextPiece(randomTetromino());
    setScore(0);
    setLines(0);
    setLevel(1);
    setGameOver(false);
    setIsPaused(false);
    setGameStarted(true);
  };

  // --- Rendering Helpers ---
  // Create a composite display board that includes the static board AND the currently falling piece
  const getDisplayBoard = () => {
    const display = board.map((row) => [...row]);
    
    // Draw ghost piece (optional UX improvement, helps with hard drops)
    if (gameStarted && !gameOver && !isPaused) {
        let ghostY = currentPiece.pos.y;
        while (!checkCollision({ x: currentPiece.pos.x, y: ghostY + 1 }, currentPiece.shape, board)) {
            ghostY++;
        }
        // Only draw ghost if it's not overlapping the actual piece entirely (it always will at spawn, but that's ok)
        currentPiece.shape.forEach((row, y) => {
            row.forEach((cell, x) => {
                if (cell !== 0) {
                     const boardY = ghostY + y;
                     const boardX = currentPiece.pos.x + x;
                     if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
                         // Use a lighter/transparent version of the color or just a gray outline
                         if (!display[boardY][boardX]) { // Don't overwrite if something is there (though collision check should prevent this)
                             display[boardY][boardX] = 'bg-gray-700/50 border-2 border-dashed border-white/20'; // Special ghost styling class marker
                         }
                     }
                }
            })
        })
    }

    // Draw active piece
    if (gameStarted && !gameOver) {
      currentPiece.shape.forEach((row, y) => {
        row.forEach((cell, x) => {
          if (cell !== 0) {
            const boardY = currentPiece.pos.y + y;
            const boardX = currentPiece.pos.x + x;
            if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
              display[boardY][boardX] = currentPiece.color;
            }
          }
        });
      });
    }
    return display;
  };

  const displayBoard = getDisplayBoard();

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4 font-mono">
      <div className="max-w-4xl w-full bg-gray-800 p-6 rounded-2xl shadow-2xl flex flex-col md:flex-row gap-8">
        
        {/* Left Sidebar - Stats & Next Piece */}
        <div className="flex flex-col gap-6 min-w-[200px]">
          <div>
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-2">
              TETRIS
            </h1>
            <p className="text-gray-400 text-sm">React Edition</p>
          </div>

          {/* Stats Box */}
          <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 space-y-3">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wider">Score</p>
              <p className="text-2xl font-bold text-white">{score.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wider">Level</p>
              <p className="text-xl font-semibold text-yellow-400">{level}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wider">Lines</p>
              <p className="text-xl font-semibold text-green-400">{lines}</p>
            </div>
          </div>

          {/* Next Piece */}
          <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 flex flex-col items-center">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-3 w-full text-left">Next</p>
            <div className="grid grid-cols-4 gap-1 p-2 bg-gray-800 rounded-lg w-24 h-24 flex items-center justify-center">
              {/* Render next piece centered in a 4x4 grid roughly */}
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${nextPiece.shape[0].length}, minmax(0, 1fr))` }}>
                  {nextPiece.shape.map((row, y) => (
                    row.map((cell, x) => (
                      <div
                        key={`next-${y}-${x}`}
                        className={`w-4 h-4 rounded-sm ${cell ? nextPiece.color : 'bg-transparent'}`}
                      />
                    ))
                  ))}
              </div>
            </div>
          </div>

           {/* Controls Help - Visible on Desktop mainly */}
           <div className="hidden md:block bg-gray-900/50 p-4 rounded-xl border border-gray-700 text-xs text-gray-400 space-y-2">
            <p className="font-bold text-gray-300 mb-1">Controls:</p>
            <div className="flex items-center gap-2"><ArrowLeft size={14} /> <ArrowRight size={14} /> Move</div>
            <div className="flex items-center gap-2"><ArrowUp size={14} /> Rotate</div>
            <div className="flex items-center gap-2"><ArrowDown size={14} /> Soft Drop</div>
            <div className="flex items-center gap-2"><span className="border px-1 rounded border-gray-600 text-[10px]">SPACE</span> Hard Drop</div>
            <div className="flex items-center gap-2"><span className="border px-1 rounded border-gray-600 text-[10px]">P</span> Pause</div>
          </div>
        </div>

        {/* Main Game Board Area */}
        <div className="flex-1 flex justify-center bg-gray-950 p-1 md:p-4 rounded-xl border-2 border-gray-700 relative overflow-hidden">
          
          {/* The Grid */}
          <div className="grid grid-cols-10 grid-rows-20 gap-px bg-gray-900 border border-gray-800 p-1" style={{ aspectRatio: '10/20', maxHeight: '80vh' }}>
            {displayBoard.map((row, y) =>
              row.map((cell, x) => (
                <div
                  key={`${y}-${x}`}
                  className={`w-full h-full rounded-sm transition-colors duration-75 ${cell || 'bg-gray-800/30'}`}
                />
              ))
            )}
          </div>

          {/* Overlays */}
          {(!gameStarted || gameOver || isPaused) && (
            <div className="absolute inset-0 bg-gray-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
              {gameOver ? (
                <div className="text-center animate-in fade-in zoom-in duration-300">
                  <h2 className="text-5xl font-extrabold text-red-500 mb-2 drop-shadow-lg">GAME OVER</h2>
                  <p className="text-xl text-gray-300 mb-6">Final Score: {score}</p>
                  <button
                    onClick={startGame}
                    className="flex items-center gap-2 bg-white text-gray-900 px-8 py-3 rounded-full font-bold hover:bg-gray-200 transition-all hover:scale-105 active:scale-95"
                  >
                    <RotateCcw size={20} /> Play Again
                  </button>
                </div>
              ) : isPaused ? (
                <div className="text-center">
                  <h2 className="text-4xl font-bold text-yellow-400 mb-6">PAUSED</h2>
                  <button
                    onClick={() => setIsPaused(false)}
                    className="flex items-center gap-2 bg-yellow-400 text-gray-900 px-8 py-3 rounded-full font-bold hover:bg-yellow-300 transition-all"
                  >
                    <Play size={20} /> Resume
                  </button>
                </div>
              ) : (
                <div className="text-center">
                   <h2 className="text-3xl font-bold text-white mb-6">Ready to Play?</h2>
                  <button
                    onClick={startGame}
                    className="flex items-center gap-2 bg-blue-500 text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-blue-400 transition-all hover:shadow-lg hover:shadow-blue-500/20 hover:-translate-y-1"
                  >
                    <Play size={24} /> START GAME
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile Controls (Visible only on small screens) */}
        <div className="md:hidden grid grid-cols-3 gap-2 mt-4">
            <button className="p-4 bg-gray-700 rounded-lg flex justify-center active:bg-gray-600" onClick={() => rotate()}><ArrowUp /></button>
             <div className="flex flex-col gap-2">
                 <button className="p-4 bg-gray-700 rounded-lg flex justify-center active:bg-gray-600" onClick={() => move(0, -1)} disabled={true} className="invisible p-4"></button>
                 <button className="p-4 bg-gray-700 rounded-lg flex justify-center active:bg-gray-600" onClick={() => drop()}><ArrowDown /></button>
            </div>
            <div /> {/* spacer */}
            
            <button className="p-4 bg-gray-700 rounded-lg flex justify-center active:bg-gray-600" onClick={() => move(-1, 0)}><ArrowLeft /></button>
            <button className="p-4 bg-blue-600 rounded-lg flex justify-center active:bg-blue-700 font-bold" onClick={() => hardDrop()}>DROP</button>
            <button className="p-4 bg-gray-700 rounded-lg flex justify-center active:bg-gray-600" onClick={() => move(1, 0)}><ArrowRight /></button>

             <button className="col-span-3 p-3 mt-2 bg-gray-800 border border-gray-700 rounded-lg flex justify-center items-center gap-2 active:bg-gray-700" onClick={() => setIsPaused(p => !p)}>
                 {isPaused ? <Play size={16}/> : <Pause size={16}/>} {isPaused ? "Resume" : "Pause"}
             </button>
        </div>

      </div>
    </div>
  );
}
