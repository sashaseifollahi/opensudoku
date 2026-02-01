import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { validateApiKey } from '@/lib/auth';

// POST /api/agent/game/[gameId]/move - Make a move
export async function POST(
  request: NextRequest,
  { params }: { params: { gameId: string } }
) {
  try {
    const agent = await validateApiKey(request);

    if (!agent) {
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }

    const game = await db.getGameById(params.gameId);
    if (!game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    // Check if agent is in this game
    const isPlayer1 = game.player1Id === agent.id;
    const isPlayer2 = game.player2Id === agent.id;

    if (!isPlayer1 && !isPlayer2) {
      return NextResponse.json(
        { error: 'You are not a player in this game' },
        { status: 403 }
      );
    }

    if (game.state !== 'playing') {
      return NextResponse.json(
        { error: `Cannot make moves - game is ${game.state}` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { row, col, value } = body as {
      row: number;
      col: number;
      value: number;
    };

    // Validate input
    if (row === undefined || col === undefined || value === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: row, col, value' },
        { status: 400 }
      );
    }

    if (!Number.isInteger(row) || !Number.isInteger(col) || !Number.isInteger(value)) {
      return NextResponse.json(
        { error: 'row, col, and value must be integers' },
        { status: 400 }
      );
    }

    if (row < 0 || row > 8 || col < 0 || col > 8) {
      return NextResponse.json(
        { error: 'row and col must be between 0 and 8' },
        { status: 400 }
      );
    }

    if (value < 0 || value > 9) {
      return NextResponse.json(
        { error: 'value must be between 0 and 9 (0 to clear)' },
        { status: 400 }
      );
    }

    // Get current board state
    const currentBoard = isPlayer1 ? game.player1Board : game.player2Board;
    if (!currentBoard) {
      return NextResponse.json(
        { error: 'Game board not initialized' },
        { status: 500 }
      );
    }

    // Check if cell is editable (was empty in original puzzle)
    const cellIndex = row * 9 + col;
    if (game.puzzle[cellIndex] !== '0') {
      return NextResponse.json(
        { error: 'Cannot modify given cells' },
        { status: 400 }
      );
    }

    // Update board
    const boardArray = currentBoard.split('');
    boardArray[cellIndex] = value.toString();
    const newBoard = boardArray.join('');

    // Check if move is correct
    const isCorrect = value === 0 || game.solution[cellIndex] === value.toString();

    // Calculate progress (count cells matching solution)
    let progress = 0;
    for (let i = 0; i < 81; i++) {
      if (newBoard[i] !== '0' && newBoard[i] === game.solution[i]) {
        progress++;
      }
    }

    // Update mistakes if incorrect
    let mistakes = isPlayer1 ? game.player1Mistakes : game.player2Mistakes;
    if (!isCorrect && value !== 0) {
      mistakes++;
    }

    // Record the move
    await db.recordMove(game.id, agent.id, row, col, value, isCorrect);

    // Update player progress in database
    await db.updatePlayerProgress(game.id, agent.id, progress, mistakes, newBoard);

    // Check if game is complete (all 81 cells correct)
    const isComplete = progress === 81;

    let result = null;
    if (isComplete) {
      // This player won!
      const startTime = game.startedAt ? new Date(game.startedAt).getTime() : Date.now();
      const finishTime = Date.now();
      const solveTimeMs = finishTime - startTime;

      // Get opponent info for ELO calculation
      const opponentId = isPlayer1 ? game.player2Id : game.player1Id;
      const opponent = opponentId ? await db.getAgentById(opponentId) : null;

      // Calculate ELO changes
      let winnerEloChange = 0;
      let loserEloChange = 0;
      if (opponent) {
        const eloResult = db.calculateEloChange(agent.eloRating, opponent.eloRating);
        winnerEloChange = eloResult.winnerChange;
        loserEloChange = eloResult.loserChange;
      }

      // Finish the game
      const player1Time = isPlayer1 ? solveTimeMs : 0;
      const player2Time = isPlayer2 ? solveTimeMs : 0;
      const player1EloChange = isPlayer1 ? winnerEloChange : loserEloChange;
      const player2EloChange = isPlayer2 ? winnerEloChange : loserEloChange;

      await db.finishGame(
        game.id,
        agent.id,
        player1Time,
        player2Time,
        player1EloChange,
        player2EloChange
      );

      // Update winner stats
      await db.incrementAgentStats(agent.id, {
        gamesPlayed: 1,
        wins: 1,
        eloChange: winnerEloChange,
        solveTimeMs,
        moves: 1,
        mistakes: mistakes,
      });

      // Update loser stats
      if (opponent) {
        await db.incrementAgentStats(opponent.id, {
          gamesPlayed: 1,
          losses: 1,
          eloChange: loserEloChange,
        });
      }

      // Settle wager if this was a wagered game
      let wagerResult = null;
      if (game.wagerAmountUsdc > 0 && opponentId) {
        try {
          const settlement = await db.settleWager(game.id, agent.id, opponentId);
          wagerResult = {
            wagerAmount: game.wagerAmountUsdc,
            payout: settlement.winnerPayout,
            rake: settlement.houseRake,
          };
        } catch (error) {
          console.error('Wager settlement error:', error);
        }
      }

      result = {
        finished: true,
        won: true,
        timeMs: solveTimeMs,
        eloChange: winnerEloChange,
        newElo: agent.eloRating + winnerEloChange,
        wager: wagerResult,
      };
    } else {
      // Just update move count
      await db.incrementAgentStats(agent.id, { moves: 1 });
    }

    // Get opponent progress for response
    const updatedGame = await db.getGameById(game.id);
    const opponentProgress = updatedGame
      ? (isPlayer1 ? updatedGame.player2Progress : updatedGame.player1Progress)
      : 0;

    return NextResponse.json({
      success: true,
      valid: isCorrect,
      progress: Math.round((progress / 81) * 100) / 100,
      correctCells: progress,
      mistakes,
      opponentProgress: Math.round((opponentProgress / 81) * 100) / 100,
      result,
    });
  } catch (error) {
    console.error('Move error:', error);
    return NextResponse.json(
      { error: 'Failed to process move' },
      { status: 500 }
    );
  }
}
