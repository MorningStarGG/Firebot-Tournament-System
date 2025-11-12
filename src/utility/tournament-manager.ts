import { ScriptModules } from '@crowbartools/firebot-custom-scripts-types';
import { emitTournamentEnd, emitTournamentStart, emitMatchUpdate } from '../events/tournament-events';
import { JsonDB } from 'node-json-db';
import {
    TournamentState,
    BackupTournament,
    Player,
    Match,
    ResetTournamentOptions
} from '../types/types';
import { webServer } from "../main";
import { logger } from "../logger";
import { buildTournamentOverlayConfig } from "./overlay-config";

class TournamentManager {
    private _db: JsonDB;
    private _tempResetStorage: Map<string, { data: TournamentState, timestamp: number }> = new Map();
    private readonly TEMP_STORAGE_DURATION = 30000; // 30 seconds retention

    constructor(path: string, modules: ScriptModules) {
        // @ts-ignore
        this._db = new modules.JsonDb(path, true, true);
    }

    private _resetLocks: Set<string> = new Set();

    /**
     * Resets a tournament with undo capability
     */
    async resetTournamentWithUndo(
        tournamentId: string,
        options?: ResetTournamentOptions
    ): Promise<void> {
        if (this._resetLocks.has(tournamentId)) {
            logger.warn(`Reset already in progress for tournament ${tournamentId}`);
            return;
        }

        this._resetLocks.add(tournamentId);

        try {
            const currentTournament = options?.snapshotOverride
                ? options.snapshotOverride
                : await this.getTournament(tournamentId);
            if (!currentTournament) {
                return;
            }

            this._tempResetStorage.set(tournamentId, {
                data: JSON.parse(JSON.stringify(currentTournament)),
                timestamp: Date.now()
            });

            setTimeout(() => {
                this._tempResetStorage.delete(tournamentId);
            }, this.TEMP_STORAGE_DURATION);

            this.cleanTempStorage();
            await this.resetTournament(tournamentId);
        } catch (error) {
            logger.error(`Error during tournament reset: ${error}`);
        } finally {
            this._resetLocks.delete(tournamentId);
        }
    }

    /**
     * Undoes a tournament reset
     */
    async undoReset(tournamentId: string): Promise<boolean> {
        if (this._resetLocks.has(tournamentId)) {
            logger.warn(`Reset operation in progress for tournament ${tournamentId}, cannot undo`);
            return false;
        }

        this._resetLocks.add(tournamentId);

        try {
            const storedData = this._tempResetStorage.get(tournamentId);
            if (!storedData) {
                return false;
            }

            await this.updateTournament(tournamentId, storedData.data);

            const overlayConfig = buildTournamentOverlayConfig(tournamentId, storedData.data);
            await webServer.sendToOverlay("tournament-updater", {
                type: 'update',
                overlayInstance: storedData.data.overlayInstance,
                config: overlayConfig
            });

            this._tempResetStorage.delete(tournamentId);

            return true;
        } catch (error) {
            logger.error(`Error during tournament reset undo: ${error}`);
            return false;
        } finally {
            this._resetLocks.delete(tournamentId);
        }
    }

    /**
     * Checks if a tournament reset can be undone
     */
    async canUndoReset(tournamentId: string): Promise<boolean> {
        const storedData = this._tempResetStorage.get(tournamentId);
        if (!storedData) return false;
        return (Date.now() - storedData.timestamp) < this.TEMP_STORAGE_DURATION;
    }

    /**
     * Cleans up temporary reset storage
     */
    private cleanTempStorage(): void {
        const now = Date.now();
        for (const [tournamentId, { timestamp }] of this._tempResetStorage) {
            if (now - timestamp > this.TEMP_STORAGE_DURATION) {
                this._tempResetStorage.delete(tournamentId);
            }
        }
    }

    /**
     * Gets a tournament by ID
     */
    async getTournament(tournamentId: string): Promise<TournamentState | undefined> {
        try {
            const data = await this._db.getData(`/tournaments/${tournamentId}`);
            return data as TournamentState;
        } catch {
            return undefined;
        }
    }

    /**
     * Checks if a tournament is active
     */
    async isTournamentActive(tournamentId: string): Promise<boolean> {
        const tournament = await this.getTournament(tournamentId);
        return !!tournament && !tournament.ended;
    }

    /**
     * Gets all active tournaments
     */
    async getActiveTournaments(): Promise<string[]> {
        try {
            const data = await this._db.getData('/tournaments');
            const activeTournaments = Object.entries(data)
                .filter(([_, tournament]) => {
                    const tournamentState = tournament as TournamentState;
                    return !tournamentState.ended;
                })
                .map(([tournamentId]) => tournamentId);
            return activeTournaments;
        } catch {
            return [];
        }
    }

    /**
     * Gets all ended tournaments
     */
    async getEndedTournaments(): Promise<string[]> {
        try {
            const data = await this._db.getData('/tournaments');
            const endedTournaments = Object.entries(data)
                .filter(([_, tournament]) => {
                    const tournamentState = tournament as TournamentState;
                    return tournamentState.ended;
                })
                .map(([tournamentId]) => tournamentId);
            return endedTournaments;
        } catch {
            return [];
        }
    }

    /**
     * Gets all tournaments with their status
     */
    async getAllTournamentsWithStatus(): Promise<Array<{ tournamentId: string, displayTitle: string, status: 'active' | 'ended' }>> {
        try {
            const data = await this._db.getData('/tournaments');
            return Object.entries(data).map(([tournamentId, tournament]) => ({
                tournamentId: tournamentId,
                displayTitle: (tournament as TournamentState).tournamentData.title,
                status: (tournament as TournamentState).ended ? 'ended' : 'active'
            }));
        } catch {
            return [];
        }
    }

