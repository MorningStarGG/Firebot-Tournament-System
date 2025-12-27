import { ReplaceVariable } from "@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager";
import { tournamentManager } from "../utility/tournament-manager";


function normalizeTournamentId(tournamentId: string): string {
    return tournamentId.startsWith('tournament_') ? tournamentId : `tournament_${tournamentId}`;
}

export const tournamentWinnerVariable: ReplaceVariable = {
    definition: {
        handle: "tournamentWinner",
        description: "Gets the winner of the tournament",
        usage: "tournamentWinner[tournamentId]",
        examples: [
            {
                usage: "tournamentWinner[tournament_example]",
                description: "Returns the name of the tournament winner"
            }
        ],
        possibleDataOutput: ["text"]
    },
    evaluator: async (_, tournamentId: string) => {
        const tournament = await tournamentManager.getTournament(normalizeTournamentId(tournamentId));
        if (!tournament?.tournamentData?.winner) return "No winner yet";
        return tournament.tournamentData.winner.name;
    }
};

export const tournamentStatusVariable: ReplaceVariable = {
    definition: {
        handle: "tournamentStatus",
        description: "Gets current status of a tournament from active tournaments or backups",
        usage: "tournamentStatus[tournamentId, mode?]",
        examples: [
            {
                usage: "tournamentStatus[example]",
                description: "Gets current status of tournament (not_found, manually_stopped, completed_with_winner, ended, paused, active)"
            },
            {
                usage: "tournamentStatus[example, backups]",
                description: "Gets status of tournament from backups"
            }
        ],
        possibleDataOutput: ["text"]
    },
    evaluator: async (_, tournamentId: string, mode?: string) => {
        if (mode?.toLowerCase() === "backups") {
            const backupTournaments = await tournamentManager.getBackupTournaments();
            const matchingBackup = backupTournaments.find(backup =>
                backup.id === tournamentId ||
                `tournament_${backup.tournamentData.title.replace(/[^a-zA-Z0-9]/g, '_')}` === normalizeTournamentId(tournamentId)
            );
            if (!matchingBackup) return "not_found";
            return "backed_up";
        }

        const tournament = await tournamentManager.getTournament(normalizeTournamentId(tournamentId));
        if (!tournament) return "not_found";

        if (tournament.ended) {
            if (tournament.manuallyEnded) {
                return "manually_stopped";
            } else if (tournament.tournamentData.winner) {
                return "completed_with_winner";
            } else {
                return "ended";
            }
        }

        if (tournament.paused) return "paused";
        return "active";
    }
};

export const tournamentStageVariable: ReplaceVariable = {
    definition: {
        handle: "tournamentStage",
        description: "Gets the current stage and round of the tournament",
        usage: "tournamentStage[tournamentId]",
        examples: [
            {
                usage: "tournamentStage[tournament_example]",
                description: "Returns the current tournament stage (e.g., 'Winners Bracket - Quarterfinals')"
            }
        ],
        possibleDataOutput: ["text"]
    },
    evaluator: async (_, tournamentId: string) => {
        return await tournamentManager.getStatus(normalizeTournamentId(tournamentId));
    }
};

