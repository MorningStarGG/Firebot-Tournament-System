import { EventSource } from "@crowbartools/firebot-custom-scripts-types/types/modules/event-manager";
import { TournamentStartMetadata, TournamentUpdateMetadata, TournamentEndMetadata } from '../types/types';
import { logger } from "../logger";

export const TOURNAMENT_SYSTEM_SOURCE_ID = "msgg:tournament-system";
export const TOURNAMENT_START_EVENT = "tournamentStart";
export const TOURNAMENT_MATCH_UPDATE_EVENT = "tournamentMatchUpdate";
export const TOURNAMENT_END_EVENT = "tournamentEnd";

export const TournamentSystemEventSource: EventSource = {
    id: TOURNAMENT_SYSTEM_SOURCE_ID,
    name: "Advanced Tournament System",
    events: [
        {
            id: TOURNAMENT_START_EVENT,
            name: "Tournament Started",
            description: "Triggered when a new tournament starts",
            cached: false,
            manualMetadata: {
                tournamentId: "tournament_example",
                tournamentTitle: "Example Tournament",
                players: ["Player 1", "Player 2", "Player 3", "Player 4", "Player 5", "Player 6", "Player 7", "Player 8"]
            }
        },
        {
            id: TOURNAMENT_MATCH_UPDATE_EVENT,
            name: "Tournament Match Updated",
            description: "Triggered when a match is completed",
            cached: false,
            manualMetadata: {
                tournamentId: "tournament_example",
                tournamentTitle: "Example Tournament",
                matchNumber: 1,
                player1: "Player 1",
                player2: "Player 2",
                winner: "Player 1",
                bracketStage: "winners",
                round: 1,
                isDraw: false,
                drawHandling: "replay"
            }
        },
        {
            id: TOURNAMENT_END_EVENT,
            name: "Tournament Ended",
            description: "Triggered when a tournament is completed",
            cached: false,
            manualMetadata: {
                tournamentId: "tournament_example",
                tournamentTitle: "Example Tournament",
                winner: "Player 1",
                matchesPlayed: 7,
                duration: 300
            }
        }
    ]
};

// Function to emit tournament start event
export const emitTournamentStart = async (
    eventManager: any,
    tournamentData: TournamentStartMetadata
) => {
    await eventManager.triggerEvent(
        TOURNAMENT_SYSTEM_SOURCE_ID,
        TOURNAMENT_START_EVENT,
        tournamentData
    );
};

// Function to emit match update event
export const emitMatchUpdate = async (
    eventManager: any,
    matchData: TournamentUpdateMetadata
) => {
    await eventManager.triggerEvent(
        TOURNAMENT_SYSTEM_SOURCE_ID,
        TOURNAMENT_MATCH_UPDATE_EVENT,
        matchData
    );
};

// Function to emit tournament end event
export const emitTournamentEnd = async (
    eventManager: any,
    tournamentData: TournamentEndMetadata
) => {
    try {
        logger.info('Starting tournament end event emission for:', tournamentData.tournamentId);

        const eventData = {
            tournamentTitle: tournamentData.tournamentTitle,
            tournamentId: tournamentData.tournamentId,
            winner: tournamentData.winner,
            matchesPlayed: tournamentData.matchesPlayed,
            duration: tournamentData.duration,
            timestamp: Date.now()
        };

        logger.info('Emitting tournament end event with data:', eventData);

        await eventManager.triggerEvent(
            TOURNAMENT_SYSTEM_SOURCE_ID,
            TOURNAMENT_END_EVENT,
            eventData
        );

        logger.info('Tournament end event emission completed successfully');
        return true;
    } catch (error) {
        logger.error('Error emitting tournament end event:', error);
        throw error;
    }
};