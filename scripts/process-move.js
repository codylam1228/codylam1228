// Process LOA move from GitHub Issue
const fs = require('fs');
const path = require('path');
const { LOAGame, Piece } = require('./loa-game.js');
const { generateREADME } = require('./generate-readme.js');

const REPO = process.env.REPOSITORY;
const ISSUE_NUMBER = process.env.EVENT_ISSUE_NUMBER;
const USER_LOGIN = process.env.EVENT_USER_LOGIN;
const ISSUE_TITLE = process.env.ISSUE_TITLE;

const GAME_DATA_PATH = path.join(__dirname, '..', 'loa_games', 'loa.pgn');
const LAST_MOVER_PATH = path.join(__dirname, '..', 'loa_games', 'last_mover.txt');
const RECENT_MOVES_PATH = path.join(__dirname, '..', 'loa_games', 'recent_moves.txt');

function errorExit(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function parseIssueTitle(title) {
  // Format: loa|move|<from><to>|<game_number>
  const parts = title.split('|');
  if (parts.length !== 4 || parts[0] !== 'loa') {
    throw new Error('Invalid issue title format. Expected: loa|move|<from><to>|<game_number>');
  }

  const cmd = parts[1];
  const moveStr = parts[2];
  const gameNum = parts[3];

  if (cmd !== 'move') {
    throw new Error('Only "move" command is supported');
  }

  if (moveStr.length !== 4) {
    throw new Error('Move must be 4 characters (e.g., "a1c1")');
  }

  const from = moveStr.substring(0, 2);
  const to = moveStr.substring(2, 4);

  const fromCoords = LOAGame.algebraicToCoords(from);
  const toCoords = LOAGame.algebraicToCoords(to);

  if (!fromCoords || !toCoords) {
    throw new Error(`Invalid coordinates: ${from}-${to}`);
  }

  return {
    cmd,
    from,
    to,
    fromCoords,
    toCoords,
    gameNum
  };
}

function checkLastMover() {
  try {
    if (fs.existsSync(LAST_MOVER_PATH)) {
      const lastMover = fs.readFileSync(LAST_MOVER_PATH, 'utf8').trim();
      if (lastMover === USER_LOGIN) {
        throw new Error('Slow down! You just moved, so you can\'t immediately take the next turn.');
      }
    }
  } catch (error) {
    if (error.message.includes('Slow down')) {
      throw error;
    }
    // If file doesn't exist or other error, allow play to continue
  }
}

function loadGame() {
  const game = new LOAGame();
  
  try {
    if (fs.existsSync(GAME_DATA_PATH)) {
      const pgnContent = fs.readFileSync(GAME_DATA_PATH, 'utf8');
      if (pgnContent.trim()) {
        if (!game.loadFromPGN(pgnContent)) {
          throw new Error('Failed to load game state from PGN file');
        }
      }
    }
  } catch (error) {
    throw new Error(`Could not load game state: ${error.message}`);
  }

  return game;
}

function saveGame(game) {
  try {
    const pgn = game.exportToPGN();
    fs.writeFileSync(GAME_DATA_PATH, pgn, 'utf8');
  } catch (error) {
    throw new Error(`Could not save game state: ${error.message}`);
  }
}

function updateLastMover() {
  try {
    fs.writeFileSync(LAST_MOVER_PATH, USER_LOGIN, 'utf8');
  } catch (error) {
    console.error('Warning: Could not update last mover file:', error.message);
  }
}

function updateRecentMoves(from, to) {
  try {
    const newMove = `| ${from.toUpperCase()} to ${to.toUpperCase()} | [@${USER_LOGIN}](https://github.com/${USER_LOGIN}) |`;
    
    let existingMoves = [];
    if (fs.existsSync(RECENT_MOVES_PATH)) {
      const content = fs.readFileSync(RECENT_MOVES_PATH, 'utf8').trim();
      if (content) {
        existingMoves = content.split('\n').filter(line => line.trim());
      }
    }

    // Prepend new move, keep only last 5
    const updatedMoves = [newMove, ...existingMoves].slice(0, 5);
    fs.writeFileSync(RECENT_MOVES_PATH, updatedMoves.join('\n') + '\n', 'utf8');
  } catch (error) {
    console.error('Warning: Could not update recent moves:', error.message);
  }
}

function generateAndSaveREADME(game) {
  try {
    const readme = generateREADME(game);
    const readmePath = path.join(__dirname, '..', 'README.md');
    fs.writeFileSync(readmePath, readme, 'utf8');
  } catch (error) {
    throw new Error(`Could not generate README: ${error.message}`);
  }
}

function processMove() {
  try {
    // Parse issue title
    const moveInfo = parseIssueTitle(ISSUE_TITLE);

    // Check if same user made last move
    checkLastMover();

    // Load game state
    const game = loadGame();

    // Check if game is over
    if (game.winner) {
      throw new Error('Game is already over. Cannot make more moves.');
    }

    // Validate move
    const isValid = game.isValidMove(
      moveInfo.fromCoords.row,
      moveInfo.fromCoords.col,
      moveInfo.toCoords.row,
      moveInfo.toCoords.col
    );

    if (!isValid) {
      throw new Error(`Invalid move: ${moveInfo.from} to ${moveInfo.to} is not a legal move.`);
    }

    // Execute move
    const moveSuccess = game.move(
      moveInfo.fromCoords.row,
      moveInfo.fromCoords.col,
      moveInfo.toCoords.row,
      moveInfo.toCoords.col
    );

    if (!moveSuccess) {
      throw new Error(`Move failed: ${moveInfo.from} to ${moveInfo.to}`);
    }

    // Save game state
    saveGame(game);

    // Update tracking files
    updateLastMover();
    updateRecentMoves(moveInfo.from, moveInfo.to);

    // Generate and save README
    generateAndSaveREADME(game);

    // Output success message for GitHub Actions (must start with SUCCESS: or ERROR:)
    let successMsg = `Move ${moveInfo.from} to ${moveInfo.to} executed successfully.`;
    if (game.winner) {
      const winner = game.winner === Piece.BLACK ? 'Black' : 'White';
      successMsg += ` Game over! ${winner} wins!`;
    }
    console.log(`SUCCESS: ${successMsg}`);

    return {
      success: true,
      message: successMsg,
      gameOver: !!game.winner
    };
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    return {
      success: false,
      message: error.message
    };
  }
}

// Main execution
if (require.main === module) {
  if (!REPO || !ISSUE_NUMBER || !USER_LOGIN || !ISSUE_TITLE) {
    errorExit('Missing required environment variables: REPOSITORY, EVENT_ISSUE_NUMBER, EVENT_USER_LOGIN, ISSUE_TITLE');
  }

  const result = processMove();
  
  // Messages are already logged in processMove() with SUCCESS:/ERROR: prefixes
  process.exit(result.success ? 0 : 1);
}

module.exports = { processMove, parseIssueTitle };