export const tournamentCurrentMatchVariable: ReplaceVariable = {
    definition: {
        handle: "tournamentCurrentMatch",
        description: "Gets information about the current match",
        usage: "tournamentCurrentMatch[tournamentId, property?]",
        examples: [
            {
                usage: "tournamentCurrentMatch[tournament_example]",
                description: "Returns formatted info about the current match"
            },
            {
                usage: "tournamentCurrentMatch[tournament_example, matchNumber]",
                description: "Returns the current match number"
            },
            {
                usage: "tournamentCurrentMatch[tournament_example, player1]",
                description: "Returns the name of player 1 in the current match"
            },
            {
                usage: "tournamentCurrentMatch[tournament_example, player2]",
                description: "Returns the name of player 2 in the current match"
            },
            {
                usage: "tournamentCurrentMatch[tournament_example, bracket]",
                description: "Returns the bracket of the current match (winners/losers/final)"
            },
            {
                usage: "tournamentCurrentMatch[tournament_example, round]",
                description: "Returns the round number of the current match"
            }
        ],
        possibleDataOutput: ["text", "number"]
    },
    evaluator: async (_, tournamentId: string, property?: string) => {
        const match = await tournamentManager.getCurrentMatch(normalizeTournamentId(tournamentId));
        if (!match) return "No current match";

        if (!property) {
            return `Match ${match.matchNumber}: ${match.player1.name} vs ${match.player2.name} [${match.bracket} bracket, round ${match.round}]`;
        }

        switch (property.toLowerCase()) {
            case "matchnumber":
                return match.matchNumber;
            case "player1":
                return match.player1.name;
            case "player2":
                return match.player2.name;
            case "bracket":
                return match.bracket;
            case "round":
                return match.round;
            default:
                return "Invalid property";
        }
    }
};

export const tournamentPlayerStatusVariable: ReplaceVariable = {
    definition: {
        handle: "tournamentPlayerStatus",
        description: "Gets the status of a player in the tournament",
        usage: "tournamentPlayerStatus[tournamentId, playerName]",
        examples: [
            {
                usage: "tournamentPlayerStatus[tournament_example, Player1]",
                description: "Returns the status of Player1 in the tournament"
            }
        ],
        possibleDataOutput: ["text"]
    },
    evaluator: async (_, tournamentId: string, playerName: string) => {
        const tournament = await tournamentManager.getTournament(normalizeTournamentId(tournamentId));
        if (!tournament) return "Tournament not found";

        const inWinners = tournament.tournamentData.winnersPlayers.find(
            p => p.name.toLowerCase() === playerName.toLowerCase()
        );
        if (inWinners) return "In winners bracket, waiting for next match";

        const inLosers = tournament.tournamentData.losersPlayers.find(
            p => p.name.toLowerCase() === playerName.toLowerCase()
        );
        if (inLosers) return "In losers bracket, waiting for next match";

        for (const match of tournament.tournamentData.currentMatches) {
            if (match.player1.name.toLowerCase() === playerName.toLowerCase() ||
                match.player2.name.toLowerCase() === playerName.toLowerCase()) {
                return `In current match (#${match.matchNumber}, ${match.bracket} bracket)`;
            }
        }

        const isEliminated = tournament.tournamentData.eliminatedPlayers.find(
            p => p.name.toLowerCase() === playerName.toLowerCase()
        );
        if (isEliminated) return "Eliminated";

        if (tournament.tournamentData.winner?.name.toLowerCase() === playerName.toLowerCase()) {
            return "Tournament Winner";
        }

        return "Player not found";
    }
};

export const tournamentPlayersVariable: ReplaceVariable = {
    definition: {
        handle: "tournamentPlayers",
        description: "Gets list of players in the tournament with various filtering options",
        usage: "tournamentPlayers[tournamentId, filter?]",
        examples: [
            {
                usage: "tournamentPlayers[tournament_example]",
                description: "Returns a list of all players in the tournament"
            },
            {
                usage: "tournamentPlayers[tournament_example, active]",
                description: "Returns only players still active in the tournament"
            },
            {
                usage: "tournamentPlayers[tournament_example, winners]",
                description: "Returns players in the winners bracket"
            },
            {
                usage: "tournamentPlayers[tournament_example, losers]",
                description: "Returns players in the losers bracket"
            },
            {
                usage: "tournamentPlayers[tournament_example, eliminated]",
                description: "Returns eliminated players"
            },
            {
                usage: "tournamentPlayers[tournament_example, count]",
                description: "Returns the total number of players"
            }
        ],
        possibleDataOutput: ["text", "number", "array"]
    },
    evaluator: async (_, tournamentId: string, filter?: string) => {
        const tournament = await tournamentManager.getTournament(normalizeTournamentId(tournamentId));
        if (!tournament) return "Tournament not found";

        if (filter?.toLowerCase() === "count") {
            return tournament.tournamentData.players.length;
        }

        let players: string[] = [];

        switch (filter?.toLowerCase()) {
            case "winners":
                players = tournament.tournamentData.winnersPlayers.map(p => p.name);
                break;
            case "losers":
                players = tournament.tournamentData.losersPlayers.map(p => p.name);
                break;
            case "eliminated":
                players = tournament.tournamentData.eliminatedPlayers.map(p => p.name);
                break;
            case "active":
                players = [
                    ...tournament.tournamentData.winnersPlayers.map(p => p.name),
                    ...tournament.tournamentData.losersPlayers.map(p => p.name)
                ];

                for (const match of tournament.tournamentData.currentMatches) {
                    if (!players.includes(match.player1.name)) {
                        players.push(match.player1.name);
                    }
                    if (!players.includes(match.player2.name)) {
                        players.push(match.player2.name);
                    }
                }
                break;
            default:
                players = tournament.tournamentData.players.map(p => p.name);
        }

        return players.join(", ");
    }
};