    /**
     * Ends a tournament, with special handling for manual stops
     */
    async endTournament(tournamentId: string, eventManager: any, isManualStop: boolean = false): Promise<void> {
        logger.info(`endTournament called for: ${tournamentId} (isManualStop: ${isManualStop})`);

        const tournament = await this.getTournament(tournamentId);
        if (!tournament) return;

        tournament.ended = true;
        tournament.manuallyEnded = isManualStop;
        tournament.updatedAt = new Date().toISOString();

        logger.info(`Setting tournament ended to true (manuallyEnded: ${isManualStop})`);

        await this.updateTournament(tournamentId, tournament);

        if (tournament.tournamentData.settings.format === 'round-robin' && !tournament.tournamentData.winner && !isManualStop) {
            const winner = this.determineRoundRobinWinner(tournament);
            if (winner) {
                tournament.tournamentData.winner = winner;
                await this.updateTournament(tournamentId, tournament);
            }
        }

        if (tournament.tournamentData.winner) {
            logger.info(`Starting tournament end event emission for: ${tournamentId}`);

            emitTournamentEnd(eventManager, {
                tournamentId: tournamentId,
                tournamentTitle: tournament.tournamentData.title,
                winner: tournament.tournamentData.winner.name,
                matchesPlayed: tournament.tournamentData.completedMatches.length,
                duration: Math.floor((Date.now() - new Date(tournament.createdAt).getTime()) / 1000)
            }).catch(error => {
                logger.error('Error emitting tournament end event:', error);
            });
        }

        if (isManualStop) {
            logger.info(`Manual stop - removing tournament immediately`);
            await webServer.sendToOverlay("tournament-updater", {
                type: 'remove',
                config: {
                    tournamentTitle: tournamentId.replace('tournament_', '')
                }
            });
            return;
        }

        if (tournament.tournamentData.winner) {
            logger.info(`Sending final update to overlay with ended=true`);
            const overlayConfig = {
                ...buildTournamentOverlayConfig(tournamentId, tournament),
                ended: true
            };
            await webServer.sendToOverlay("tournament-updater", {
                type: 'update',
                overlayInstance: tournament.overlayInstance,
                config: overlayConfig
            });

            setTimeout(async () => {
                try {
                    await webServer.sendToOverlay("tournament-updater", {
                        type: 'remove',
                        config: {
                            tournamentTitle: tournamentId.replace('tournament_', '')
                        }
                    });
                } catch (error) {
                    console.error('Error removing tournament from overlay:', error);
                }
            }, (tournament.tournamentData.settings.displayDuration || 30) * 1000);
        } else {
            logger.info(`No winner - removing tournament immediately`);
            await webServer.sendToOverlay("tournament-updater", {
                type: 'remove',
                config: {
                    tournamentTitle: tournamentId.replace('tournament_', '')
                }
            });
        }
    }

    /**
     * Starts a tournament
     */
    async startTournament(tournamentId: string, eventManager: any) {
        const tournament = await this.getTournament(tournamentId);
        if (!tournament) return;

        tournament.ended = false;
        tournament.updatedAt = new Date().toISOString();
        await this.updateTournament(tournamentId, tournament);

        emitTournamentStart(eventManager, {
            tournamentId: tournamentId,
            tournamentTitle: tournament.tournamentData.title,
            players: tournament.tournamentData.players.map(player => player.name)
        });

        const overlayConfig = buildTournamentOverlayConfig(tournamentId, tournament);
        await webServer.sendToOverlay("tournament-updater", {
            type: 'update',
            overlayInstance: tournament.overlayInstance,
            config: overlayConfig
        });
    }

    /**
     * Sets a match winner
     */
    async setMatchWinner(
        tournamentId: string,
        matchId: string,
        playerNumber: number | string,
        eventManager: any,
        drawHandling: string = 'replay'
    ): Promise<void> {
        logger.info(`setMatchWinner called: tournamentId=${tournamentId}, matchId=${matchId}, playerNumber=${playerNumber}, drawHandling=${drawHandling}`);

        const tournament = await this.getTournament(tournamentId);
        if (!tournament) {
            logger.error(`Tournament not found: ${tournamentId}`);
            return;
        }

        const format = tournament.tournamentData.settings.format;

        const matchIndex = tournament.tournamentData.currentMatches.findIndex(m => m.id === matchId);
        if (matchIndex === -1) {
            logger.error(`Match not found in current matches: ${matchId}`);
            return;
        }

        const match = tournament.tournamentData.currentMatches[matchIndex];
        logger.info(`Found match: bracket=${match.bracket}, round=${match.round}, format=${format}`);

        let matchCompleted = false;
        let shouldAdvanceRound = false;

        if (playerNumber === 'draw') {
            await this.handleDrawResult(tournament, match, drawHandling, eventManager);

            if (drawHandling === 'replay') {
                if (format === 'round-robin') {
                    matchCompleted = false;
                    shouldAdvanceRound = false;
                }
            } else if (drawHandling === 'both-advance') {
                matchCompleted = true;
                shouldAdvanceRound = true;
            } else if (drawHandling === 'random') {
                matchCompleted = true;
                shouldAdvanceRound = true;

                if (format !== 'round-robin' && match.winner) {
                    const winner = match.winner;
                    const loser = winner === match.player1 ? match.player2 : match.player1;

                    winner.wins++;

                    if (match.bracket === 'final') {
                        this.handleFinalMatchResult(tournament, match, winner, loser);
                    } else {
                        if (match.bracket === 'winners') {
                            tournament.tournamentData.winnersPlayers.push(winner);
                        } else if (match.bracket === 'losers') {
                            tournament.tournamentData.losersPlayers.push(winner);
                        }

                        loser.losses++;

                        if (loser.losses >= 2) {
                            loser.eliminated = true;
                            tournament.tournamentData.eliminatedPlayers.push(loser);
                        } else {
                            if (match.bracket === 'winners') {
                                tournament.tournamentData.losersPlayers.push(loser);
                            }
                        }
                    }
                }
            }
        } else {
            const playerNum = Number(playerNumber);
            if (playerNum !== 1 && playerNum !== 2) {
                logger.error(`Invalid player number: ${playerNumber}`);
                return;
            }

            const winner = playerNum === 1 ? match.player1 : match.player2;
            const loser = playerNum === 1 ? match.player2 : match.player1;

            logger.info(`Selected winner: ${winner.name}, loser: ${loser.name}`);

            if (match.isDraw) {
                logger.info(`Clearing draw state for replayed match ${matchId}`);
                match.isDraw = false;
                delete match.resolvedRandomly;
            }

            match.winner = winner;
            matchCompleted = true;
            shouldAdvanceRound = true;

            if (format === 'single-elimination') {
                await this.handleSingleEliminationResult(tournament, match, winner, loser);
            } else if (format === 'round-robin') {
                winner.wins++;
                loser.losses++;
                logger.info(`Round-robin match: ${winner.name} defeats ${loser.name}, standings will be recalculated`);
            } else {
                winner.wins++;

                if (match.bracket === 'final') {
                    this.handleFinalMatchResult(tournament, match, winner, loser);
                } else {
                    if (match.bracket === 'winners') {
                        tournament.tournamentData.winnersPlayers.push(winner);
                    } else if (match.bracket === 'losers') {
                        tournament.tournamentData.losersPlayers.push(winner);
                    }

                    loser.losses++;

                    if (loser.losses >= 2) {
                        loser.eliminated = true;
                        tournament.tournamentData.eliminatedPlayers.push(loser);
                    } else {
                        if (match.bracket === 'winners') {
                            tournament.tournamentData.losersPlayers.push(loser);
                        }
                    }
                }
            }

            emitMatchUpdate(eventManager, {
                tournamentId: tournamentId,
                tournamentTitle: tournament.tournamentData.title,
                matchNumber: match.matchNumber,
                player1: match.player1.name,
                player2: match.player2.name,
                winner: winner.name,
                bracketStage: match.bracket,
                round: match.round
            });
        }

        if (matchCompleted) {
            const removedMatch = tournament.tournamentData.currentMatches.splice(matchIndex, 1)[0];

            if (removedMatch.isDraw && removedMatch.winner) {
                removedMatch.isDraw = false;
            }

            tournament.tournamentData.completedMatches.push(removedMatch);

            if (format === 'round-robin') {
                await this.recalculateStandings(tournamentId);
                logger.info(`Standings recalculated after completing match ${match.matchNumber}`);
            }
        }

        await this.updateTournament(tournamentId, tournament);

        if (shouldAdvanceRound) {
            if (format === 'round-robin') {
                if (tournament.tournamentData.currentMatches.length === 0) {
                    await this.endTournament(tournamentId, eventManager);
                }
            } else {
                if (tournament.tournamentData.winner) {
                    await this.endTournament(tournamentId, eventManager);
                    return;
                }

                if (tournament.tournamentData.currentMatches.length === 0) {
                    await this.advanceToNextRound(tournamentId, eventManager, {
                        suppressOverlayUpdate: true
                    });
                }
            }
        }

        const overlayConfig = buildTournamentOverlayConfig(tournamentId, tournament);
        await webServer.sendToOverlay("tournament-updater", {
            type: 'update',
            overlayInstance: tournament.overlayInstance,
            config: overlayConfig
        });
    }

