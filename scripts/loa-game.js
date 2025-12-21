// Lines of Action Game Logic for Node.js
// Adapted from loa/logic.js

const Piece = {
  BLACK: 'b',
  WHITE: 'w',
  EMPTY: null
};

class LOAGame {
  constructor() {
    this.board = this.createBoard();
    this.turn = Piece.BLACK; // Black typically starts in LOA
    this.winner = null;
    this.history = [];
  }

  createBoard() {
    const board = new Array(8).fill(null).map(() => new Array(8).fill(null));
    
    // Standard Setup
    // Black: Top and Bottom rows (excluding corners)
    // White: Left and Right columns (excluding corners)
    for (let i = 1; i < 7; i++) {
      board[0][i] = { color: Piece.BLACK };
      board[7][i] = { color: Piece.BLACK };
      board[i][0] = { color: Piece.WHITE };
      board[i][7] = { color: Piece.WHITE };
    }
    return board;
  }

  getPiece(row, col) {
    if (row < 0 || row > 7 || col < 0 || col > 7) return null;
    return this.board[row][col];
  }

  // Count pieces on a specific line (row, col, or diagonal)
  countPiecesOnLine(r, c, dr, dc) {
    let count = 0;
    // Scan forward
    let i = 0;
    while (true) {
      const tr = r + i * dr;
      const tc = c + i * dc;
      if (tr < 0 || tr > 7 || tc < 0 || tc > 7) break;
      if (this.getPiece(tr, tc)) count++;
      i++;
    }
    // Scan backward
    i = 1;
    while (true) {
      const tr = r - i * dr;
      const tc = c - i * dc;
      if (tr < 0 || tr > 7 || tc < 0 || tc > 7) break;
      if (this.getPiece(tr, tc)) count++;
      i++;
    }
    return count;
  }

  isValidMove(fromRow, fromCol, toRow, toCol) {
    const piece = this.getPiece(fromRow, fromCol);
    if (!piece || piece.color !== this.turn) return false;

    const dest = this.getPiece(toRow, toCol);
    if (dest && dest.color === piece.color) return false; // Cannot capture own

    const dRow = toRow - fromRow;
    const dCol = toCol - fromCol;
    
    // Must move in straight line
    if (dRow !== 0 && dCol !== 0 && Math.abs(dRow) !== Math.abs(dCol)) return false;

    // Calculate step direction (handle zero cases)
    const stepR = dRow === 0 ? 0 : (dRow > 0 ? 1 : -1);
    const stepC = dCol === 0 ? 0 : (dCol > 0 ? 1 : -1);
    
    // 1. Check distance rule
    const distance = Math.max(Math.abs(dRow), Math.abs(dCol));
    const piecesOnLine = this.countPiecesOnLine(fromRow, fromCol, stepR, stepC);
    
    if (distance !== piecesOnLine) return false;

    // 2. Check path blocking (cannot jump ENEMY pieces)
    for (let i = 1; i < distance; i++) {
      const checkR = fromRow + i * stepR;
      const checkC = fromCol + i * stepC;
      const p = this.getPiece(checkR, checkC);
      if (p && p.color !== piece.color) return false;
    }

    return true;
  }

  move(fromRow, fromCol, toRow, toCol) {
    const piece = this.getPiece(fromRow, fromCol);
    if (!this.isValidMove(fromRow, fromCol, toRow, toCol)) return false;

    const destPiece = this.board[toRow][toCol];

    // Save History
    this.history.push({
      from: { r: fromRow, c: fromCol },
      to: { r: toRow, c: toCol },
      piece: { ...piece },
      captured: destPiece ? { ...destPiece } : null,
      turn: this.turn
    });

    // Execute move
    this.board[toRow][toCol] = this.board[fromRow][fromCol];
    this.board[fromRow][fromCol] = null;

    // Check Win
    if (this.checkWin(this.turn)) {
      this.winner = this.turn;
      return true;
    }

    // Check Opponent Win (can happen if they lose their last disconnected piece)
    const opponent = this.turn === Piece.BLACK ? Piece.WHITE : Piece.BLACK;
    if (this.checkWin(opponent)) {
      this.winner = opponent;
      return true;
    }

    this.turn = opponent;
    return true;
  }