export const tournamentMatchesVariable: ReplaceVariable = {
    definition: {
        handle: "tournamentMatches",
        description: "Gets information about matches in the tournament",
        usage: "tournamentMatches[tournamentId, filter?]",
        examples: [
            {
                usage: "tournamentMatches[tournament_example, current]",
                description: "Returns information about current matches"
            },
            {
                usage: "tournamentMatches[tournament_example, completed]",
                description: "Returns information about completed matches"
            },
            {
                usage: "tournamentMatches[tournament_example, count]",
                description: "Returns the total number of matches played and pending"
            }
        ],
        possibleDataOutput: ["text", "number"]
    },
    evaluator: async (_, tournamentId: string, filter?: string) => {
        const tournament = await tournamentManager.getTournament(normalizeTournamentId(tournamentId));
        if (!tournament) return "Tournament not found";

        if (filter?.toLowerCase() === "count") {
            return tournament.tournamentData.currentMatches.length +
                tournament.tournamentData.completedMatches.length;
        }

        let matches: any[] = [];

        switch (filter?.toLowerCase()) {
            case "current":
                matches = tournament.tournamentData.currentMatches;
                break;
            case "completed":
                matches = tournament.tournamentData.completedMatches;
                break;
            default:
                matches = [...tournament.tournamentData.currentMatches, ...tournament.tournamentData.completedMatches];
        }

        if (matches.length === 0) {
            return filter?.toLowerCase() === "current" ? "No current matches" : "No matches found";
        }

        return matches.map(match => {
            const winnerInfo = match.winner ? ` (Winner: ${match.winner.name})` : "";
            return `Match ${match.matchNumber}: ${match.player1.name} vs ${match.player2.name}${winnerInfo}`;
        }).join(" | ");
    }
};