    /**
     * Handles single elimination match result
     */
    private async handleSingleEliminationResult(tournament: TournamentState, match: Match, winner: Player, loser: Player): Promise<void> {
        logger.info(`Single elimination: ${winner.name} defeats ${loser.name}`);

        loser.losses++;
        loser.eliminated = true;
        tournament.tournamentData.eliminatedPlayers.push(loser);

        winner.wins++;

        tournament.tournamentData.winnersPlayers.push(winner);

        if (tournament.tournamentData.winnersPlayers.length === 1 &&
            tournament.tournamentData.currentMatches.length === 0) {
            tournament.tournamentData.winner = tournament.tournamentData.winnersPlayers[0];
            logger.info(`Single elimination champion: ${tournament.tournamentData.winner.name}`);
        }
    }

    /**
     * Sends notification about draw result to overlay
     */
    private async sendDrawNotification(tournament: TournamentState, match: Match, handling: string): Promise<void> {
        await webServer.sendToOverlay("tournament-updater", {
            type: 'draw-notification',
            overlayInstance: tournament.overlayInstance,
            config: {
                tournamentTitle: tournament.tournamentData.title,
                matchNumber: match.matchNumber,
                player1: match.player1.name,
                player2: match.player2.name,
                handling: handling,
                message: this.getDrawMessage(handling)
            }
        });
    }

    /**
     * Gets user-friendly message for draw handling
     */
    private getDrawMessage(handling: string): string {
        switch (handling) {
            case 'replay':
                return 'Match ended in a draw. Please replay the match.';
            case 'both-advance':
                return 'Match ended in a draw. Both players advance to the next round.';
            case 'random':
                return 'Match ended in a draw. Winner selected randomly.';
            default:
                return 'Match ended in a draw.';
        }
    }

    /**
     * Handles draw results based on the specified handling method
     */
    private async handleDrawResult(
        tournament: TournamentState,
        match: Match,
        drawHandling: string,
        eventManager: any
    ): Promise<void> {
        const format = tournament.tournamentData.settings.format;

        logger.info(`Handling draw result: ${drawHandling} for match ${match.matchNumber}`);

        switch (drawHandling) {
            case 'replay':
                await this.handleReplayDraw(tournament, match, eventManager);
                break;

            case 'both-advance':
                if (format === 'single-elimination') {
                    logger.warn('Both-advance not suitable for single elimination - defaulting to replay');
                    await this.handleReplayDraw(tournament, match, eventManager);
                } else {
                    await this.handleBothAdvanceDraw(tournament, match, eventManager);
                }
                break;

            case 'random':
                await this.handleRandomWinnerDraw(tournament, match, eventManager);
                break;

            default:
                logger.error(`Unknown draw handling method: ${drawHandling} - defaulting to replay`);
                await this.handleReplayDraw(tournament, match, eventManager);
        }
    }

    /**
     * Handles replay draw - keeps match active for replay
     */
    private async handleReplayDraw(tournament: TournamentState, match: Match, eventManager: any): Promise<void> {
        const format = tournament.tournamentData.settings.format;

        if (format === 'round-robin') {
            if (!tournament.tournamentData.settings.roundRobinSettings?.allowDraws) {
                logger.warn(`Draw attempted but draws are not enabled for this round-robin tournament`);
                return;
            }

            match.isDraw = true;
            match.winner = null;

            logger.info(`Round-robin both-advance draw, standings will be recalculated`);

            await this.sendDrawNotification(tournament, match, 'replay');

            emitMatchUpdate(eventManager, {
                tournamentId: tournament.uuid,
                tournamentTitle: tournament.tournamentData.title,
                matchNumber: match.matchNumber,
                player1: match.player1.name,
                player2: match.player2.name,
                winner: 'Draw - Replay Required',
                bracketStage: match.bracket,
                round: match.round,
                isDraw: true,
                drawHandling: 'replay'
            });
        } else {
            match.player1.draws = (match.player1.draws || 0) + 1;
            match.player2.draws = (match.player2.draws || 0) + 1;

            logger.info(`Draw result - match will be replayed: ${match.id}`);

            match.winner = null;
            match.isDraw = true;

            await this.sendDrawNotification(tournament, match, 'replay');

            emitMatchUpdate(eventManager, {
                tournamentId: tournament.uuid,
                tournamentTitle: tournament.tournamentData.title,
                matchNumber: match.matchNumber,
                player1: match.player1.name,
                player2: match.player2.name,
                winner: 'Draw - Replay Required',
                bracketStage: match.bracket,
                round: match.round,
                isDraw: true,
                drawHandling: 'replay'
            });
        }
    }