  checkWin(color) {
    // Find all pieces of color
    const pieces = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p && p.color === color) {
          pieces.push({ r, c });
        }
      }
    }

    if (pieces.length <= 1) return true; // 0 or 1 piece is technically connected

    // Flood fill connectivity
    const visited = new Set();
    const queue = [pieces[0]];
    visited.add(`${pieces[0].r},${pieces[0].c}`);
    let count = 0;

    while (queue.length > 0) {
      const { r, c } = queue.shift();
      count++;

      // Check 8 neighbors
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          
          if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            const p = this.getPiece(nr, nc);
            const key = `${nr},${nc}`;
            if (p && p.color === color && !visited.has(key)) {
              visited.add(key);
              queue.push({ r: nr, c: nc });
            }
          }
        }
      }
    }

    return count === pieces.length;
  }

  // Convert algebraic notation (e.g., "a1") to row/col coordinates
  static algebraicToCoords(algebraic) {
    if (algebraic.length !== 2) return null;
    const col = algebraic.charCodeAt(0) - 97; // 'a' = 0
    const row = 8 - parseInt(algebraic[1]); // '1' = row 7, '8' = row 0
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    return { row, col };
  }

  // Convert row/col coordinates to algebraic notation (e.g., "a1")
  static coordsToAlgebraic(row, col) {
    const colChar = String.fromCharCode(97 + col);
    const rowNum = 8 - row;
    return `${colChar}${rowNum}`;
  }

  // Export game state to PGN-like format
  exportToPGN() {
    let pgn = '[Event ""]\n';
    pgn += '[Site ""]\n';
    pgn += '[Date "??"]\n';
    pgn += '[Round ""]\n';
    pgn += '[White ""]\n';
    pgn += '[Black ""]\n';
    pgn += `[Result "${this.winner ? (this.winner === Piece.WHITE ? '1-0' : '0-1') : '*'}"]\n\n`;

    if (this.history.length === 0) {
      return pgn;
    }

    // Format moves as "1. from-to 2. from-to"
    const moves = [];
    for (let i = 0; i < this.history.length; i++) {
      const move = this.history[i];
      const from = LOAGame.coordsToAlgebraic(move.from.r, move.from.c);
      const to = LOAGame.coordsToAlgebraic(move.to.r, move.to.c);
      moves.push(`${from}-${to}`);
    }

    // Group moves by move number (each move number has one move in LOA)
    let moveText = '';
    for (let i = 0; i < moves.length; i++) {
      if (i > 0) moveText += ' ';
      moveText += `${i + 1}. ${moves[i]}`;
    }

    pgn += moveText;
    if (this.winner) {
      pgn += ` ${this.winner === Piece.WHITE ? '1-0' : '0-1'}`;
    } else {
      pgn += ' *';
    }

    return pgn;
  }

  // Load game state from PGN-like format
  loadFromPGN(pgnString) {
    try {
      // Reset game
      this.board = this.createBoard();
      this.turn = Piece.BLACK;
      this.winner = null;
      this.history = [];

      // Parse PGN
      const lines = pgnString.split('\n').map(l => l.trim()).filter(l => l);
      
      // Skip header lines (lines starting with [)
      let moveLine = '';
      for (const line of lines) {
        if (!line.startsWith('[')) {
          moveLine = line;
          break;
        }
      }

      if (!moveLine || moveLine.trim() === '') {
        // Empty game, already initialized
        return true;
      }

      // Parse moves: "1. a1-c1 2. h1-h3" format
      const movePattern = /(\d+)\.\s*([a-h][1-8])-([a-h][1-8])/g;
      let match;
      const moves = [];
      
      while ((match = movePattern.exec(moveLine)) !== null) {
        const from = match[2];
        const to = match[3];
        moves.push({ from, to });
      }

      // Replay moves
      for (const move of moves) {
        const fromCoords = LOAGame.algebraicToCoords(move.from);
        const toCoords = LOAGame.algebraicToCoords(move.to);
        
        if (!fromCoords || !toCoords) {
          throw new Error(`Invalid move coordinates: ${move.from}-${move.to}`);
        }

        const success = this.move(fromCoords.row, fromCoords.col, toCoords.row, toCoords.col);
        if (!success) {
          throw new Error(`Invalid move in PGN: ${move.from}-${move.to}`);
        }
      }

      return true;
    } catch (error) {
      console.error('Error loading PGN:', error);
      return false;
    }
  }

  // Get all legal moves for current player
  getAllLegalMoves() {
    const moves = [];
    for (let fromRow = 0; fromRow < 8; fromRow++) {
      for (let fromCol = 0; fromCol < 8; fromCol++) {
        const piece = this.getPiece(fromRow, fromCol);
        if (!piece || piece.color !== this.turn) continue;

        // Check all possible destinations
        for (let toRow = 0; toRow < 8; toRow++) {
          for (let toCol = 0; toCol < 8; toCol++) {
            if (this.isValidMove(fromRow, fromCol, toRow, toCol)) {
              const from = LOAGame.coordsToAlgebraic(fromRow, fromCol);
              const to = LOAGame.coordsToAlgebraic(toRow, toCol);
              moves.push({ from, to, fromRow, fromCol, toRow, toCol });
            }
          }
        }
      }
    }
    return moves;
  }
}

module.exports = { LOAGame, Piece };

