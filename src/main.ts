import { Firebot, ScriptModules } from "@crowbartools/firebot-custom-scripts-types";
import { ReplaceVariableManager } from "@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager";
import { tournamentSystemEffectType } from "./effects/main-effect";
import { tournamentSystemUpdateEffectType } from "./effects/updater-effect";
import { tournamentSystemBackupEffectType } from "./effects/backup-effect";
import { TournamentSystemEventSource } from "./events/tournament-events";
import { HttpServerManager } from "@crowbartools/firebot-custom-scripts-types/types/modules/http-server-manager";
import { FrontendCommunicator } from "@crowbartools/firebot-custom-scripts-types/types/modules/frontend-communicator";
import { initLogger, logger } from "./logger";
import { Request, Response } from "express";
import tournamentSystemHtml from "./overlay/tournament-system.html";
import { createTournamentManager, tournamentManager } from "./utility/tournament-manager";
import { FirebotSettings } from '@crowbartools/firebot-custom-scripts-types/types/settings';
import * as tournamentVariables from "./variables/tournament-variables";

interface Params { }

// Export the modules with proper initialization
export let webServer: HttpServerManager;
export let frontendCommunicator: FrontendCommunicator;
export let modules: ScriptModules;
export let replaceVariableManager: ReplaceVariableManager;
export let settings: FirebotSettings;

const script: Firebot.CustomScript<Params> = {
    getScriptManifest: () => {
        return {
            name: "Tournament System",
            description: "Create and manage double-elimination tournaments for Firebot",
            author: "MorningStarGG",
            version: "1.0",
            firebotVersion: "5",
        };
    },
    getDefaultParameters: () => {
        return {};
    },
    run: (runRequest) => {
        // Store modules globally
        modules = runRequest.modules;
        webServer = runRequest.modules.httpServer;
        frontendCommunicator = runRequest.modules.frontendCommunicator;
        replaceVariableManager = runRequest.modules.replaceVariableManager;
        settings = runRequest.firebot.settings;

        // Initialize logging
        initLogger(runRequest.modules.logger);
        logger.info("Tournament System Script is loading...");

        // Set up frontend communicator events
        runRequest.modules.frontendCommunicator.on(
            "add-custom-variable",
            (newVar: any) => {
                return runRequest.modules.customVariableManager.addCustomVariable(
                    newVar.name,
                    newVar.data,
                    newVar.ttl,
                    newVar.propertyPath
                );
            }
        );

        // Register HTTP route for serving the tournament system overlay
        webServer.registerCustomRoute(
            "tournament-system",
            "tournament-system.html",
            "GET",
            (req: Request, res: Response) => {
                res.setHeader('content-type', 'text/html');
                res.end(tournamentSystemHtml);
            }
        );

        // Initialize the tournament manager
        createTournamentManager(modules.path.join(SCRIPTS_DIR, '..', 'db', 'tournamentSystem.db'), modules);

        // Clean up old tournaments from the backup system
        setInterval(() => {
            tournamentManager.cleanupOldBackups();
        }, 24 * 60 * 60 * 1000); // Check once per day

        tournamentManager.cleanupOldBackups();

        // Tournament Event Handlers
        const tournamentEventHandlers = {
            getActiveTournaments: async () => {
                return await tournamentManager.getActiveTournaments();
            },
            getEndedTournaments: async () => {
                return await tournamentManager.getEndedTournaments();
            },
            getAllTournamentsWithStatus: async () => {
                return await tournamentManager.getAllTournamentsWithStatus();
            },
            getTournamentData: async (tournamentId: string) => {
                return await tournamentManager.getTournament(tournamentId);
            },
            removeTournament: async ({ tournamentId }: { tournamentId: string }) => {
                return await tournamentManager.removeTournament(tournamentId);
            },
            removeBackupTournament: async ({ tournamentId }: { tournamentId: string }) => {
                return await tournamentManager.removeBackupTournament(tournamentId);
            },
            getBackupTournaments: async () => {
                return await tournamentManager.getBackupTournaments();
            },
            restoreTournament: async ({ backupId, mode }: { backupId: string; mode?: 'overwrite' }) => {
                return await tournamentManager.restoreTournament(backupId, mode);
            },
            checkTournamentExists: async ({ tournamentId }: { tournamentId: string }) => {
                return await tournamentManager.checkTournamentExists(tournamentId);
            },
            tournamentReset: async ({ tournamentId }: { tournamentId: string }) => {
                return await tournamentManager.resetTournamentWithUndo(tournamentId);
            },
            undoResetTournament: async ({ tournamentId }: { tournamentId: string }) => {
                return await tournamentManager.undoReset(tournamentId);
            },
            canUndoReset: async ({ tournamentId }: { tournamentId: string }) => {
                return await tournamentManager.canUndoReset(tournamentId);
            },
            getCurrentMatch: async (tournamentId: string) => {
                return await tournamentManager.getCurrentMatch(tournamentId);
            },
            setMatchWinner: async ({ tournamentId, matchId, playerNumber, drawHandling }: {
                tournamentId: string,
                matchId: string,
                playerNumber: number | string,
                drawHandling?: string
            }) => {
                return await tournamentManager.setMatchWinner(
                    tournamentId,
                    matchId,
                    playerNumber,
                    modules.eventManager,
                    drawHandling || 'replay'
                );
            }
        };

        // Register all tournament event handlers
        Object.entries(tournamentEventHandlers).forEach(([event, handler]) => {
            frontendCommunicator.onAsync(event, async (...args: any[]) => {
                try {
                    const result = await handler(args[0]);
                    return result;
                } catch (error) {
                    logger.error(`${event} error:`, error);
                    return event === 'getActiveTournaments' ? [] : null;
                }
            });
        });

        // Register tournament system events
        modules.eventManager.registerEventSource(TournamentSystemEventSource);

        // Register tournament system effects
        modules.effectManager.registerEffect(tournamentSystemEffectType());
        modules.effectManager.registerEffect(tournamentSystemUpdateEffectType());
        modules.effectManager.registerEffect(tournamentSystemBackupEffectType());

        // Register tournament system variables
        Object.values(tournamentVariables).forEach(variable => {
            replaceVariableManager.registerReplaceVariable(variable);
        });
    },
};

export default script;