    /**
     * Handles both-advance draw - both players advance to next round
     */
    private async handleBothAdvanceDraw(tournament: TournamentState, match: Match, eventManager: any): Promise<void> {
        const { tournamentData } = tournament;
        const format = tournamentData.settings.format;

        logger.info(`Draw result - both players advance: ${match.player1.name}, ${match.player2.name}`);

        match.winner = null;
        match.isDraw = true;

        match.player1.draws = (match.player1.draws || 0) + 1;
        match.player2.draws = (match.player2.draws || 0) + 1;

        if (format === 'round-robin') {
            if (!tournamentData.settings.roundRobinSettings?.allowDraws) {
                logger.warn(`Draw attempted but draws are not enabled for this round-robin tournament`);
                return;
            }

            logger.info(`Round-robin replay draw, no standings update until match is resolved`);

            emitMatchUpdate(eventManager, {
                tournamentId: tournament.uuid,
                tournamentTitle: tournament.tournamentData.title,
                matchNumber: match.matchNumber,
                player1: match.player1.name,
                player2: match.player2.name,
                winner: 'Draw',
                bracketStage: match.bracket,
                round: match.round,
                isDraw: true,
                drawHandling: 'both-advance'
            });
        } else {
            if (match.bracket === 'winners') {
                if (!tournamentData.winnersPlayers.includes(match.player1)) {
                    tournamentData.winnersPlayers.push(match.player1);
                }
                if (!tournamentData.winnersPlayers.includes(match.player2)) {
                    tournamentData.winnersPlayers.push(match.player2);
                }
            } else if (match.bracket === 'losers') {
                if (!tournamentData.losersPlayers.includes(match.player1)) {
                    tournamentData.losersPlayers.push(match.player1);
                }
                if (!tournamentData.losersPlayers.includes(match.player2)) {
                    tournamentData.losersPlayers.push(match.player2);
                }
            } else if (match.bracket === 'final') {
                logger.warn('Draw in final match with both-advance - creating rematch');
                tournamentData.winnersPlayers = [match.player1];
                tournamentData.losersPlayers = [match.player2];
                tournamentData.bracketStage = 'final';
            }

            emitMatchUpdate(eventManager, {
                tournamentId: tournament.uuid,
                tournamentTitle: tournament.tournamentData.title,
                matchNumber: match.matchNumber,
                player1: match.player1.name,
                player2: match.player2.name,
                winner: 'Draw - Both Advance',
                bracketStage: match.bracket,
                round: match.round,
                isDraw: true,
                drawHandling: 'both-advance'
            });
        }
    }

    /**
     * Handles random winner selection for draws
     */
    private async handleRandomWinnerDraw(tournament: TournamentState, match: Match, eventManager: any): Promise<void> {
        const format = tournament.tournamentData.settings.format;

        const randomWinner = Math.random() < 0.5 ? match.player1 : match.player2;
        const randomLoser = randomWinner === match.player1 ? match.player2 : match.player1;

        logger.info(`Draw result - random winner selected: ${randomWinner.name}`);

        match.winner = randomWinner;
        match.isDraw = false;
        match.resolvedRandomly = true;

        if (format === 'round-robin') {
            logger.info(`Round-robin random draw: treating as win for ${randomWinner.name}`);
            randomWinner.wins++;
            randomLoser.losses++;
            logger.info(`Round-robin random draw: ${randomWinner.name} selected as winner, standings will be recalculated`);

            emitMatchUpdate(eventManager, {
                tournamentId: tournament.uuid,
                tournamentTitle: tournament.tournamentData.title,
                matchNumber: match.matchNumber,
                player1: match.player1.name,
                player2: match.player2.name,
                winner: `${randomWinner.name} (Random)`,
                bracketStage: match.bracket,
                round: match.round,
                isDraw: false,
                drawHandling: 'random'
            });
        } else {
            emitMatchUpdate(eventManager, {
                tournamentId: tournament.uuid,
                tournamentTitle: tournament.tournamentData.title,
                matchNumber: match.matchNumber,
                player1: match.player1.name,
                player2: match.player2.name,
                winner: `${randomWinner.name} (Random)`,
                bracketStage: match.bracket,
                round: match.round,
                isDraw: false,
                drawHandling: 'random'
            });
        }
    }

    /**
     * Recalculates standings for all matches in a round-robin tournament
     * based on current point settings
     */
    async recalculateStandings(tournamentId: string): Promise<void> {
        const tournament = await this.getTournament(tournamentId);
        if (!tournament || tournament.tournamentData.settings.format !== 'round-robin') return;

        const pointsPerWin = tournament.tournamentData.settings.roundRobinSettings.pointsPerWin || 3;
        const pointsPerDraw = tournament.tournamentData.settings.roundRobinSettings.pointsPerDraw || 1;
        const pointsPerLoss = tournament.tournamentData.settings.roundRobinSettings.pointsPerLoss || 0;
        const standings: { [playerName: string]: any } = {};

        tournament.tournamentData.players.forEach(player => {
            standings[player.name] = {
                points: 0,
                played: 0,
                wins: 0,
                draws: 0,
                losses: 0
            };
        });

        tournament.tournamentData.completedMatches.forEach(match => {
            if (match.bracket !== 'round-robin') return;

            const player1Name = match.player1.name;
            const player2Name = match.player2.name;

            standings[player1Name].played++;
            standings[player2Name].played++;

            if (!match.winner) {
                standings[player1Name].draws++;
                standings[player2Name].draws++;
                standings[player1Name].points += pointsPerDraw;
                standings[player2Name].points += pointsPerDraw;
            } else {
                const winnerName = match.winner.name;
                const loserName = winnerName === player1Name ? player2Name : player1Name;

                standings[winnerName].wins++;
                standings[winnerName].points += pointsPerWin;

                standings[loserName].losses++;
                standings[loserName].points += pointsPerLoss;
            }
        });

        tournament.tournamentData.standings = standings;
        await this.updateTournament(tournamentId, tournament);

        return;
    }

    /**
     * Determines the winner of a round robin tournament
     */
    private determineRoundRobinWinner(tournament: TournamentState): Player | null {
        const standings = tournament.tournamentData.standings;
        if (!standings) return null;

        let highestPoints = -1;
        let winner: Player | null = null;

        for (const player of tournament.tournamentData.players) {
            const playerStanding = standings[player.name];
            if (playerStanding && playerStanding.points > highestPoints) {
                highestPoints = playerStanding.points;
                winner = player;
            }
        }

        return winner;
    }

