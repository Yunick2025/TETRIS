import React, { useState, useEffect, useCallback } from 'react';

type Piece = number[][];
type Board = number[][];

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const CELL_SIZE = 30;

const PIECES: Piece[] = [
  [[1, 1, 1, 1]], // I
  [[1, 1], [1, 1]], // O
  [[0, 1, 1], [1, 1, 0]], // S
  [[1, 1, 0], [0, 1, 1]], // Z
  [[1, 0, 0], [1, 1, 1]], // J
  [[0, 0, 1], [1, 1, 1]], // L
  [[0, 1, 0], [1, 1, 1]], // T
];

const COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#FFA07A', // Light Salmon
  '#98D8C8', // Mint
  '#F7DC6F', // Yellow
  '#BB8FCE', // Purple
];

interface GameState {
  board: Board;
  currentPiece: Piece;
  currentColor: number;
  nextPiece: Piece;
  nextColor: number;
  position: { x: number; y: number };
  score: number;
  lines: number;
  level: number;
  gameOver: boolean;
  isPaused: boolean;
}

const createEmptyBoard = (): Board => {
  return Array(BOARD_HEIGHT)
    .fill(null)
    .map(() => Array(BOARD_WIDTH).fill(0));
};

const getRandomPiece = (): [Piece, number] => {
  const index = Math.floor(Math.random() * PIECES.length);
  return [PIECES[index], index];
};

const rotatePiece = (piece: Piece): Piece => {
  const n = piece.length;
  const rotated = Array(piece[0].length)
    .fill(null)
    .map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < piece[i].length; j++) {
      rotated[j][n - 1 - i] = piece[i][j];
    }
  }
  return rotated;
};

const canMove = (
  board: Board,
  piece: Piece,
  x: number,
  y: number
): boolean => {
  for (let i = 0; i < piece.length; i++) {
    for (let j = 0; j < piece[i].length; j++) {
      if (piece[i][j]) {
        const newX = x + j;
        const newY = y + i;
        if (
          newX < 0 ||
          newX >= BOARD_WIDTH ||
          newY >= BOARD_HEIGHT ||
          (newY >= 0 && board[newY][newX] !== 0)
        ) {
          return false;
        }
      }
    }
  }
  return true;
};

const placePiece = (
  board: Board,
  piece: Piece,
  x: number,
  y: number,
  color: number
): Board => {
  const newBoard = board.map((row) => [...row]);
  for (let i = 0; i < piece.length; i++) {
    for (let j = 0; j < piece[i].length; j++) {
      if (piece[i][j]) {
        const newY = y + i;
        const newX = x + j;
        if (newY >= 0 && newY < BOARD_HEIGHT && newX >= 0 && newX < BOARD_WIDTH) {
          newBoard[newY][newX] = color + 1;
        }
      }
    }
  }
  return newBoard;
};

const clearLines = (board: Board): [Board, number] => {
  let newBoard = board.map((row) => [...row]);
  let linesCleared = 0;

  for (let i = newBoard.length - 1; i >= 0; i--) {
    if (newBoard[i].every((cell) => cell !== 0)) {
      newBoard.splice(i, 1);
      newBoard.unshift(Array(BOARD_WIDTH).fill(0));
      linesCleared++;
      i++;
    }
  }

  return [newBoard, linesCleared];
};

