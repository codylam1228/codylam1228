// Generate README.md for LOA game
const fs = require('fs');
const path = require('path');
const { LOAGame, Piece } = require('./loa-game.js');

const REPO = process.env.REPOSITORY || 'codylam1228/codylam1228';
const GAME_NUM = process.env.GAME_NUM || '1';

function generateBoard(game) {
  const BLACK_PIECE = '●';
  const WHITE_PIECE = '○';
  const EMPTY = ' ';

  let board = '|   | A | B | C | D | E | F | G | H |\n';
  board += '| - | - | - | - | - | - | - | - | - |\n';

  // Board mapping: row 0 (top in array) displays as row 1, row 7 (bottom in array) displays as row 8
  // Iterate from 1 to 8 to show row 1 at top, row 8 at bottom
  for (let displayRow = 1; displayRow <= 8; displayRow++) {
    const actualRow = 8 - displayRow; // Convert display row (1-8) to array row (7-0)
    board += `| ${displayRow} |`;

    for (let col = 0; col < 8; col++) {
      const piece = game.getPiece(actualRow, col);
      let symbol = EMPTY;
      if (piece) {
        symbol = piece.color === Piece.BLACK ? BLACK_PIECE : WHITE_PIECE;
      }
      board += ` ${symbol} |`;
    }

    board += '\n';
  }

  return board;
}

function generateMoveLinks(game, legalMoves) {
  // Group moves by FROM square
  const movesByFrom = {};
  for (const move of legalMoves) {
    if (!movesByFrom[move.from]) {
      movesByFrom[move.from] = [];
    }
    movesByFrom[move.from].push(move.to);
  }

  let links = '';
  links += '#### **' + (game.turn === Piece.BLACK ? 'BLACK' : 'WHITE') + ':** It\'s your move... to choose _where_ to move...\n\n';
  links += '| FROM | TO - _just click one of the links_ :) |\n';
  links += '| ---- | -- |\n';

  const sortedFroms = Object.keys(movesByFrom).sort();
  for (const from of sortedFroms) {
    const tos = movesByFrom[from].sort();
    const linkList = tos.map(to => {
      const url = `https://github.com/${REPO}/issues/new?title=loa%7Cmove%7C${from}${to}%7C${GAME_NUM}&body=Just+push+%27Submit+new+issue%27.+You+don%27t+need+to+do+anything+else.`;
      return `[${to.toUpperCase()}](${url})`;
    }).join(' , ');
    links += `| **${from.toUpperCase()}** | ${linkList} |\n`;
  }

  return links;
}

function getRecentMoves() {
  const recentMovesFile = path.join(__dirname, '..', 'loa_games', 'recent_moves.txt');
  try {
    if (fs.existsSync(recentMovesFile)) {
      const content = fs.readFileSync(recentMovesFile, 'utf8').trim();
      if (content) {
        return content.split('\n').filter(line => line.trim());
      }
    }
  } catch (error) {
    console.error('Error reading recent moves:', error);
  }
  return [];
}

function generateREADME(game) {
  let readme = '## Lines of Action - Community Game\n\n';

  // Game status
  if (game.winner) {
    const winnerName = game.winner === Piece.BLACK ? 'Black' : 'White';
    readme += `**Game won by ${winnerName}!** `;
    readme += 'This is open to ANYONE to play. That\'s the point. 👋\n\n';
  } else {
    const currentPlayer = game.turn === Piece.BLACK ? '●' : '○';
    readme += `**Game is in progress.** This is open to ANYONE to play the next move. That's the point. 👋 It's your turn! Move a ${currentPlayer} piece.\n\n`;
  }

  // Board
  readme += generateBoard(game);
  readme += '\n';

  // Move links or game over
  if (game.winner) {
    readme += '## Play again?\n\n';
    const newGameUrl = `https://github.com/${REPO}/issues/new?title=loa%7Cnew&body=Just+push+%27Submit+new+issue%27.+You+don%27t+need+to+do+anything+else.`;
    readme += `[Start a new game](${newGameUrl})\n\n`;
  } else {
    const legalMoves = game.getAllLegalMoves();
    if (legalMoves.length > 0) {
      readme += generateMoveLinks(game, legalMoves);
      readme += '\n';
    }
  }

  // Recent moves
  const recentMoves = getRecentMoves();
  readme += '**Last few moves, this game**\n\n';
  readme += '| Move  | Who |\n';
  readme += '| ----- | --- |\n';
  
  if (recentMoves.length > 0) {
    for (const move of recentMoves.slice(0, 5)) {
      readme += move + '\n';
    }
  } else {
    readme += '| ¯\\_(ツ)_/¯ | No moves yet. |\n';
  }

  readme += '\n';

  // How it works
  readme += '**How this works**\n\n';
  readme += 'When you click a link, it opens a GitHub Issue with the required pre-populated text. ';
  readme += 'Just push "Create New Issue". That will trigger a [GitHub Actions](https://github.blog/2020-07-03-github-action-hero-casey-lee/#getting-started-with-github-actions) ';
  readme += 'workflow that\'ll update this README.md with the new state of the board.\n\n';

  readme += '**Notice a problem?**\n\n';
  readme += `Raise an [issue](https://github.com/${REPO}/issues), and include the text _cc @codylam1228_.\n`;

  return readme;
}

// Main execution
if (require.main === module) {
  const pgnPath = path.join(__dirname, '..', 'loa_games', 'loa.pgn');
  const readmePath = path.join(__dirname, '..', 'README.md');

  try {
    const pgnContent = fs.readFileSync(pgnPath, 'utf8');
    const game = new LOAGame();
    
    if (!game.loadFromPGN(pgnContent)) {
      console.error('Failed to load game from PGN');
      process.exit(1);
    }

    const readme = generateREADME(game);
    fs.writeFileSync(readmePath, readme, 'utf8');
    console.log('README.md generated successfully');
  } catch (error) {
    console.error('Error generating README:', error);
    process.exit(1);
  }
}

module.exports = { generateREADME, generateBoard, generateMoveLinks };