    /**
     * Handles final match result
     */
    private handleFinalMatchResult(tournament: TournamentState, match: Match, winner: Player, loser: Player): void {
        logger.info(`handleFinalMatchResult: winner=${winner.name}, loser=${loser.name}`);
        logger.info(`Winner losses: ${winner.losses}, Loser losses: ${loser.losses}`);
        logger.info(`requireTrueFinal: ${tournament.tournamentData.requireTrueFinal}, trueFinalPlayed: ${tournament.tournamentData.trueFinalPlayed}`);

        const format = tournament.tournamentData.settings.format;

        if (format === 'single-elimination') {
            tournament.tournamentData.winner = winner;
            loser.losses++;
            loser.eliminated = true;
            tournament.tournamentData.eliminatedPlayers.push(loser);
            return;
        }

        loser.losses++;

        if (winner.losses === 0 && loser.losses === 2) {
            logger.info('Winners bracket champion won the tournament');
            tournament.tournamentData.winner = winner;
            loser.eliminated = true;
            tournament.tournamentData.eliminatedPlayers.push(loser);
        }
        else if (winner.losses === 1 && loser.losses === 1) {
            logger.info('Losers bracket champion won first final - need true final');
            tournament.tournamentData.requireTrueFinal = true;

            tournament.tournamentData.matchCounter++;
            tournament.tournamentData.currentMatches.push({
                id: `match-${Date.now()}-final2`,
                matchNumber: tournament.tournamentData.matchCounter,
                player1: winner,
                player2: loser,
                bracket: 'final',
                round: 2,
                winner: null
            });

            tournament.tournamentData.trueFinalPlayed = true;
        }
        else if (tournament.tournamentData.trueFinalPlayed) {
            logger.info('True final played - tournament complete');
            tournament.tournamentData.winner = winner;
            loser.eliminated = true;
            tournament.tournamentData.eliminatedPlayers.push(loser);
        }

        logger.info(`Tournament winner after handleFinalMatchResult: ${tournament.tournamentData.winner ? tournament.tournamentData.winner.name : 'null'}`);
    }

    /**
     * Advances tournament to the next round
     */
    async advanceToNextRound(
        tournamentId: string,
        eventManager: any,
        options?: { suppressOverlayUpdate?: boolean }
    ): Promise<void> {
        const tournament = await this.getTournament(tournamentId);
        if (!tournament) return;

        const { tournamentData } = tournament;
        const format = tournamentData.settings.format;

        logger.info(`advanceToNextRound: format=${format}, winnersPlayers=${tournamentData.winnersPlayers.length}, currentMatches=${tournamentData.currentMatches.length}`);

        if (format === 'single-elimination') {
            if (tournamentData.winnersPlayers.length === 1 && tournamentData.currentMatches.length === 0) {
                tournamentData.winner = tournamentData.winnersPlayers[0];
                logger.info(`Single elimination tournament complete, winner: ${tournamentData.winner.name}`);
                await this.endTournament(tournamentId, eventManager);
                return;
            }

            if (tournamentData.winnersPlayers.length >= 2) {
                tournamentData.winnersRound++;
                await this.createSingleEliminationMatches(tournamentId);
            }
        } else if (format === 'double-elimination') {
            if (tournamentData.winnersPlayers.length === 1 &&
                (tournamentData.losersPlayers.length === 1 || tournamentData.losersPlayers.length === 0)) {
                await this.advanceToFinals(tournamentId);
                return;
            }

            if (tournamentData.winnersPlayers.length >= 2) {
                tournamentData.winnersRound++;
                tournamentData.bracketStage = 'winners';
                await this.createWinnersMatches(tournamentId);
            }
            else if (tournamentData.losersPlayers.length >= 2) {
                const hasExistingLosersMatches = [
                    ...(tournamentData.completedMatches || []),
                    ...(tournamentData.currentMatches || [])
                ].some(match => match.bracket === 'losers');

                if (hasExistingLosersMatches) {
                    tournamentData.losersRound++;
                }

                tournamentData.bracketStage = 'losers';
                await this.createLosersMatches(tournamentId);
            }
            else if (tournamentData.winnersPlayers.length === 1 && tournamentData.losersPlayers.length === 0) {
                tournamentData.winner = tournamentData.winnersPlayers[0];
                await this.endTournament(tournamentId, eventManager);
            }
        }

        await this.updateTournament(tournamentId, tournament);

        if (!options?.suppressOverlayUpdate) {
            const overlayConfig = buildTournamentOverlayConfig(tournamentId, tournament);
            await webServer.sendToOverlay("tournament-updater", {
                type: 'update',
                overlayInstance: tournament.overlayInstance,
                config: overlayConfig
            });
        }
    }

    /**
     * Creates single elimination matches
     */
    private async createSingleEliminationMatches(tournamentId: string): Promise<void> {
        const tournament = await this.getTournament(tournamentId);
        if (!tournament) return;

        const { tournamentData } = tournament;

        if (tournamentData.winnersPlayers.length < 2) {
            if (tournamentData.winnersPlayers.length === 1) {
                tournamentData.winner = tournamentData.winnersPlayers[0];
            }
            return;
        }

        tournamentData.winnersPlayers.sort((a, b) => a.seed - b.seed);

        const players = [...tournamentData.winnersPlayers];
        tournamentData.winnersPlayers = [];

        for (let i = 0; i < players.length; i += 2) {
            if (i + 1 < players.length) {
                tournamentData.matchCounter++;
                tournamentData.currentMatches.push({
                    id: `match-${Date.now()}-${tournamentData.matchCounter}`,
                    matchNumber: tournamentData.matchCounter,
                    player1: players[i],
                    player2: players[i + 1],
                    bracket: 'winners',
                    round: tournamentData.winnersRound,
                    winner: null
                });
            } else {
                tournamentData.winnersPlayers.push(players[i]);
            }
        }

        await this.updateTournament(tournamentId, tournament);
    }

    /**
     * Creates round robin matches
     */
    async createRoundRobinMatches(tournamentId: string): Promise<void> {
        const tournament = await this.getTournament(tournamentId);
        if (!tournament) return;

        const { tournamentData } = tournament;
        const players = tournamentData.players;

        tournamentData.standings = {};
        players.forEach(player => {
            tournamentData.standings![player.name] = {
                points: 0,
                played: 0,
                wins: 0,
                draws: 0,
                losses: 0
            };
        });

        for (let i = 0; i < players.length; i++) {
            for (let j = i + 1; j < players.length; j++) {
                tournamentData.matchCounter++;
                tournamentData.currentMatches.push({
                    id: `match-${Date.now()}-${tournamentData.matchCounter}`,
                    matchNumber: tournamentData.matchCounter,
                    player1: players[i],
                    player2: players[j],
                    bracket: 'round-robin' as any,
                    round: 1,
                    winner: null
                });
            }
        }

        await this.updateTournament(tournamentId, tournament);
    }

