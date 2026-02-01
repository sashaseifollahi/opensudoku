import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { validateApiKey } from '@/lib/auth';
import { PuzzleGenerator, Difficulty } from '@/lib/game';

type GameMode = 'ranked' | 'pot' | 'tournament' | 'casual';

interface PlayRequest {
  difficulty?: Difficulty;
  mode?: GameMode;
  wagerUsdc?: number;
  tournamentId?: string;
}

// POST /api/agent/play - Find a match for an agent
// Supports multiple game modes: ranked, pot (wagered), tournament, casual
export async function POST(request: NextRequest) {
  try {
    const agent = await validateApiKey(request);

    if (!agent) {
      return NextResponse.json(
        { error: 'Invalid or missing API key. Use Authorization: Bearer <api_key>' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({})) as PlayRequest;
    const {
      difficulty = 'medium',
      mode = 'ranked',
      wagerUsdc = 0,
      tournamentId,
    } = body;

    // Validate difficulty
    if (!['easy', 'medium', 'hard', 'expert'].includes(difficulty)) {
      return NextResponse.json(
        { error: 'Invalid difficulty. Must be: easy, medium, hard, or expert' },
        { status: 400 }
      );
    }

    // Validate mode
    if (!['ranked', 'pot', 'tournament', 'casual'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Must be: ranked, pot, tournament, or casual' },
        { status: 400 }
      );
    }

    // Mode-specific validation
    if (mode === 'pot') {
      // Pot mode requires a wager
      if (wagerUsdc <= 0) {
        return NextResponse.json(
          { error: 'Pot mode requires a wager. Set wagerUsdc > 0' },
          { status: 400 }
        );
      }
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
          { error: 'Wallet not found. Deposit USDC first.' },
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

    if (mode === 'tournament') {
      if (!tournamentId) {
        return NextResponse.json(
          { error: 'Tournament mode requires tournamentId' },
          { status: 400 }
        );
      }
      // TODO: Validate tournament state and participation
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
        mode: existingGame.gameMode,
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

    // Get active season for ranked games
    let seasonId: string | null = null;
    if (mode === 'ranked') {
      const activeSeason = await db.getActiveSeason();
      if (activeSeason) {
        seasonId = activeSeason.id;
        // Ensure agent has a season entry
        await db.getOrCreateSeasonEntry(seasonId, agent.id);
      }
    }

    // Look for waiting games to join (match by difficulty, mode, and wager amount)
    const waitingGames = await db.getWaitingGames(difficulty);
    const gameToJoin = waitingGames.find(g =>
      g.player1Id !== agent.id &&
      g.gameMode === mode &&
      g.wagerAmountUsdc === wagerUsdc // Match exact wager amount for pot mode
    );

    if (gameToJoin) {
      // Join existing game
      let updatedGame;
      if (mode === 'pot') {
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
          mode,
          state: 'countdown',
          wager: mode === 'pot' ? {
            amount: wagerUsdc,
            potentialWin: wagerUsdc * 2 * (1 - db.WAGER_CONFIG.houseRakePercent / 100),
            rake: db.WAGER_CONFIG.houseRakePercent,
          } : null,
          season: seasonId ? { id: seasonId } : null,
          opponent: opponent ? { id: opponent.id, name: opponent.name, elo: opponent.eloRating } : null,
        });
      }
    }

    // Create new game and wait for opponent
    const { puzzle, solution } = PuzzleGenerator.generate(difficulty);

    let newGame;
    if (mode === 'pot') {
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

    // Update game mode if not default
    if (mode !== 'ranked' || seasonId) {
      await db.db.execute({
        sql: `UPDATE games SET game_mode = ?, season_id = ?, tournament_id = ? WHERE id = ?`,
        args: [mode, seasonId, tournamentId || null, newGame.id],
      });
    }

    return NextResponse.json({
      status: 'waiting',
      gameId: newGame.id,
      mode,
      wager: mode === 'pot' ? {
        amount: wagerUsdc,
        locked: true,
        potentialWin: wagerUsdc * 2 * (1 - db.WAGER_CONFIG.houseRakePercent / 100),
        rake: db.WAGER_CONFIG.houseRakePercent,
      } : null,
      season: seasonId ? { id: seasonId } : null,
      message: `Waiting for opponent (${mode} mode). Poll /api/agent/game/{gameId} to check status.`,
    });
  } catch (error) {
    console.error('Agent play error:', error);
    return NextResponse.json(
      { error: 'Failed to find match' },
      { status: 500 }
    );
  }
}

// GET /api/agent/play - Get available game modes and current status
export async function GET(request: NextRequest) {
  try {
    const agent = await validateApiKey(request);

    if (!agent) {
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }

    // Get wallet info
    const wallet = await db.getWalletByAgentId(agent.id);
    const availableBalance = wallet ? wallet.balanceUsdc - wallet.lockedUsdc : 0;

    // Get active season
    const activeSeason = await db.getActiveSeason();
    let seasonEntry = null;
    if (activeSeason) {
      seasonEntry = await db.getOrCreateSeasonEntry(activeSeason.id, agent.id);
    }

    // Get active tournaments
    const tournaments = await db.getActiveTournaments();

    // Check for active game
    const activeGames = await db.getActiveGames();
    const currentGame = activeGames.find(
      g => g.player1Id === agent.id || g.player2Id === agent.id
    );

    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        elo: agent.eloRating,
      },
      wallet: wallet ? {
        balance: wallet.balanceUsdc,
        available: availableBalance,
        locked: wallet.lockedUsdc,
      } : null,
      modes: {
        ranked: {
          available: true,
          description: 'Free competitive play, affects ELO',
          season: activeSeason ? {
            id: activeSeason.id,
            name: activeSeason.name,
            rewardPool: activeSeason.rewardPoolUsdc,
            endsAt: activeSeason.endsAt,
            yourStats: seasonEntry ? {
              gamesPlayed: seasonEntry.gamesPlayed,
              wins: seasonEntry.wins,
              losses: seasonEntry.losses,
              eloCurrent: seasonEntry.eloCurrent,
              minGamesForRewards: activeSeason.minGamesRequired,
              qualified: seasonEntry.gamesPlayed >= activeSeason.minGamesRequired,
            } : null,
          } : null,
        },
        pot: {
          available: availableBalance >= db.WAGER_CONFIG.minWagerUsdc,
          description: 'Winner takes all, USDC wager required',
          minWager: db.WAGER_CONFIG.minWagerUsdc,
          maxWager: Math.min(db.WAGER_CONFIG.maxWagerUsdc, availableBalance),
          rake: db.WAGER_CONFIG.houseRakePercent,
        },
        tournament: {
          available: tournaments.length > 0,
          description: 'Entry fee, compete for prize pool',
          activeTournaments: tournaments.map(t => ({
            id: t.id,
            name: t.name,
            entryFee: t.entryFeeUsdc,
            prizePool: t.prizePoolUsdc,
            participants: `${t.currentParticipants}/${t.maxParticipants}`,
            startsAt: t.startsAt,
          })),
        },
        casual: {
          available: true,
          description: 'Practice mode, no ELO changes',
        },
      },
      currentGame: currentGame ? {
        gameId: currentGame.id,
        mode: currentGame.gameMode,
        state: currentGame.state,
      } : null,
    });
  } catch (error) {
    console.error('Play info error:', error);
    return NextResponse.json(
      { error: 'Failed to get play info' },
      { status: 500 }
    );
  }
}
