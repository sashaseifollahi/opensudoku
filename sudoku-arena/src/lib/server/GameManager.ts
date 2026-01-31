import { RaceGame, RaceConfig, Player, RaceEvent } from '../game';
import { v4 as uuidv4 } from 'uuid';

export interface MatchmakingRequest {
  playerId: string;
  playerName: string;
  playerType: 'human' | 'agent';
  difficulty?: RaceConfig['difficulty'];
}

export interface LobbyGame {
  game: RaceGame;
  createdAt: number;
  hostId: string;
}

/**
 * Manages active games and matchmaking.
 */
export class GameManager {
  private games: Map<string, RaceGame> = new Map();
  private playerGames: Map<string, string> = new Map(); // playerId -> gameId
  private waitingPlayers: Map<string, MatchmakingRequest> = new Map();
  private lobbyGames: Map<string, LobbyGame> = new Map();

  createGame(config?: Partial<RaceConfig>): RaceGame {
    const gameId = uuidv4();
    const game = new RaceGame(gameId, config);
    this.games.set(gameId, game);
    return game;
  }

  getGame(gameId: string): RaceGame | undefined {
    return this.games.get(gameId);
  }

  getPlayerGame(playerId: string): RaceGame | undefined {
    const gameId = this.playerGames.get(playerId);
    if (gameId) {
      return this.games.get(gameId);
    }
    return undefined;
  }

  joinGame(gameId: string, player: Player): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    if (game.joinPlayer(player)) {
      this.playerGames.set(player.id, gameId);
      return true;
    }
    return false;
  }

  leaveGame(playerId: string): boolean {
    const gameId = this.playerGames.get(playerId);
    if (!gameId) return false;

    const game = this.games.get(gameId);
    if (game) {
      game.leavePlayer(playerId);
    }

    this.playerGames.delete(playerId);
    return true;
  }

  findMatch(request: MatchmakingRequest): RaceGame | null {
    // Check if there's a waiting player with compatible settings
    for (const [waitingPlayerId, waitingRequest] of this.waitingPlayers) {
      if (waitingPlayerId === request.playerId) continue;

      // Match by difficulty (or any if not specified)
      const difficultyMatch =
        !request.difficulty ||
        !waitingRequest.difficulty ||
        request.difficulty === waitingRequest.difficulty;

      if (difficultyMatch) {
        // Found a match - create game
        const difficulty = request.difficulty || waitingRequest.difficulty || 'medium';
        const game = this.createGame({ difficulty });

        // Add both players
        const waitingPlayer: Player = {
          id: waitingRequest.playerId,
          name: waitingRequest.playerName,
          type: waitingRequest.playerType,
          connected: true,
        };
        const newPlayer: Player = {
          id: request.playerId,
          name: request.playerName,
          type: request.playerType,
          connected: true,
        };

        game.joinPlayer(waitingPlayer);
        game.joinPlayer(newPlayer);

        this.playerGames.set(waitingPlayer.id, game.getId());
        this.playerGames.set(newPlayer.id, game.getId());

        // Remove from waiting
        this.waitingPlayers.delete(waitingPlayerId);

        return game;
      }
    }

    // No match found - add to waiting list
    this.waitingPlayers.set(request.playerId, request);
    return null;
  }

  cancelMatchmaking(playerId: string): boolean {
    return this.waitingPlayers.delete(playerId);
  }

  createLobbyGame(hostId: string, hostName: string, config?: Partial<RaceConfig>): RaceGame {
    const game = this.createGame(config);

    const host: Player = {
      id: hostId,
      name: hostName,
      type: 'human',
      connected: true,
    };
    game.joinPlayer(host);
    this.playerGames.set(hostId, game.getId());

    this.lobbyGames.set(game.getId(), {
      game,
      createdAt: Date.now(),
      hostId,
    });

    return game;
  }

  getLobbyGames(): LobbyGame[] {
    return Array.from(this.lobbyGames.values()).filter(
      lobby => lobby.game.getState() === 'waiting'
    );
  }

  cleanupFinishedGames(): number {
    let cleaned = 0;
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes

    for (const [gameId, game] of this.games) {
      if (game.getState() === 'finished') {
        const result = game.getResult();
        if (result && now - result.finishedAt > maxAge) {
          this.games.delete(gameId);
          this.lobbyGames.delete(gameId);
          cleaned++;
        }
      }
    }

    return cleaned;
  }

  getStats() {
    return {
      activeGames: this.games.size,
      waitingPlayers: this.waitingPlayers.size,
      lobbyGames: this.lobbyGames.size,
    };
  }
}

// Singleton instance
export const gameManager = new GameManager();