    /**
     * Creates winners bracket matches
     */
    private async createWinnersMatches(tournamentId: string): Promise<void> {
        const tournament = await this.getTournament(tournamentId);
        if (!tournament) return;

        const { tournamentData } = tournament;

        if (tournamentData.winnersPlayers.length < 1) return;

        tournamentData.winnersPlayers.sort((a, b) => a.seed - b.seed);

        const hasOddPlayers = tournamentData.winnersPlayers.length % 2 !== 0;

        const pairsCount = Math.floor(tournamentData.winnersPlayers.length / 2);

        for (let i = 0; i < pairsCount; i++) {
            const playerIndex1 = i * 2;
            const playerIndex2 = i * 2 + 1;

            tournamentData.matchCounter++;
            tournamentData.currentMatches.push({
                id: `match-${Date.now()}-${tournamentData.matchCounter}`,
                matchNumber: tournamentData.matchCounter,
                player1: tournamentData.winnersPlayers[playerIndex1],
                player2: tournamentData.winnersPlayers[playerIndex2],
                bracket: 'winners',
                round: tournamentData.winnersRound,
                winner: null
            });
        }

        if (hasOddPlayers) {
            const byePlayer = tournamentData.winnersPlayers[tournamentData.winnersPlayers.length - 1];
            const newWinnersPlayers = [byePlayer];
            tournamentData.winnersPlayers = newWinnersPlayers;
        } else {
            tournamentData.winnersPlayers = [];
        }

        await this.updateTournament(tournamentId, tournament);
    }

    /**
     * Creates losers bracket matches
     */
    private async createLosersMatches(tournamentId: string): Promise<void> {
        const tournament = await this.getTournament(tournamentId);
        if (!tournament) return;

        const { tournamentData } = tournament;

        if (tournamentData.losersPlayers.length < 1) return;

        const orderedLosersPlayers = this.orderPlayersByDropOrder(tournamentData);
        const hasOddPlayers = orderedLosersPlayers.length % 2 !== 0;
        const pairsCount = Math.floor(orderedLosersPlayers.length / 2);

        for (let i = 0; i < pairsCount; i++) {
            const playerIndex1 = i * 2;
            const playerIndex2 = i * 2 + 1;

            tournamentData.matchCounter++;
            tournamentData.currentMatches.push({
                id: `match-${Date.now()}-${tournamentData.matchCounter}`,
                matchNumber: tournamentData.matchCounter,
                player1: orderedLosersPlayers[playerIndex1],
                player2: orderedLosersPlayers[playerIndex2],
                bracket: 'losers',
                round: tournamentData.losersRound,
                winner: null
            });
        }

        if (hasOddPlayers) {
            const byePlayer = orderedLosersPlayers[orderedLosersPlayers.length - 1];
            const newLosersPlayers = [byePlayer];
            tournamentData.losersPlayers = newLosersPlayers;
        } else {
            tournamentData.losersPlayers = [];
        }

        await this.updateTournament(tournamentId, tournament);
    }

    /**
     * Order players by when they actually dropped to losers bracket based on match history
     */
    private orderPlayersByDropOrder(tournamentData: any): Player[] {
        const playerDropInfo: Array<{ player: Player, dropRound: number, matchNumber: number }> = [];

        tournamentData.losersPlayers.forEach((player: Player) => {
            let dropRound = 1;
            let matchNumber = 0;

            for (const match of tournamentData.completedMatches || []) {
                if (match.winner && match.bracket === 'winners') {
                    const loser = match.player1.name === match.winner.name ? match.player2 : match.player1;
                    if (loser.name === player.name) {
                        dropRound = match.round;
                        matchNumber = match.matchNumber;
                    }
                }
            }

            playerDropInfo.push({
                player: player,
                dropRound: dropRound,
                matchNumber: matchNumber
            });
        });

        playerDropInfo.sort((a, b) => {
            if (a.dropRound !== b.dropRound) {
                return a.dropRound - b.dropRound;
            }
            if (a.matchNumber !== b.matchNumber) {
                return a.matchNumber - b.matchNumber;
            }
            return a.player.seed - b.player.seed;
        });

        return playerDropInfo.map(info => info.player);
    }

    /**
     * Advances tournament to finals
     */
    private async advanceToFinals(tournamentId: string): Promise<void> {
        logger.info('advanceToFinals called');
        const tournament = await this.getTournament(tournamentId);
        if (!tournament) return;

        const { tournamentData } = tournament;
        const format = tournamentData.settings.format;

        logger.info(`Winners players: ${tournamentData.winnersPlayers.length}, Losers players: ${tournamentData.losersPlayers.length}`);

        if (format === 'single-elimination') {
            return;
        }

        tournamentData.bracketStage = 'final';

        if (tournamentData.winnersPlayers.length === 1 && tournamentData.losersPlayers.length === 0) {
            logger.info('Only one player left - declaring winner');
            tournamentData.winner = tournamentData.winnersPlayers[0];
            await this.updateTournament(tournamentId, tournament);
            return;
        }

        logger.info('Creating final match...');
        tournamentData.matchCounter++;
        tournamentData.currentMatches.push({
            id: `match-${Date.now()}-final1`,
            matchNumber: tournamentData.matchCounter,
            player1: tournamentData.winnersPlayers[0],
            player2: tournamentData.losersPlayers[0],
            bracket: 'final',
            round: 1,
            winner: null
        });

        tournamentData.winnersPlayers = [];
        tournamentData.losersPlayers = [];

        await this.updateTournament(tournamentId, tournament);
    }

    /**
     * Updates a tournament
     */
    async updateTournament(tournamentId: string, tournamentState: TournamentState): Promise<void> {
        this.sanitizeTournamentState(tournamentState);

        tournamentState.updatedAt = new Date().toISOString();
        if (!tournamentState.overlayInstance) {
            tournamentState.overlayInstance = '';
        }
        await this._db.push(`/tournaments/${tournamentId}`, tournamentState, true);
    }