const TetrisGame: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(() => {
    const [nextPiece, nextColor] = getRandomPiece();
    const [currentPiece, currentColor] = getRandomPiece();
    return {
      board: createEmptyBoard(),
      currentPiece,
      currentColor,
      nextPiece,
      nextColor,
      position: { x: 3, y: 0 },
      score: 0,
      lines: 0,
      level: 1,
      gameOver: false,
      isPaused: false,
    };
  });

  const getGameSpeed = useCallback(() => {
    return Math.max(100, 500 - gameState.level * 30);
  }, [gameState.level]);

  const moveDown = useCallback(() => {
    setGameState((prev) => {
      if (prev.gameOver || prev.isPaused) return prev;

      const newY = prev.position.y + 1;

      if (canMove(prev.board, prev.currentPiece, prev.position.x, newY)) {
        return {
          ...prev,
          position: { ...prev.position, y: newY },
        };
      } else {
        let newBoard = placePiece(
          prev.board,
          prev.currentPiece,
          prev.position.x,
          prev.position.y,
          prev.currentColor
        );

        const [clearedBoard, linesCleared] = clearLines(newBoard);
        newBoard = clearedBoard;

        const newLines = prev.lines + linesCleared;
        const newLevel = Math.floor(newLines / 10) + 1;
        const scoreIncrease =
          linesCleared === 1
            ? 100
            : linesCleared === 2
              ? 300
              : linesCleared === 3
                ? 500
                : 800;

        if (
          !canMove(
            newBoard,
            prev.nextPiece,
            3,
            0
          )
        ) {
          return {
            ...prev,
            gameOver: true,
          };
        }

        return {
          ...prev,
          board: newBoard,
          currentPiece: prev.nextPiece,
          currentColor: prev.nextColor,
          position: { x: 3, y: 0 },
          score: prev.score + scoreIncrease,
          lines: newLines,
          level: newLevel,
          nextPiece: getRandomPiece()[0],
          nextColor: getRandomPiece()[1],
        };
      }
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      moveDown();
    }, getGameSpeed());

    return () => clearInterval(interval);
  }, [moveDown, getGameSpeed]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (gameState.gameOver) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          setGameState((prev) => {
            const newX = prev.position.x - 1;
            if (
              canMove(
                prev.board,
                prev.currentPiece,
                newX,
                prev.position.y
              )
            ) {
              return {
                ...prev,
                position: { ...prev.position, x: newX },
              };
            }
            return prev;
          });
          break;
        case 'ArrowRight':
          e.preventDefault();
          setGameState((prev) => {
            const newX = prev.position.x + 1;
            if (
              canMove(
                prev.board,
                prev.currentPiece,
                newX,
                prev.position.y
              )
            ) {
              return {
                ...prev,
                position: { ...prev.position, x: newX },
              };
            }
            return prev;
          });
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveDown();
          break;
        case ' ':
          e.preventDefault();
          setGameState((prev) => ({
            ...prev,
            isPaused: !prev.isPaused,
          }));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setGameState((prev) => {
            const rotated = rotatePiece(prev.currentPiece);
            if (
              canMove(
                prev.board,
                rotated,
                prev.position.x,
                prev.position.y
              )
            ) {
              return {
                ...prev,
                currentPiece: rotated,
              };
            }
            return prev;
          });
          break;
      }
    },
    [gameState.gameOver, moveDown]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const resetGame = () => {
    const [nextPiece, nextColor] = getRandomPiece();
    const [currentPiece, currentColor] = getRandomPiece();
    setGameState({
      board: createEmptyBoard(),
      currentPiece,
      currentColor,
      nextPiece,
      nextColor,
      position: { x: 3, y: 0 },
      score: 0,
      lines: 0,
      level: 1,
      gameOver: false,
      isPaused: false,
    });
  };

  const renderBoard = () => {
    const displayBoard = gameState.board.map((row) => [...row]);

    for (let i = 0; i < gameState.currentPiece.length; i++) {
      for (let j = 0; j < gameState.currentPiece[i].length; j++) {
        if (gameState.currentPiece[i][j]) {
          const y = gameState.position.y + i;
          const x = gameState.position.x + j;
          if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) {
            displayBoard[y][x] = gameState.currentColor + 1;
          }
        }
      }
    }

    return displayBoard;
  };

  const displayBoard = renderBoard();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="flex gap-8 max-w-6xl">
        {/* Main Game Area */}
        <div className="flex flex-col gap-6">
          {/* Game Board */}
          <div className="bg-slate-950 rounded-2xl p-4 shadow-2xl border border-slate-700">
            <div
              className="bg-black rounded-lg overflow-hidden border-2 border-slate-600"
              style={{
                width: BOARD_WIDTH * CELL_SIZE,
                height: BOARD_HEIGHT * CELL_SIZE,
              }}
            >
              {displayBoard.map((row, y) => (
                <div key={y} className="flex">
                  {row.map((cell, x) => (
                    <div
                      key={`${y}-${x}`}
                      className="border border-slate-800 transition-colors duration-100"
                      style={{
                        width: CELL_SIZE,
                        height: CELL_SIZE,
                        backgroundColor:
                          cell === 0 ? '#000000' : COLORS[cell - 1],
                        boxShadow:
                          cell !== 0
                            ? `inset 0 0 4px rgba(0,0,0,0.5), 0 0 8px ${COLORS[cell - 1]}40`
                            : 'none',
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Controls Info */}
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-slate-300 text-sm font-medium mb-2">Controls:</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
              <div>← → Move</div>
              <div>↑ Rotate</div>
              <div>↓ Drop</div>
              <div>Space Pause</div>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="flex flex-col gap-6 w-64">
          {/* Score Card */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 shadow-xl border border-blue-500">
            <p className="text-blue-100 text-sm font-semibold mb-2">SCORE</p>
            <p className="text-white text-4xl font-bold">
              {gameState.score.toString().padStart(6, '0')}
            </p>
          </div>

          {/* Level Card */}
          <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl p-6 shadow-xl border border-purple-500">
            <p className="text-purple-100 text-sm font-semibold mb-2">LEVEL</p>
            <p className="text-white text-4xl font-bold">{gameState.level}</p>
            <p className="text-purple-200 text-xs mt-2">
              Speed: {Math.round(1000 / getGameSpeed())}x
            </p>
          </div>

          {/* Lines Card */}
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-6 shadow-xl border border-emerald-500">
            <p className="text-emerald-100 text-sm font-semibold mb-2">LINES</p>
            <p className="text-white text-4xl font-bold">
              {gameState.lines.toString().padStart(3, '0')}
            </p>
          </div>

          {/* Next Piece */}
          <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700">
            <p className="text-slate-300 text-sm font-semibold mb-4">NEXT</p>
            <div className="bg-black rounded-lg p-4 flex items-center justify-center h-32">
              <div className="flex flex-col gap-1">
                {gameState.nextPiece.map((row, i) => (
                  <div key={i} className="flex gap-1">
                    {row.map((cell, j) => (
                      <div
                        key={`${i}-${j}`}
                        className="rounded"
                        style={{
                          width: 20,
                          height: 20,
                          backgroundColor:
                            cell === 0
                              ? 'transparent'
                              : COLORS[gameState.nextColor],
                          boxShadow:
                            cell !== 0
                              ? `0 0 6px ${COLORS[gameState.nextColor]}60`
                              : 'none',
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Game Status */}
          {gameState.isPaused && (
            <div className="bg-yellow-600 rounded-xl p-4 text-center border border-yellow-500">
              <p className="text-white font-bold text-lg">PAUSED</p>
            </div>
          )}

          {gameState.gameOver && (
            <div className="bg-red-600 rounded-xl p-4 text-center border border-red-500">
              <p className="text-white font-bold text-lg mb-3">GAME OVER</p>
              <button
                onClick={resetGame}
                className="w-full bg-white text-red-600 font-bold py-2 rounded-lg hover:bg-red-50 transition-colors"
              >
                Play Again
              </button>
            </div>
          )}

          {!gameState.gameOver && !gameState.isPaused && (
            <button
              onClick={resetGame}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-xl transition-colors border border-slate-600"
            >
              New Game
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TetrisGame;