export const findTournamentIdVariable: ReplaceVariable = {
    definition: {
        handle: "findTournamentId",
        description: "Finds a tournament ID by searching with keywords",
        usage: "findTournamentId[searchTerm, mode?]",
        examples: [
            {
                usage: "findTournamentId[summer]",
                description: "Searches all tournaments (default)"
            },
            {
                usage: "findTournamentId[summer, active]",
                description: "Searches only active tournaments"
            },
            {
                usage: "findTournamentId[summer, ended]",
                description: "Searches only ended tournaments"
            },
            {
                usage: "findTournamentId[summer, backups]",
                description: "Searches only backup tournaments"
            }
        ],
        possibleDataOutput: ["text"]
    },
    evaluator: async (_, searchTerm: string, mode: string = "all") => {
        const searchMode = mode.toLowerCase();
        const searchTerms = searchTerm.toLowerCase().split(' ').filter(term => term.length > 0);

        const activeTournaments = await tournamentManager.getActiveTournaments();
        const backupTournaments = await tournamentManager.getBackupTournaments();
        const endedTournaments = await tournamentManager.getEndedTournaments();

        let bestMatch: string | null = null;
        let highestMatchScore = 0;
        let mostRecentTimestamp = 0;

        const calculateMatchScore = (title: string): number => {
            const originalTitle = title.toLowerCase();
            let score = searchTerms.filter(term => originalTitle.includes(term)).length * 2;

            const cleanTitle = originalTitle
                .replace(/[^a-zA-Z0-9\s]/g, '')
                .trim();

            const cleanSearchTerms = searchTerms.map(term =>
                term.replace(/[^a-zA-Z0-9\s]/g, '')
                    .trim()
            );

            score += cleanSearchTerms.filter(term => cleanTitle.includes(term)).length;
            return score;
        };

        switch (searchMode) {
            case 'active':
                for (const tournamentId of activeTournaments) {
                    const tournament = await tournamentManager.getTournament(tournamentId);
                    if (!tournament?.tournamentData?.title) continue;

                    const matchScore = calculateMatchScore(tournament.tournamentData.title);
                    if (matchScore > highestMatchScore) {
                        highestMatchScore = matchScore;
                        bestMatch = tournamentId;
                    }
                }
                break;

            case 'ended':
                for (const tournamentId of endedTournaments) {
                    const tournament = await tournamentManager.getTournament(tournamentId);
                    if (!tournament?.tournamentData?.title) continue;

                    const matchScore = calculateMatchScore(tournament.tournamentData.title);
                    if (matchScore > highestMatchScore) {
                        highestMatchScore = matchScore;
                        bestMatch = tournamentId;
                    }
                }
                break;

            case 'backups':
                for (const backup of backupTournaments) {
                    if (!backup?.tournamentData?.title) continue;

                    const matchScore = calculateMatchScore(backup.tournamentData.title);
                    const timestamp = new Date(backup.removedAt).getTime();

                    if (matchScore > highestMatchScore ||
                        (matchScore === highestMatchScore && timestamp > mostRecentTimestamp)) {
                        highestMatchScore = matchScore;
                        mostRecentTimestamp = timestamp;
                        bestMatch = `tournament_${backup.tournamentData.title.replace(/[^a-zA-Z0-9]/g, '_')}::backup::${timestamp}`;
                    }
                }
                break;

            case 'all':
            default:
                for (const tournamentId of activeTournaments) {
                    const tournament = await tournamentManager.getTournament(tournamentId);
                    if (!tournament?.tournamentData?.title) continue;

                    const matchScore = calculateMatchScore(tournament.tournamentData.title);
                    if (matchScore > highestMatchScore) {
                        highestMatchScore = matchScore;
                        bestMatch = tournamentId;
                    }
                }

                if (!bestMatch) {
                    for (const tournamentId of endedTournaments) {
                        const tournament = await tournamentManager.getTournament(tournamentId);
                        if (!tournament?.tournamentData?.title) continue;

                        const matchScore = calculateMatchScore(tournament.tournamentData.title);
                        if (matchScore > highestMatchScore) {
                            highestMatchScore = matchScore;
                            bestMatch = tournamentId;
                        }
                    }
                }

                if (!bestMatch) {
                    for (const backup of backupTournaments) {
                        if (!backup?.tournamentData?.title) continue;

                        const matchScore = calculateMatchScore(backup.tournamentData.title);
                        const timestamp = new Date(backup.removedAt).getTime();

                        if (matchScore > highestMatchScore ||
                            (matchScore === highestMatchScore && timestamp > mostRecentTimestamp)) {
                            highestMatchScore = matchScore;
                            mostRecentTimestamp = timestamp;
                            bestMatch = `tournament_${backup.tournamentData.title.replace(/[^a-zA-Z0-9]/g, '_')}::backup::${timestamp}`;
                        }
                    }
                }
                break;
        }

        return bestMatch || "No matching tournament found";
    }
};