    /**
     * Sanitizes tournament state to ensure all required properties
     */
    private sanitizeTournamentState(state: TournamentState): void {
        if (!state.tournamentData.settings) {
            state.tournamentData.settings = {
                format: 'double-elimination',
                displayDuration: 30,
                showSeed: true,
                showBracket: true,
                animateMatches: true,
                showWinnerDisplay: true,
                showWins: false,
                showLosses: true,
                showRecord: false,
                twoLineLayout: false,
                coloredStatBadges: false,
                maxVisibleMatches: 2,
                showStandings: false,
                splitStandings: false,
                standingsTwoLineLayout: false,
                maxVisibleStandings: 5,
                standingsPosition: 'Middle Right',
                standingsCustomCoords: {
                    top: null,
                    bottom: null,
                    left: null,
                    right: null
                },
                roundRobinSettings: {
                    pointsPerWin: 3,
                    pointsPerDraw: 1,
                    pointsPerLoss: 0,
                    allowDraws: false
                }
            };
        }

        if (!state.tournamentData.settings.roundRobinSettings) {
            state.tournamentData.settings.roundRobinSettings = {
                pointsPerWin: 3,
                pointsPerDraw: 1,
                pointsPerLoss: 0,
                allowDraws: false
            };
        }

        if (!state.tournamentData.settings.standingsCustomCoords) {
            state.tournamentData.settings.standingsCustomCoords = {
                top: null,
                bottom: null,
                left: null,
                right: null
            };
        }

        if (state.tournamentData.settings) {
            if (state.tournamentData.settings.maxVisibleMatches !== undefined) {
                state.tournamentData.settings.maxVisibleMatches = Number(state.tournamentData.settings.maxVisibleMatches);
            }

            if (state.tournamentData.settings.maxVisibleStandings !== undefined) {
                state.tournamentData.settings.maxVisibleStandings = Number(state.tournamentData.settings.maxVisibleStandings);
            }

            if (state.tournamentData.settings.displayDuration !== undefined) {
                state.tournamentData.settings.displayDuration = Number(state.tournamentData.settings.displayDuration);
            }

            if (state.tournamentData.settings.roundRobinSettings) {
                if (state.tournamentData.settings.roundRobinSettings.pointsPerWin !== undefined) {
                    state.tournamentData.settings.roundRobinSettings.pointsPerWin =
                        Number(state.tournamentData.settings.roundRobinSettings.pointsPerWin);
                }

                if (state.tournamentData.settings.roundRobinSettings.pointsPerDraw !== undefined) {
                    state.tournamentData.settings.roundRobinSettings.pointsPerDraw =
                        Number(state.tournamentData.settings.roundRobinSettings.pointsPerDraw);
                }

                if (state.tournamentData.settings.roundRobinSettings.pointsPerLoss !== undefined) {
                    state.tournamentData.settings.roundRobinSettings.pointsPerLoss =
                        Number(state.tournamentData.settings.roundRobinSettings.pointsPerLoss);
                }
            }
        }
    }

    /**
     * Creates initial matches for a tournament
     */
    async createInitialMatches(tournamentId: string): Promise<void> {
        const tournament = await this.getTournament(tournamentId);
        if (!tournament) return;

        const format = tournament.tournamentData.settings.format;

        if (format === 'round-robin') {
            await this.createRoundRobinMatches(tournamentId);
        } else {
            const { tournamentData } = tournament;

            if (tournamentData.winnersPlayers.length < 2) return;
            tournamentData.winnersPlayers.sort((a, b) => a.seed - b.seed);
            const players = [...tournamentData.winnersPlayers];
            const halfLength = Math.ceil(players.length / 2);

            for (let i = 0; i < halfLength; i++) {
                if (i + halfLength < players.length) {
                    tournamentData.matchCounter++;
                    tournamentData.currentMatches.push({
                        id: `match-${Date.now()}-${tournamentData.matchCounter}`,
                        matchNumber: tournamentData.matchCounter,
                        player1: players[i],
                        player2: players[players.length - 1 - i],
                        bracket: 'winners',
                        round: tournamentData.winnersRound,
                        winner: null
                    });
                } else {
                    tournamentData.winnersPlayers = [players[i]];
                }
            }

            if (tournamentData.currentMatches.length * 2 >= players.length) {
                tournamentData.winnersPlayers = [];
            }

            await this.updateTournament(tournamentId, tournament);
        }
    }

    /**
     * Creates a new tournament
     */
    async createTournament(tournamentId: string, tournamentState: TournamentState): Promise<void> {
        await this.updateTournament(tournamentId, tournamentState);
    }

    /**
     * Resets a tournament to its initial state
     */
    async resetTournament(tournamentId: string): Promise<void> {
        const tournamentState = await this.getTournament(tournamentId);
        if (!tournamentState) return;

        const playerNames = tournamentState.tournamentData.players.map(p => p.name);
        const format = tournamentState.tournamentData.settings.format;
        const initialPlayerCount = playerNames.length;
        const players = playerNames.map(name => ({
            name,
            wins: 0,
            losses: 0,
            eliminated: false,
            seed: 0
        }));
        const shuffled = this.shuffle([...players]);
        shuffled.forEach((player, index) => player.seed = index + 1);

        let winnersPlayers = [...shuffled];
        let losersPlayers: Player[] = [];
        let eliminatedPlayers: Player[] = [];

        if (format === 'round-robin') {
            winnersPlayers = [];
        } else if (format === 'single-elimination') {
            losersPlayers = [];
        }

        const currentMatches: Match[] = [];
        const completedMatches: Match[] = [];
        const matchCounter = 0;

        const winnersRound = 1;
        const losersRound = 1;
        const bracketStage = format === 'round-robin' ? 'round-robin' as any : 'winners';
        const winner = null;
        const requireTrueFinal = false;
        const trueFinalPlayed = false;

        tournamentState.tournamentData = {
            ...tournamentState.tournamentData,
            players: shuffled,
            winnersPlayers,
            losersPlayers,
            eliminatedPlayers,
            currentMatches,
            completedMatches,
            matchCounter,
            winnersRound,
            losersRound,
            bracketStage,
            winner,
            requireTrueFinal,
            trueFinalPlayed,
            initialPlayerCount,
            standings: format === 'round-robin' ? {} : undefined
        };

        tournamentState.ended = false;
        tournamentState.paused = false;
        tournamentState.manuallyEnded = false;
        tournamentState.updatedAt = new Date().toISOString();

        await this.createInitialMatches(tournamentId);

        await this.updateTournament(tournamentId, tournamentState);

        const overlayConfig = {
            ...buildTournamentOverlayConfig(tournamentId, tournamentState),
            ended: false,
            isResetting: true
        };
        await webServer.sendToOverlay("tournament-updater", {
            type: 'update',
            overlayInstance: tournamentState.overlayInstance,
            config: overlayConfig
        });
    }

    /**
     * Removes a tournament
     */
    async removeTournament(tournamentId: string): Promise<void> {
        try {
            await this.backupTournament(tournamentId);
            await this._db.delete(`/tournaments/${tournamentId}`);
        } catch (error) {
            console.error(`Failed to remove tournament ${tournamentId}:`, error);
            throw error;
        }
    }

    /**
     * Removes a backup tournament
     */
    async removeBackupTournament(backupId: string): Promise<void> {
        try {
            await this._db.delete(`/backups/${backupId}`);
        } catch (error) {
            console.error(`Failed to remove backup tournament ${backupId}:`, error);
            throw error;
        }
    }

