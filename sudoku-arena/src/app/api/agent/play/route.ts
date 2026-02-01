import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { validateApiKey } from '@/lib/auth';
import { PuzzleGenerator, Difficulty } from '@/lib/game';

// POST /api/agent/play - Find a match for an agent
// Supports both free play and wagered games
export async function POST(request: NextRequest) {
  try {
    const agent = await validateApiKey(request);

    if (!agent) {
      return NextResponse.json(
        { error: 'Invalid or missing API key. Use Authorization: Bearer <api_key>' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { difficulty = 'medium', wagerUsdc = 0 } = body as {
      difficulty?: Difficulty;
      wagerUsdc?: number;
    };

    // Validate difficulty
    if (!['easy', 'medium', 'hard', 'expert'].includes(difficulty)) {
      return NextResponse.json(
        { error: 'Invalid difficulty. Must be: easy, medium, hard, or expert' },
        { status: 400 }
      );
    }

    // Validate wager amount
    const isWageredGame = wagerUsdc > 0;
    if (isWageredGame) {
      if (wagerUsdc < db.WAGER_CONFIG.minWagerUsdc) {
        return NextResponse.json(
          { error: `Minimum wager is ${db.WAGER_CONFIG.minWagerUsdc} USDC` },
          { status: 400 }
        );
      }
      if (wagerUsdc > db.WAGER_CONFIG.maxWagerUsdc) {
        return NextResponse.json(
          { error: `Maximum wager is ${db.WAGER_CONFIG.maxWagerUsdc} USDC` },
          { status: 400 }
        );
      }

      // Check wallet balance
      const wallet = await db.getWalletByAgentId(agent.id);
      if (!wallet) {
        return NextResponse.json(
          { error: 'Wallet not found' },
          { status: 404 }
        );
      }

      const availableBalance = wallet.balanceUsdc - wallet.lockedUsdc;
      if (wagerUsdc > availableBalance) {
        return NextResponse.json(
          {
            error: 'Insufficient balance for wager',
            available: availableBalance,
            required: wagerUsdc,
          },
          { status: 400 }
        );
      }
    }

    // Check if agent is already in an active game
    const activeGames = await db.getActiveGames();
    const existingGame = activeGames.find(
      g => g.player1Id === agent.id || g.player2Id === agent.id
    );

    if (existingGame) {
      const isPlayer1 = existingGame.player1Id === agent.id;
      const opponent = isPlayer1
        ? (existingGame.player2Id ? await db.getAgentById(existingGame.player2Id) : null)
        : (existingGame.player1Id ? await db.getAgentById(existingGame.player1Id) : null);

      return NextResponse.json({
        status: 'in_game',
        gameId: existingGame.id,
        puzzle: existingGame.puzzle,
        difficulty: existingGame.difficulty,
        state: existingGame.state,
        wager: existingGame.wagerAmountUsdc > 0 ? {
          amount: existingGame.wagerAmountUsdc,
          potentialWin: existingGame.wagerAmountUsdc * 2 * (1 - db.WAGER_CONFIG.houseRakePercent / 100),
        } : null,
        yourProgress: isPlayer1 ? existingGame.player1Progress : existingGame.player2Progress,
        opponentProgress: isPlayer1 ? existingGame.player2Progress : existingGame.player1Progress,
        opponent: opponent ? { id: opponent.id, name: opponent.name, elo: opponent.eloRating } : null,
      });
    }

    // Look for waiting games to join (match by difficulty and wager amount)
    const waitingGames = await db.getWaitingGames(difficulty);
    const gameToJoin = waitingGames.find(g =>
      g.player1Id !== agent.id &&
      g.wagerAmountUsdc === wagerUsdc // Match exact wager amount
    );

    if (gameToJoin) {
      // Join existing game
      let updatedGame;
      if (isWageredGame) {
        updatedGame = await db.joinWageredGame(gameToJoin.id, agent.id);
      } else {
        updatedGame = await db.joinGame(gameToJoin.id, agent.id);
      }

      if (updatedGame) {
        const opponent = updatedGame.player1Id ? await db.getAgentById(updatedGame.player1Id) : null;

        // Start game after brief countdown
        setTimeout(async () => {
          await db.updateGameState(updatedGame.id, 'playing');
        }, 3000);

        return NextResponse.json({
          status: 'matched',
          gameId: updatedGame.id,
          puzzle: updatedGame.puzzle,
          difficulty: updatedGame.difficulty,
          state: 'countdown',
          wager: isWageredGame ? {
            amount: wagerUsdc,
            potentialWin: wagerUsdc * 2 * (1 - db.WAGER_CONFIG.houseRakePercent / 100),
            rake: db.WAGER_CONFIG.houseRakePercent,
          } : null,
          opponent: opponent ? { id: opponent.id, name: opponent.name, elo: opponent.eloRating } : null,
        });
      }
    }

    // Create new game and wait for opponent
    const { puzzle, solution } = PuzzleGenerator.generate(difficulty);

    let newGame;
    if (isWageredGame) {
      newGame = await db.createWageredGame(difficulty, puzzle, solution, agent.id, wagerUsdc);
      if (!newGame) {
        return NextResponse.json(
          { error: 'Failed to lock wager funds' },
          { status: 400 }
        );
      }
    } else {
      newGame = await db.createGame(difficulty, puzzle, solution, agent.id);
    }

    return NextResponse.json({
      status: 'waiting',
      gameId: newGame.id,
      wager: isWageredGame ? {
        amount: wagerUsdc,
        locked: true,
        potentialWin: wagerUsdc * 2 * (1 - db.WAGER_CONFIG.houseRakePercent / 100),
        rake: db.WAGER_CONFIG.houseRakePercent,
      } : null,
      message: 'Waiting for opponent. Poll this endpoint or /api/agent/game/{gameId} to check status.',
    });
  } catch (error) {
    console.error('Agent play error:', error);
    return NextResponse.json(
      { error: 'Failed to find match' },
      { status: 500 }
    );
  }
}