    /**
     * Checks if a tournament exists
     */
    async checkTournamentExists(tournamentId: string): Promise<boolean> {
        try {
            await this._db.getData(`/tournaments/${tournamentId}`);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Gets all backup tournaments
     */
    async getBackupTournaments(): Promise<BackupTournament[]> {
        try {
            const backups = await this._db.getData('/backups');
            return Object.entries(backups).map(([tournamentId, backup]) => ({
                ...backup as BackupTournament,
                id: tournamentId
            }));
        } catch {
            return [];
        }
    }

    /**
     * Backs up a tournament
     */
    async backupTournament(tournamentId: string): Promise<void> {
        const tournament = await this.getTournament(tournamentId);
        if (!tournament) return;

        const backupId = `${tournamentId}::backup::${Date.now()}`;
        const backup: BackupTournament = {
            ...tournament,
            removedAt: new Date().toISOString()
        };

        await this._db.push(`/backups/${backupId}`, backup);
    }

    /**
     * Restores a tournament from backup
     */
    async restoreTournament(backupId: string, mode?: 'overwrite'): Promise<void> {
        console.log('Starting restore operation:', { backupId, mode });
        const backup = await this._db.getData(`/backups/${backupId}`);
        if (!backup) {
            console.log('No backup found for:', backupId);
            return;
        }

        const { removedAt, ...backupTournamentState } = backup;
        const tournamentId = backupId.split('::backup::')[0];
        console.log('Backup tournament state:', backupTournamentState);

        await this._db.push(`/tournaments/${tournamentId}`, backupTournamentState);

        const overlayConfig = buildTournamentOverlayConfig(tournamentId, backupTournamentState);
        await webServer.sendToOverlay("tournament-updater", {
            type: 'update',
            overlayInstance: backupTournamentState.overlayInstance,
            config: overlayConfig
        });

        await this._db.delete(`/backups/${backupId}`);
    }

    /**
     * Cleans up old backups
     */
    async cleanupOldBackups(): Promise<void> {
        try {
            const backups = await this._db.getData('/backups') as Record<string, BackupTournament>;
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            for (const [tournamentId, backup] of Object.entries(backups)) {
                if (new Date(backup.removedAt) < sevenDaysAgo) {
                    await this._db.delete(`/backups/${tournamentId}`);
                }
            }

            const tournaments = await this._db.getData('/tournaments') as Record<string, TournamentState>;
            for (const [tournamentId, tournament] of Object.entries(tournaments)) {
                if (tournament.ended && new Date(tournament.updatedAt) < sevenDaysAgo) {
                    await this._db.delete(`/tournaments/${tournamentId}`);
                }
            }
        } catch (error) {
            console.log('No data to clean or error occurred:', error);
        }
    }

    /**
     * Utility method to shuffle an array (Fisher-Yates algorithm)
     */
    private shuffle<T>(array: T[]): T[] {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    /**
     * Gets the status of a tournament
     */
    getStatus(tournamentId: string): Promise<string> {
        return this.getTournament(tournamentId).then(tournament => {
            if (!tournament) return "Tournament Not Found";

            const { tournamentData } = tournament;
            const format = tournamentData.settings.format;

            if (format === 'round-robin') {
                const totalMatches = tournamentData.completedMatches.length + tournamentData.currentMatches.length;
                const completedMatches = tournamentData.completedMatches.length;
                return `Round Robin - ${completedMatches}/${totalMatches} Matches Complete`;
            }

            if (format === 'single-elimination') {
                if (tournamentData.winner) {
                    return 'Tournament Complete';
                }

                const remainingPlayers = tournamentData.winnersPlayers.length +
                    tournamentData.currentMatches.length * 2;
                const totalRounds = Math.ceil(Math.log2(tournamentData.initialPlayerCount));
                const currentRound = totalRounds - Math.ceil(Math.log2(remainingPlayers)) + 1;

                let roundName = `Round ${currentRound}`;
                if (remainingPlayers === 2) {
                    roundName = 'Finals';
                } else if (remainingPlayers === 4) {
                    roundName = 'Semifinals';
                } else if (remainingPlayers === 8) {
                    roundName = 'Quarterfinals';
                }

                return `Single Elimination - ${roundName}`;
            }

            if (tournamentData.winner && !tournamentData.requireTrueFinal) {
                return 'Tournament Complete';
            }

            if (tournamentData.bracketStage === 'final') {
                if (tournamentData.requireTrueFinal && !tournamentData.trueFinalPlayed) {
                    return 'Tournament Finals - Match 1';
                } else if (tournamentData.requireTrueFinal && tournamentData.trueFinalPlayed) {
                    return 'Tournament Finals - True Final';
                } else {
                    return 'Tournament Finals';
                }
            }

            const bracketName = tournamentData.bracketStage === 'winners' ? 'Main' : 'Redemption';
            const currentRound = tournamentData.bracketStage === 'winners' ?
                tournamentData.winnersRound : tournamentData.losersRound;
            const totalPlayers = tournamentData.bracketStage === 'winners' ?
                tournamentData.initialPlayerCount :
                Math.ceil(tournamentData.initialPlayerCount / 2);
            const totalRounds = Math.ceil(Math.log2(totalPlayers));

            let roundName;
            if (totalRounds >= 4) {
                if (currentRound <= totalRounds - 3) {
                    const ordinals = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth'];
                    roundName = `${ordinals[currentRound - 1]} Round`;
                } else if (currentRound === totalRounds - 2) {
                    roundName = 'Quarterfinals';
                } else if (currentRound === totalRounds - 1) {
                    roundName = 'Semifinals';
                } else {
                    roundName = `${bracketName} Finals`;
                }
            } else if (totalRounds === 3) {
                if (currentRound === 1) {
                    roundName = 'First Round';
                } else if (currentRound === 2) {
                    roundName = 'Semifinals';
                } else {
                    roundName = `${bracketName} Finals`;
                }
            } else if (totalRounds === 2) {
                if (currentRound === 1) {
                    roundName = 'Semifinals';
                } else {
                    roundName = `${bracketName} Finals`;
                }
            } else {
                roundName = `${bracketName} Finals`;
            }

            return `${bracketName} Bracket - ${roundName}`;
        });
    }

    /**
     * Gets the current match in a tournament
     */
    async getCurrentMatch(tournamentId: string): Promise<Match | null> {
        const tournament = await this.getTournament(tournamentId);
        if (!tournament || tournament.tournamentData.currentMatches.length === 0) return null;
        return tournament.tournamentData.currentMatches[0];
    }
}

export let tournamentManager: TournamentManager;

export function createTournamentManager(path: string, modules: ScriptModules): TournamentManager {
    if (!tournamentManager) {
        tournamentManager = new TournamentManager(path, modules);
    }
    return tournamentManager;
}
