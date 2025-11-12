import { Firebot } from "@crowbartools/firebot-custom-scripts-types";
import {
    MatchUpdateModel,
    VisibilityAction,
    SettingUpdate,
    TournamentSettings,
    TournamentState,
    PlayerActionType,
} from "../types/types";
import { tournamentManager } from "../utility/tournament-manager";
import updaterTemplate from "../templates/updater-template.html";
import { logger } from "../logger";
import { webServer, frontendCommunicator, modules } from "../main";
import { buildTournamentOverlayConfig } from "../utility/overlay-config";

const DEFAULT_CUSTOM_BRACKET_NAMES = {
    winnersTitle: "Winners Bracket",
    winnersShortTitle: "Winners",
    losersTitle: "Losers Bracket",
    losersShortTitle: "Losers",
    singleEliminationTitle: "Tournament Bracket",
    finalsTitle: "Finals",
} as const;

type BracketNameSettingKey = keyof typeof DEFAULT_CUSTOM_BRACKET_NAMES;

function ensureCustomBracketNameSettings(
    settings?: TournamentSettings | null
): void {
    if (!settings) {
        return;
    }

    if (!settings.customBracketNames) {
        settings.customBracketNames = { ...DEFAULT_CUSTOM_BRACKET_NAMES };
    } else {
        settings.customBracketNames = {
            ...DEFAULT_CUSTOM_BRACKET_NAMES,
            ...settings.customBracketNames,
        };
    }

    if (settings.useManualShortNames === undefined) {
        settings.useManualShortNames = false;
    }
}

export function tournamentSystemUpdateEffectType() {
    const updaterEffectType: Firebot.EffectType<MatchUpdateModel> = {
        definition: {
            id: "msgg:tournament-system-updater",
            name: "Advanced Tournament System Manager",
            description:
                "Manage an existing tournament (set match winner, advance round, etc.)",
            icon: "fad fa-sitemap",
            categories: ["overlay"],
        },

        optionsTemplate: updaterTemplate,

        /**
         * Controller for handling the effect's options UI logic
         */
        optionsController: (
            $scope: any,
            backendCommunicator: any,
            utilityService: any
        ) => {
            const DEFAULT_CUSTOM_BRACKET_NAMES_UI = {
                winnersTitle: "Winners Bracket",
                winnersShortTitle: "Winners",
                losersTitle: "Losers Bracket",
                losersShortTitle: "Losers",
                singleEliminationTitle: "Tournament Bracket",
                finalsTitle: "Finals"
            };

            function ensureCustomBracketNameSettingsLocal(
                settings?: TournamentSettings | null
            ) {
                if (!settings) {
                    return;
                }

                if (!settings.customBracketNames) {
                    settings.customBracketNames = {
                        ...DEFAULT_CUSTOM_BRACKET_NAMES_UI,
                    };
                } else {
                    settings.customBracketNames = {
                        ...DEFAULT_CUSTOM_BRACKET_NAMES_UI,
                        ...settings.customBracketNames,
                    };
                }

                if (settings.useManualShortNames === undefined) {
                    settings.useManualShortNames = false;
                }
            }

            $scope.styleLabels = {
                backgroundColor: "Background Color",
                accentColor: "Accent Color",
                textColor: "Text Color",
                titleColor: "Title Color",
                winnerColor: "Winner Color",
                winnerTextColor: "Winner Text Color",
                winnerRecordColor: "Winner Record Color",
                loserColor: "Loser Color",
                borderColor: "Border Color",
                shadowColor: "Shadow Color",
                playerCardColor: "Player Card Color",
                statsCardColor: "Stats Card Color",
                seedBadgeColor: "Seed Badge Color",
                nameTextColor: "Name Text Color",
                statsTextColor: "Stats Text Color",
                percentageBadgeColor: "Percentage Badge Color",
                seedBadgeTextColor: "Seed Badge Text Color",
                winsBadgeTextColor: "Wins Badge Text Color",
                lossesBadgeTextColor: "Losses Badge Text Color",
                percentageBadgeTextColor: "Percentage Badge Text Color",
                standingsBgColor: "Standings Background Color",
                standingsPlayerBgColor: "Standings Player Background Color",
                standingsStatsBgColor: "Standings Stats Background Color",
                standingsBorderColor: "Standings Border Color",
                standingRank1BgColor: "Standing Rank 1 BG Color",
                standingRank1TextColor: "Standing Rank 1 Text Color",
                standingRank2BgColor: "Standing Rank 2 BG Color",
                standingRank2TextColor: "Standing Rank 2 Text Color",
                standingRank3BgColor: "Standing Rank 3 BG Color",
                standingRank3TextColor: "Standing Rank 3 Text Color",
                standingRank4BgColor: "Standing Rank 4 BG Color",
                standingRank4TextColor: "Standing Rank 4 Text Color",
                standingRank5BgColor: "Standing Rank 5 BG Color",
                standingRank5TextColor: "Standing Rank 5 Text Color",
                standingRankOthersBgColor: "Standing Rank Others BG Color",
                standingRankOthersTextColor: "Standing Rank Others Text Color",
                standingsTitleColor: "Standings Title Color",
                standingsPointsColor: "Standings Points Color",
                standingsRecordColor: "Standings Record Color",
                standingsPlayerNameColor: "Standings Player Name Color"
            };

            $scope.activeTournaments = [];
            $scope.endedTournaments = [];
            $scope.tournamentData = null;
            $scope.canUndoReset = false;
            $scope.undoTimeRemaining = 0;
            $scope.loading = false;

            if (!$scope.effect) {
                $scope.effect = {
                    tournamentSelectionMode: "tournamentList",
                    mode: "updateStyles",
                    manualTournamentTitle: "",
                    action: "setWinner",
                    playerNumber: 1,
                    matchNumber: 1,
                    drawHandling: "replay",
                    pauseAction: "pause",
                    tournamentStatus: "stop",
                    visibilityAction: "hide",
                    setting: {
                        type: "backgroundColor",
                        value: "#111111",
                    },
                    styles: {},
                    settings: {
                        format: "double-elimination",
                        displayDuration: 30,
                        showSeed: true,
                        showBracket: true,
                        animateMatches: true,
                        showWinnerDisplay: true,
                        winnerGraphicType: 'trophy',
                        winnerImageMode: 'url',
                        winnerImageUrl: '',
                        winnerImageFile: '',
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
                    },
                    tournamentOptions: {
                        displayDuration: 30,
                        roundRobinSettings: {
                            pointsPerWin: 3,
                            pointsPerDraw: 1,
                            pointsPerLoss: 0,
                            allowDraws: false,
                        },
                    },
                };
            } else {
                if (!$scope.effect.playerNumber) {
                    $scope.effect.playerNumber = 1;
                }

                if (!$scope.effect.drawHandling) {
                    $scope.effect.drawHandling = "replay";
                }

                if (!$scope.effect.tournamentOptions) {
                    $scope.effect.tournamentOptions = {
                        displayDuration: 30,
                        roundRobinSettings: {
                            pointsPerWin: 3,
                            pointsPerDraw: 1,
                            pointsPerLoss: 0,
                            allowDraws: false,
                        },
                    };
                } else if (!$scope.effect.tournamentOptions.roundRobinSettings) {
                    $scope.effect.tournamentOptions.roundRobinSettings = {
                        pointsPerWin: 3,
                        pointsPerDraw: 1,
                        pointsPerLoss: 0,
                        allowDraws: false,
                    };
                }

                if (!$scope.effect.settings) {
                    $scope.effect.settings = {
                        format: "double-elimination",
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
            }

            ensureCustomBracketNameSettingsLocal($scope.effect.settings);

            if (!$scope.effect.playerAction) {
                $scope.effect.playerAction = "add";
            }
            if ($scope.effect.playerName === undefined || $scope.effect.playerName === null) {
                $scope.effect.playerName = "";
            }
            if ($scope.effect.replacementPlayerName === undefined || $scope.effect.replacementPlayerName === null) {
                $scope.effect.replacementPlayerName = "";
            }

            /**
             * Loads active tournaments from the backend
             */
            function loadActiveTournaments() {
                if ($scope.effect.tournamentSelectionMode !== "tournamentList") return;

                $scope.loading = true;
                backendCommunicator
                    .fireEventAsync("getAllTournamentsWithStatus", {})
                    .then((tournaments: any[]) => {
                        if (!tournaments) {
                            $scope.activeTournaments = [];
                            $scope.endedTournaments = [];
                            return;
                        }


                        $scope.activeTournaments = tournaments
                            .filter((t) => t.status === "active")
                            .map((t) => ({
                                label: `${t.displayTitle}`,
                                value: t.tournamentId,
                                status: 'active'
                            }));

                        $scope.endedTournaments = tournaments
                            .filter((t) => t.status === "ended")
                            .map((t) => ({
                                label: `${t.displayTitle}`,
                                value: t.tournamentId,
                                status: 'ended'
                            }));

                        $scope.loading = false;
                    })
                    .catch((error: Error) => {
                        console.error("Error loading tournaments:", error);
                        $scope.activeTournaments = [];
                        $scope.endedTournaments = [];
                        $scope.loading = false;
                    });
            }

            /**
             * Loads tournament data for the selected tournament
             */
            function loadTournamentData() {
                const tournamentId = $scope.effect.tournamentTitle;
                if (!tournamentId) return;

                $scope.loading = true;

                backendCommunicator
                    .fireEventAsync("getTournamentData", tournamentId)
                    .then((data: any) => {
                        if (!data) {
                            $scope.loading = false;
                            return;
                        }

                        $scope.tournamentData = data;
                        $scope.effect.styles = { ...data.tournamentData.styles };

                        if (data.tournamentData.settings) {
                            $scope.effect.settings = { ...data.tournamentData.settings };
                        } else {
                            $scope.effect.settings = {
                                format: data.tournamentData.format || "double-elimination",
                                displayDuration: data.displayDuration || 30,
                                roundRobinSettings: {
                                    pointsPerWin: data.tournamentData.pointsPerWin || 3,
                                    pointsPerDraw: data.tournamentData.pointsPerDraw || 1,
                                    pointsPerLoss: data.tournamentData.pointsPerLoss || 0,
                                    allowDraws: !!data.tournamentData.allowDraws
                                },
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
                                }
                            };
                        }

                        ensureCustomBracketNameSettingsLocal($scope.effect.settings);

                        $scope.effect.tournamentOptions = {
                            displayDuration: $scope.effect.settings.displayDuration || 30,
                            roundRobinSettings: { ...$scope.effect.settings.roundRobinSettings }
                        };

                        $scope.effect.position = data.position || 'Middle';

                        if ($scope.effect.position === 'Custom') {
                            $scope.effect.customCoords = {
                                top: data.customCoords?.top ?? null,
                                left: data.customCoords?.left ?? null,
                                bottom: data.customCoords?.bottom ?? null,
                                right: data.customCoords?.right ?? null
                            };
                        }

                        $scope.checkUndoResetStatus();

                        $scope.loading = false;
                    })
                    .catch((error: Error) => {
                        console.error('Error loading tournament data:', error);
                        $scope.loading = false;
                    });
            }

            /**
             * Checks if a tournament reset can be undone
             */
            function checkUndoResetStatus() {
                const tournamentId = $scope.effect.tournamentTitle;
                if (!tournamentId) return;

                backendCommunicator
                    .fireEventAsync("canUndoReset", { tournamentId })
                    .then((canUndo: boolean) => {
                        $scope.canUndoReset = canUndo;

                        if (canUndo) {
                            $scope.undoTimeRemaining = 30;
                            startUndoCountdown();
                        }
                    })
                    .catch(() => {
                        $scope.canUndoReset = false;
                    });
            }

            /**
             * Starts countdown for undo reset function
             */
            let countdownTimer: any = null;
            function startUndoCountdown() {
                if (countdownTimer) {
                    clearInterval(countdownTimer);
                }

                countdownTimer = setInterval(() => {
                    $scope.undoTimeRemaining--;
                    if ($scope.undoTimeRemaining <= 0) {
                        clearInterval(countdownTimer);
                        $scope.canUndoReset = false;
                        $scope.$apply();
                    } else {
                        $scope.$apply();
                    }
                }, 1000);
            }

            /**
             * Undoes a tournament reset
             */
            function undoResetTournament() {
                const tournamentId = $scope.effect.tournamentTitle;
                if (!tournamentId) return;

                backendCommunicator
                    .fireEventAsync("undoResetTournament", { tournamentId })
                    .then(() => {
                        clearInterval(countdownTimer);
                        $scope.canUndoReset = false;
                        loadTournamentData();
                        utilityService.showInfoModal(
                            "Tournament Reset Undone",
                            "The tournament has been restored to its previous state."
                        );
                    })
                    .catch((error: Error) => {
                        console.error("Error undoing tournament reset:", error);
                        utilityService.showErrorModal(
                            "Error",
                            "Failed to undo tournament reset."
                        );
                    });
            }

            $scope.$watch("effect.tournamentSelectionMode", (newMode: string) => {
                if (newMode === "tournamentList") {
                    loadActiveTournaments();
                }
            });

            $scope.$watch("effect.mode", (newMode: string) => {
                if (newMode === "tournamentStatus" || newMode === "removeTournament") {
                    loadActiveTournaments();
                }
            });

            $scope.$watch("effect.tournamentTitle", (newTournament: string) => {
                if (newTournament) {
                    loadTournamentData();
                }
            });

            $scope.$watch("effect.mode", (newMode: string) => {
                if (newMode === "setWinner") {
                    if (
                        !$scope.effect.playerNumber ||
                        ($scope.effect.playerNumber !== 1 &&
                            $scope.effect.playerNumber !== 2)
                    ) {
                        $scope.effect.playerNumber = 1;
                    }
                    if (!$scope.effect.matchNumber || $scope.effect.matchNumber <= 0) {
                        $scope.effect.matchNumber = 1;
                    }
                } else if (newMode === "playerActions" && !$scope.effect.playerAction) {
                    $scope.effect.playerAction = "add";
                }
            });

            /**
             * Handles UI event when effect values change
             */
            $scope.effectValueChanged = () => {
                if (
                    $scope.effect.mode === "setWinner" &&
                    $scope.effect.playerNumber !== 1 &&
                    $scope.effect.playerNumber !== 2
                ) {
                    $scope.effect.playerNumber = 1;
                }

                if (
                    $scope.effect.mode === "updateSettings" &&
                    $scope.effect.tournamentSelectionMode === "manual" &&
                    $scope.effect.setting &&
                    $scope.effect.setting.type === "maxVisibleMatches"
                ) {
                    const value = Number($scope.effect.setting.value);
                    if (isNaN(value) || value < 1) {
                        $scope.effect.setting.value = 1;
                    } else if (value > 5) {
                        $scope.effect.setting.value = 5;
                    }
                }

                $scope.validateMaxVisibleStandings = function () {
                    if ($scope.effect.setting && $scope.effect.setting.type === "maxVisibleStandings") {
                        const numVal = Number($scope.effect.setting.value);
                        if (isNaN(numVal) || numVal < 1) {
                            $scope.effect.setting.value = 1;
                        } else if (numVal > 10) {
                            $scope.effect.setting.value = 10;
                        }
                    }

                    if ($scope.effect.settings && $scope.effect.settings.maxVisibleStandings !== undefined) {
                        const numVal = Number($scope.effect.settings.maxVisibleStandings);
                        if (isNaN(numVal) || numVal < 1) {
                            $scope.effect.settings.maxVisibleStandings = 1;
                        } else if (numVal > 10) {
                            $scope.effect.settings.maxVisibleStandings = 10;
                        }
                    }
                };

                $scope.validateMaxVisibleMatches = function () {
                    if ($scope.effect.setting && $scope.effect.setting.type === "maxVisibleMatches") {
                        const numVal = Number($scope.effect.setting.value);
                        if (isNaN(numVal) || numVal < 1) {
                            $scope.effect.setting.value = 1;
                        } else if (numVal > 5) {
                            $scope.effect.setting.value = 5;
                        }
                    }

                    if ($scope.effect.settings && $scope.effect.settings.maxVisibleMatches !== undefined) {
                        const numVal = Number($scope.effect.settings.maxVisibleMatches);
                        if (isNaN(numVal) || numVal < 1) {
                            $scope.effect.settings.maxVisibleMatches = 1;
                        } else if (numVal > 5) {
                            $scope.effect.settings.maxVisibleMatches = 5;
                        }
                    }
                };

                if ($scope.effect.mode === "updateSettings") {
                    if (!$scope.effect.settings) {
                        $scope.effect.settings = {
                            format: "double-elimination",
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
                    ensureCustomBracketNameSettingsLocal($scope.effect.settings);
                }

                if ($scope.effect.mode === "tournamentStatus" && !$scope.effect.tournamentStatus) {
                    $scope.effect.tournamentStatus = "stop";
                }

                if ($scope.effect.mode === "toggleVisibility" && !$scope.effect.visibilityAction) {
                    $scope.effect.visibilityAction = "hide";
                }

                if ($scope.effect.tournamentSelectionMode === "tournamentList") {
                    loadActiveTournaments();
                }
            };

            $scope.loadActiveTournaments = loadActiveTournaments;
            $scope.loadTournamentData = loadTournamentData;
            $scope.checkUndoResetStatus = checkUndoResetStatus;
            $scope.undoResetTournament = undoResetTournament;

            loadActiveTournaments();
        },

        /**
         * Handles the actual triggering of the tournament update effect
         */
        onTriggerEvent: async (event) => {
            try {
                let tournamentId: string;
                if (event.effect.tournamentSelectionMode === "manual") {
                    tournamentId = event.effect.manualTournamentTitle.startsWith(
                        "tournament_"
                    )
                        ? event.effect.manualTournamentTitle
                        : `tournament_${event.effect.manualTournamentTitle.replace(
                            /[^a-zA-Z0-9]/g,
                            "_"
                        )}`;
                } else {
                    tournamentId = event.effect.tournamentTitle;
                }

                const tournamentExists = await tournamentManager.checkTournamentExists(
                    tournamentId
                );
                if (!tournamentExists && event.effect.mode !== "removeTournament") {
                    logger.warn(`Tournament not found: ${tournamentId}`);
                    return { success: false };
                }

                switch (event.effect.mode) {
                    case "setWinner":
                        const tournament = await tournamentManager.getTournament(tournamentId);
                        if (!tournament) {
                            logger.warn(`Tournament not found: ${tournamentId}`);
                            return { success: false };
                        }

                        let matchId: string | undefined;
                        if (event.effect.matchNumber) {
                            const match = tournament.tournamentData.currentMatches.find(
                                (m) => m.matchNumber === Number(event.effect.matchNumber)
                            );
                            if (match) {
                                matchId = match.id;
                            }
                        } else {
                            if (tournament.tournamentData.currentMatches.length > 0) {
                                matchId = tournament.tournamentData.currentMatches[0].id;
                            }
                        }

                        if (!matchId) {
                            logger.warn(`No valid match found in tournament: ${tournamentId}`);
                            return { success: false };
                        }

                        const playerNumber = event.effect.playerNumber ?? 1;
                        const drawHandling = event.effect.drawHandling || 'replay';

                        await tournamentManager.setMatchWinner(
                            tournamentId,
                            matchId,
                            playerNumber,
                            modules.eventManager,
                            drawHandling
                        );
                        break;

                    case "playerActions":
                        const playerAction = (event.effect.playerAction || "add") as PlayerActionType;
                        const playerNameInput = (event.effect.playerName || "").trim();
                        const replacementNameInput = (event.effect.replacementPlayerName || "").trim();

                        if (!playerNameInput) {
                            logger.warn(`Player name is required for player actions on ${tournamentId}`);
                            return { success: false };
                        }

                        if (playerAction === "add") {
                            await tournamentManager.addPlayer(tournamentId, playerNameInput);
                        } else if (playerAction === "remove") {
                            await tournamentManager.removePlayer(tournamentId, playerNameInput);
                        } else if (playerAction === "replace") {
                            if (!replacementNameInput) {
                                logger.warn(`Replacement name is required when replacing players on ${tournamentId}`);
                                return { success: false };
                            }
                            await tournamentManager.replacePlayer(
                                tournamentId,
                                playerNameInput,
                                replacementNameInput
                            );
                        } else {
                            logger.warn(`Unknown player action "${playerAction}" requested for ${tournamentId}`);
                            return { success: false };
                        }

                        break;

                    case "updateStyles":
                        const tournamentToStyle = await tournamentManager.getTournament(
                            tournamentId
                        );
                        if (!tournamentToStyle) {
                            logger.warn(`Tournament not found: ${tournamentId}`);
                            return { success: false };
                        }

                        if (event.effect.tournamentSelectionMode === "manual") {
                            if (event.effect.setting) {
                                const setting = event.effect.setting as SettingUpdate;

                                tournamentToStyle.tournamentData.styles = {
                                    ...tournamentToStyle.tournamentData.styles,
                                    [setting.type]: setting.value,
                                };
                            }
                        } else {
                            tournamentToStyle.tournamentData.styles = {
                                ...event.effect.styles,
                            };
                        }

                        await tournamentManager.updateTournament(
                            tournamentId,
                            tournamentToStyle
                        );

                        const overlayConfigStyles = buildTournamentOverlayConfig(
                            tournamentId,
                            tournamentToStyle
                        );
                        await webServer.sendToOverlay("tournament-updater", {
                            type: "update",
                            overlayInstance:
                                tournamentToStyle.overlayInstance ||
                                event.effect.overlayInstance ||
                                "",
                            config: overlayConfigStyles,
                        });
                        break;

                    case "updateStandings":
                        const tournamentForStandings = await tournamentManager.getTournament(tournamentId);
                        if (!tournamentForStandings) {
                            logger.warn(`Tournament not found: ${tournamentId}`);
                            return { success: false };
                        }

                        if (event.effect.tournamentSelectionMode === "manual") {
                            if (event.effect.setting) {
                                const setting = event.effect.setting as SettingUpdate;

                                if (
                                    setting.type === "showStandings" ||
                                    setting.type === "splitStandings" ||
                                    setting.type === "standingsTwoLineLayout" ||
                                    setting.type === "standingsPosition" ||
                                    setting.type === "maxVisibleStandings"
                                ) {
                                    tournamentForStandings.tournamentData.settings = {
                                        ...tournamentForStandings.tournamentData.settings,
                                        [setting.type]: setting.value,
                                    };
                                }

                                if (setting.type === "standingsPosition" && String(setting.value) === "Custom") {
                                    if (!tournamentForStandings.tournamentData.settings.standingsCustomCoords) {
                                        tournamentForStandings.tournamentData.settings.standingsCustomCoords = {
                                            top: null,
                                            bottom: null,
                                            left: null,
                                            right: null,
                                        };
                                    }
                                }

                                if (
                                    setting.type.startsWith("standings") ||
                                    setting.type.startsWith("standingRank")
                                ) {
                                    const updatedStyles = { ...tournamentForStandings.tournamentData.styles };
                                    (updatedStyles as any)[setting.type] = setting.value;
                                    tournamentForStandings.tournamentData.styles = updatedStyles;
                                }
                            }
                        } else {
                            if (event.effect.settings) {
                                tournamentForStandings.tournamentData.settings = {
                                    ...tournamentForStandings.tournamentData.settings,
                                    showStandings: event.effect.settings.showStandings,
                                    splitStandings: event.effect.settings.splitStandings,
                                    standingsTwoLineLayout: event.effect.settings.standingsTwoLineLayout,
                                    maxVisibleStandings: event.effect.settings.maxVisibleStandings,
                                    standingsPosition: event.effect.settings.standingsPosition,
                                    standingsCustomCoords: event.effect.settings.standingsCustomCoords,
                                };
                            }

                            if (event.effect.styles) {
                                const standingsStyleProps = [
                                    "standingsBgColor", "standingsPlayerBgColor", "standingsStatsBgColor",
                                    "standingsBorderColor", "standingsTitleColor", "standingsPlayerNameColor",
                                    "standingsPointsColor", "standingsRecordColor",
                                    "standingRank1BgColor", "standingRank1TextColor",
                                    "standingRank2BgColor", "standingRank2TextColor",
                                    "standingRank3BgColor", "standingRank3TextColor",
                                    "standingRank4BgColor", "standingRank4TextColor",
                                    "standingRank5BgColor", "standingRank5TextColor",
                                    "standingRankOthersBgColor", "standingRankOthersTextColor"
                                ];

                                const updatedStyles = { ...tournamentForStandings.tournamentData.styles };

                                for (const prop of standingsStyleProps) {
                                    if (event.effect.styles[prop as keyof typeof event.effect.styles] !== undefined) {
                                        (updatedStyles as any)[prop] = event.effect.styles[prop as keyof typeof event.effect.styles];
                                    }
                                }

                                tournamentForStandings.tournamentData.styles = updatedStyles;
                            }
                        }

                        await tournamentManager.updateTournament(
                            tournamentId,
                            tournamentForStandings
                        );

                        const overlayConfigStandings = buildTournamentOverlayConfig(
                            tournamentId,
                            tournamentForStandings
                        );
                        await webServer.sendToOverlay("tournament-updater", {
                            type: "update",
                            overlayInstance:
                                tournamentForStandings.overlayInstance ||
                                event.effect.overlayInstance ||
                                "",
                            config: overlayConfigStandings,
                        });
                        break;

                    case "updateSettings":
                        const tournamentToUpdate = await tournamentManager.getTournament(tournamentId);
                        if (!tournamentToUpdate) {
                            logger.warn(`Tournament not found: ${tournamentId}`);
                            return { success: false };
                        }
                        const tournamentSnapshotBeforeUpdate = JSON.parse(
                            JSON.stringify(tournamentToUpdate)
                        ) as TournamentState;
                        const originalFormat =
                            tournamentSnapshotBeforeUpdate.tournamentData.settings?.format ||
                            "double-elimination";
                        ensureCustomBracketNameSettings(tournamentToUpdate.tournamentData.settings);

                        if (event.effect.tournamentSelectionMode === "manual") {
                            if (event.effect.setting) {
                                const setting = event.effect.setting as SettingUpdate;

                                if (
                                    setting.type === "showSeed" ||
                                    setting.type === "showBracket" ||
                                    setting.type === "animateMatches" ||
                                    setting.type === "showWinnerDisplay" ||
                                    setting.type === "winnerGraphicType" ||
                                    setting.type === "winnerImageMode" ||
                                    setting.type === "winnerImageUrl" ||
                                    setting.type === "winnerImageFile" ||
                                    setting.type === "showWins" ||
                                    setting.type === "showLosses" ||
                                    setting.type === "showRecord" ||
                                    setting.type === "twoLineLayout" ||
                                    setting.type === "coloredStatBadges" ||
                                    setting.type === "maxVisibleMatches" ||
                                    setting.type === "format" ||
                                    setting.type === "useManualShortNames" ||
                                    setting.type === "showStandings" ||
                                    setting.type === "splitStandings" ||
                                    setting.type === "standingsTwoLineLayout" ||
                                    setting.type === "maxVisibleStandings"
                                ) {
                                    tournamentToUpdate.tournamentData.settings = {
                                        ...tournamentToUpdate.tournamentData.settings,
                                        [setting.type]: setting.value,
                                    };
                                }

                                if (setting.type === "displayDuration") {
                                    tournamentToUpdate.tournamentData.settings.displayDuration = Number(setting.value);
                                }

                                if (
                                    Object.prototype.hasOwnProperty.call(
                                        DEFAULT_CUSTOM_BRACKET_NAMES,
                                        setting.type
                                    )
                                ) {
                                    ensureCustomBracketNameSettings(tournamentToUpdate.tournamentData.settings);
                                    const bracketKey = setting.type as BracketNameSettingKey;
                                    const newValue =
                                        setting.value !== undefined && setting.value !== null
                                            ? String(setting.value)
                                            : "";
                                    if (!tournamentToUpdate.tournamentData.settings.customBracketNames) {
                                        tournamentToUpdate.tournamentData.settings.customBracketNames = {
                                            ...DEFAULT_CUSTOM_BRACKET_NAMES
                                        };
                                    }
                                    tournamentToUpdate.tournamentData.settings.customBracketNames[bracketKey] = newValue;
                                }

                                if (setting.type === "standingsPosition") {
                                    tournamentToUpdate.tournamentData.settings.standingsPosition = String(setting.value);

                                    if (
                                        String(setting.value) === "Custom" &&
                                        !tournamentToUpdate.tournamentData.settings.standingsCustomCoords
                                    ) {
                                        tournamentToUpdate.tournamentData.settings.standingsCustomCoords = {
                                            top: null,
                                            bottom: null,
                                            left: null,
                                            right: null,
                                        };
                                    }
                                }

                                if (tournamentToUpdate.tournamentData.settings.format === "round-robin") {
                                    if (!tournamentToUpdate.tournamentData.settings.roundRobinSettings) {
                                        tournamentToUpdate.tournamentData.settings.roundRobinSettings = {
                                            pointsPerWin: 3,
                                            pointsPerDraw: 1,
                                            pointsPerLoss: 0,
                                            allowDraws: false
                                        };
                                    }

                                    const oldSettings = {
                                        pointsPerWin: tournamentToUpdate.tournamentData.settings.roundRobinSettings.pointsPerWin,
                                        pointsPerDraw: tournamentToUpdate.tournamentData.settings.roundRobinSettings.pointsPerDraw,
                                        pointsPerLoss: tournamentToUpdate.tournamentData.settings.roundRobinSettings.pointsPerLoss
                                    };

                                    let pointValuesChanged = false;

                                    if (setting.type === "allowDraws") {
                                        tournamentToUpdate.tournamentData.settings.roundRobinSettings.allowDraws =
                                            Boolean(setting.value);
                                    }
                                    else if (setting.type === "pointsPerWin") {
                                        const newValue = Number(setting.value);
                                        tournamentToUpdate.tournamentData.settings.roundRobinSettings.pointsPerWin = newValue;
                                        pointValuesChanged = true;
                                    }
                                    else if (setting.type === "pointsPerDraw") {
                                        const newValue = Number(setting.value);
                                        tournamentToUpdate.tournamentData.settings.roundRobinSettings.pointsPerDraw = newValue;
                                        pointValuesChanged = true;
                                    }
                                    else if (setting.type === "pointsPerLoss") {
                                        const newValue = Number(setting.value);
                                        tournamentToUpdate.tournamentData.settings.roundRobinSettings.pointsPerLoss = newValue;
                                        pointValuesChanged = true;
                                    }

                                    await tournamentManager.updateTournament(tournamentId, tournamentToUpdate);

                                    if (pointValuesChanged && tournamentToUpdate.tournamentData.completedMatches.length > 0) {
                                        await tournamentManager.recalculateStandings(tournamentId);
                                    }
                                }
                            }
                        } else {
                            if (event.effect.settings) {
                                let oldRRSettings = null;
                                if (tournamentToUpdate.tournamentData.settings.format === "round-robin" &&
                                    tournamentToUpdate.tournamentData.settings.roundRobinSettings) {
                                    oldRRSettings = {
                                        pointsPerWin: tournamentToUpdate.tournamentData.settings.roundRobinSettings.pointsPerWin,
                                        pointsPerDraw: tournamentToUpdate.tournamentData.settings.roundRobinSettings.pointsPerDraw,
                                        pointsPerLoss: tournamentToUpdate.tournamentData.settings.roundRobinSettings.pointsPerLoss
                                    };
                                }

                                tournamentToUpdate.tournamentData.settings = {
                                    ...tournamentToUpdate.tournamentData.settings,
                                    ...event.effect.settings
                                };
                                ensureCustomBracketNameSettings(tournamentToUpdate.tournamentData.settings);

                                if (tournamentToUpdate.tournamentData.settings.format === "round-robin" &&
                                    !tournamentToUpdate.tournamentData.settings.roundRobinSettings) {
                                    tournamentToUpdate.tournamentData.settings.roundRobinSettings = {
                                        pointsPerWin: 3,
                                        pointsPerDraw: 1,
                                        pointsPerLoss: 0,
                                        allowDraws: false
                                    };
                                }

                                if (tournamentToUpdate.tournamentData.settings.format === "round-robin" &&
                                    event.effect.settings.roundRobinSettings) {

                                    const oldRRSettings = {
                                        pointsPerWin: tournamentToUpdate.tournamentData.settings.roundRobinSettings.pointsPerWin,
                                        pointsPerDraw: tournamentToUpdate.tournamentData.settings.roundRobinSettings.pointsPerDraw,
                                        pointsPerLoss: tournamentToUpdate.tournamentData.settings.roundRobinSettings.pointsPerLoss
                                    };

                                    const newRRSettings = event.effect.settings.roundRobinSettings;
                                    if (newRRSettings.allowDraws !== undefined) {
                                        tournamentToUpdate.tournamentData.settings.roundRobinSettings.allowDraws =
                                            Boolean(newRRSettings.allowDraws);
                                    }

                                    if (newRRSettings.pointsPerWin !== undefined) {
                                        tournamentToUpdate.tournamentData.settings.roundRobinSettings.pointsPerWin =
                                            Number(newRRSettings.pointsPerWin);
                                    }

                                    if (newRRSettings.pointsPerDraw !== undefined) {
                                        tournamentToUpdate.tournamentData.settings.roundRobinSettings.pointsPerDraw =
                                            Number(newRRSettings.pointsPerDraw);
                                    }

                                    if (newRRSettings.pointsPerLoss !== undefined) {
                                        tournamentToUpdate.tournamentData.settings.roundRobinSettings.pointsPerLoss =
                                            Number(newRRSettings.pointsPerLoss);
                                    }

                                    await tournamentManager.updateTournament(tournamentId, tournamentToUpdate);

                                    if (tournamentToUpdate.tournamentData.completedMatches.length > 0) {
                                        const newSettings = tournamentToUpdate.tournamentData.settings.roundRobinSettings;
                                        const pointValuesChanged =
                                            oldRRSettings.pointsPerWin !== newSettings.pointsPerWin ||
                                            oldRRSettings.pointsPerDraw !== newSettings.pointsPerDraw ||
                                            oldRRSettings.pointsPerLoss !== newSettings.pointsPerLoss;

                                        if (pointValuesChanged) {
                                            await tournamentManager.recalculateStandings(tournamentId);
                                        }
                                    }
                                }
                            }
                        }

                        const updatedFormat =
                            tournamentToUpdate.tournamentData.settings?.format || originalFormat;
                        const formatChanged = updatedFormat !== originalFormat;

                        if (formatChanged) {
                            await tournamentManager.updateTournament(
                                tournamentId,
                                tournamentToUpdate
                            );

                            await tournamentManager.resetTournamentWithUndo(tournamentId, {
                                snapshotOverride: tournamentSnapshotBeforeUpdate,
                            });

                            break;
                        }

                        await tournamentManager.updateTournament(
                            tournamentId,
                            tournamentToUpdate
                        );

                        const overlayConfigSettings = buildTournamentOverlayConfig(
                            tournamentId,
                            tournamentToUpdate
                        );
                        await webServer.sendToOverlay("tournament-updater", {
                            type: "update",
                            overlayInstance:
                                tournamentToUpdate.overlayInstance ||
                                event.effect.overlayInstance ||
                                "",
                            config: overlayConfigSettings,
                        });
                        break;

                    case "updatePosition":
                        const tournamentToPosition = await tournamentManager.getTournament(
                            tournamentId
                        );
                        if (!tournamentToPosition) {
                            logger.warn(`Tournament not found: ${tournamentId}`);
                            return { success: false };
                        }

                        let position = event.effect.position;
                        if (position === "Random") {
                            const presetPositions = [
                                "Top Left",
                                "Top Middle",
                                "Top Right",
                                "Middle Left",
                                "Middle",
                                "Middle Right",
                                "Bottom Left",
                                "Bottom Middle",
                                "Bottom Right",
                            ];
                            const randomIndex = Math.floor(
                                Math.random() * presetPositions.length
                            );
                            position = presetPositions[randomIndex];
                        }

                        tournamentToPosition.position = position;
                        tournamentToPosition.customCoords = event.effect.customCoords;

                        await tournamentManager.updateTournament(
                            tournamentId,
                            tournamentToPosition
                        );

                        const overlayConfigPosition = buildTournamentOverlayConfig(
                            tournamentId,
                            tournamentToPosition
                        );
                        await webServer.sendToOverlay("tournament-updater", {
                            type: "update",
                            overlayInstance:
                                tournamentToPosition.overlayInstance ||
                                event.effect.overlayInstance ||
                                "",
                            config: overlayConfigPosition,
                        });
                        break;

                    case "updateOverlayInstance":
                        const tournamentToInstance = await tournamentManager.getTournament(
                            tournamentId
                        );
                        if (!tournamentToInstance) {
                            logger.warn(`Tournament not found: ${tournamentId}`);
                            return { success: false };
                        }

                        tournamentToInstance.overlayInstance =
                            event.effect.overlayInstance || "";

                        await tournamentManager.updateTournament(
                            tournamentId,
                            tournamentToInstance
                        );

                        const overlayConfigInstance = buildTournamentOverlayConfig(
                            tournamentId,
                            tournamentToInstance
                        );
                        await webServer.sendToOverlay("tournament-updater", {
                            type: "update",
                            overlayInstance:
                                tournamentToInstance.overlayInstance ||
                                event.effect.overlayInstance ||
                                "",
                            config: overlayConfigInstance,
                        });
                        break;

                    case "toggleVisibility":
                        const visibilityAction = event.effect
                            .visibilityAction as VisibilityAction;

                        const tournamentToToggle = await tournamentManager.getTournament(
                            tournamentId
                        );
                        if (!tournamentToToggle) {
                            logger.warn(`Tournament not found: ${tournamentId}`);
                            return { success: false };
                        }

                        if (visibilityAction === "hide") {
                            await webServer.sendToOverlay("tournament-updater", {
                                type: "hide",
                                overlayInstance:
                                    tournamentToToggle.overlayInstance ||
                                    event.effect.overlayInstance ||
                                    "",
                                config: {
                                    tournamentTitle: tournamentId.replace("tournament_", ""),
                                },
                            });
                        } else {
                            const overlayConfigToggle = buildTournamentOverlayConfig(
                                tournamentId,
                                tournamentToToggle
                            );
                            await webServer.sendToOverlay("tournament-updater", {
                                type: "show",
                                overlayInstance:
                                    tournamentToToggle.overlayInstance ||
                                    event.effect.overlayInstance ||
                                    "",
                                config: overlayConfigToggle,
                            });
                        }
                        break;

                    case "tournamentStatus":
                        const statusAction = event.effect.tournamentStatus;

                        if (statusAction === "stop") {
                            await tournamentManager.endTournament(
                                tournamentId,
                                modules.eventManager,
                                true
                            );
                        } else if (statusAction === "start") {
                            await tournamentManager.startTournament(
                                tournamentId,
                                modules.eventManager
                            );
                        }
                        break;

                    case "resetTournament":
                        await tournamentManager.resetTournamentWithUndo(tournamentId);

                        frontendCommunicator.send("tournamentReset", tournamentId);
                        break;

                    case "undoReset":
                        await tournamentManager.undoReset(tournamentId);
                        break;

                    case "removeTournament":
                        await tournamentManager.removeTournament(tournamentId);
                        await webServer.sendToOverlay("tournament-updater", {
                            type: "remove",
                            config: {
                                tournamentTitle: tournamentId.replace("tournament_", ""),
                            },
                        });
                        break;
                }

                return { success: true };
            } catch (error) {
                logger.error("Tournament Update Error:", error);
                return { success: false };
            }
        },
        overlayExtension: {
            dependencies: {
                css: [],
            },
            event: {
                name: "tournament-updater",
                onOverlayEvent: (data: unknown) => {
                    const eventData = data as {
                        type: string;
                        config?: any;
                        overlayInstance?: string;
                    };

                    if (!eventData.config) return;

                    const tournamentId = `tournament_${eventData.config.tournamentTitle.replace(
                        /[^a-zA-Z0-9]/g,
                        "_"
                    )}`;

                    const executeScript = (scriptContent: string) => {
                        const script = document.createElement("script");
                        script.textContent = scriptContent;
                        document.body.appendChild(script);
                        script.remove();
                    };

                    switch (eventData.type) {
                        case "update":
                            executeScript(`
                                (function() {
                                    const splitStandingsId = '${tournamentId}_standings_split';
                                    const existingSplitStandings = document.getElementById(splitStandingsId);
                                    
                                    const settings = ${JSON.stringify(eventData.config.settings || eventData.config.display || {})};
                                    
                                    if (existingSplitStandings && (!settings.showStandings || !settings.splitStandings)) {
                                        existingSplitStandings.remove();
                                        console.log('Removed split standings: ' + splitStandingsId);
                                    }
                                    const existingWrapper = document.getElementById('${tournamentId}');
                                    
                                    if (existingWrapper) {
                                        const position = ${JSON.stringify(eventData.config.position || "middle")};
                                        const positionClass = position.toLowerCase().replace(' ', '-');
                                        existingWrapper.className = 'position-wrapper ' + positionClass;
                                        
                                        const innerPosition = existingWrapper.querySelector('.inner-position');
                                        if (innerPosition) {
                                            innerPosition.style.position = '';
                                            innerPosition.style.top = '';
                                            innerPosition.style.bottom = '';
                                            innerPosition.style.left = '';
                                            innerPosition.style.right = '';
                                            innerPosition.style.margin = '20px';
                                            
                                            if (position === 'Custom' && ${JSON.stringify(eventData.config.customCoords)}) {
                                                const coords = ${JSON.stringify(eventData.config.customCoords)};
                                                innerPosition.style.position = 'absolute';
                                                innerPosition.style.margin = '0';
                                                if (coords.top !== null) innerPosition.style.top = coords.top + 'px';
                                                if (coords.bottom !== null) innerPosition.style.bottom = coords.bottom + 'px';
                                                if (coords.left !== null) innerPosition.style.left = coords.left + 'px';
                                                if (coords.right !== null) innerPosition.style.right = coords.right + 'px';
                                            }
                                        }
                                        
                                        existingWrapper.style.display = '';
                                        
                                        const tournamentView = existingWrapper.querySelector('.tournament-view');
                                        if (tournamentView) {
                                            tournamentView.classList.remove('hidden');
                                        }
                                        
                                        const winnerDisplays = document.querySelectorAll('.winner-display');
                                        winnerDisplays.forEach(display => display.remove());
                                        
                                        const configData = JSON.parse(JSON.stringify(${JSON.stringify(eventData.config)}));
                                        
                                        if (!configData.ended) {
                                            const existingTournament = window.tournamentConfigs && 
                                                window.tournamentConfigs['${tournamentId}'];
                                            if (existingTournament && existingTournament.ended) {
                                                configData.ended = true;
                                            }
                                        }
                                        
                                        if (!window.tournamentConfigs) window.tournamentConfigs = {};
                                        window.tournamentConfigs['${tournamentId}'] = configData;
                                        
                                        window.dispatchEvent(new CustomEvent('tournamentSystemUpdate', {
                                            detail: {
                                                config: configData
                                            }
                                        }));
                                    } else {
                                        fetch('http://${window.location.hostname}:7472/integrations/tournament-system/tournament-system.html')
                                            .then(response => response.text())
                                            .then(template => {
                                                if (!window.tournamentConfigs) window.tournamentConfigs = {};
                                                
                                                const configData = JSON.parse(JSON.stringify(${JSON.stringify(eventData.config)}));
                                                window.tournamentConfigs['${tournamentId}'] = configData;
                                                
                                                const configString = JSON.stringify({
                                                    ...configData,
                                                    widgetId: '${tournamentId}'
                                                }, null, 2);
                                                
                                                const position = ${JSON.stringify(eventData.config.position || "middle")};
                                                const positionClass = position.toLowerCase().replace(' ', '-');
                                                const wrapper = document.createElement('div');
                                                wrapper.id = '${tournamentId}';
                                                wrapper.className = 'position-wrapper ' + positionClass;
                                                
                                                const innerPosition = document.createElement('div');
                                                innerPosition.className = 'inner-position';
                                                
                                                if (position === 'Custom' && ${JSON.stringify(eventData.config.customCoords)}) {
                                                    const coords = ${JSON.stringify(eventData.config.customCoords)};
                                                    innerPosition.style.position = 'absolute';
                                                    innerPosition.style.margin = '0';
                                                    if (coords.top !== null) innerPosition.style.top = coords.top + 'px';
                                                    if (coords.bottom !== null) innerPosition.style.bottom = coords.bottom + 'px';
                                                    if (coords.left !== null) innerPosition.style.left = coords.left + 'px';
                                                    if (coords.right !== null) innerPosition.style.right = coords.right + 'px';
                                                } else {
                                                    innerPosition.style.margin = '20px';
                                                }
                                                
                                                const updatedTemplate = template
                                                    .replace(/const CONFIG = {[\\s\\S]*?};/, 'const CONFIG = ' + configString + ';')
                                                    .replace('<div class="tournamentOverlay"', '<div class="tournamentOverlay"');
                                                
                                                innerPosition.innerHTML = updatedTemplate;
                                                wrapper.appendChild(innerPosition);
                                                $("#wrapper").append(wrapper);
                                                
                                                console.log('Tournament element created during update: ${tournamentId}');
                                            })
                                            .catch(error => {
                                                console.error('Failed to load tournament template:', error);
                                            });
                                    }
                                })();
                            `);
                            break;

                        case "remove":
                            executeScript(`
                                document.querySelectorAll('#${tournamentId}').forEach(wrapper => {
                                    wrapper.remove();
                                });
                                
                                document.querySelectorAll('#${tournamentId}_standings_split').forEach(wrapper => {
                                    wrapper.remove();
                                });
                            `);
                            break;

                        case "hide":
                            executeScript(`
                                document.querySelectorAll('#${tournamentId}').forEach(wrapper => {
                                    wrapper.style.display = 'none';
                                });
                                
                                document.querySelectorAll('#${tournamentId}_standings_split').forEach(wrapper => {
                                    wrapper.style.display = 'none';
                                });
                            `);
                            break;

                        case "show":
                            executeScript(`
                                (function() {
                                    const tournamentId = 'tournament_${eventData.config.tournamentTitle.replace(
                                /[^a-zA-Z0-9]/g,
                                "_"
                            )}';
                                    const existingWrapper = document.getElementById(tournamentId);
                                    const splitStandings = document.getElementById(tournamentId + '_standings_split');
                                    if (splitStandings) {
                                        splitStandings.style.display = '';
                                    }
                                    
                                    if (existingWrapper) {
                                        existingWrapper.style.display = '';
                                        
                                        if (${JSON.stringify(eventData.config.position)}) {
                                            const position = ${JSON.stringify(eventData.config.position)};
                                            const positionClass = position.toLowerCase().replace(' ', '-');
                                            existingWrapper.className = 'position-wrapper ' + positionClass;
                                            
                                            const innerPosition = existingWrapper.querySelector('.inner-position');
                                            if (innerPosition) {
                                                innerPosition.style.position = '';
                                                innerPosition.style.top = '';
                                                innerPosition.style.bottom = '';
                                                innerPosition.style.left = '';
                                                innerPosition.style.right = '';
                                                innerPosition.style.margin = '20px';
                                                
                                                if (position === 'Custom' && ${JSON.stringify(eventData.config.customCoords)}) {
                                                    const coords = ${JSON.stringify(eventData.config.customCoords)};
                                                    innerPosition.style.position = 'absolute';
                                                    innerPosition.style.margin = '0';
                                                    if (coords.top !== null) innerPosition.style.top = coords.top + 'px';
                                                    if (coords.bottom !== null) innerPosition.style.bottom = coords.bottom + 'px';
                                                    if (coords.left !== null) innerPosition.style.left = coords.left + 'px';
                                                    if (coords.right !== null) innerPosition.style.right = coords.right + 'px';
                                                }
                                            }
                                        }
                                        
                                        window.dispatchEvent(new CustomEvent('tournamentSystemUpdate', {
                                            detail: {
                                                config: ${JSON.stringify(eventData.config)}
                                            }
                                        }));
                                    } else {
                                        fetch('http://${window.location.hostname}:7472/integrations/tournament-system/tournament-system.html')
                                            .then(response => response.text())
                                            .then(template => {
                                                if (!window.tournamentConfigs) window.tournamentConfigs = {};
                                                
                                                const configData = JSON.parse(JSON.stringify(${JSON.stringify(eventData.config)}));
                                                window.tournamentConfigs[tournamentId] = configData;
                                                
                                                const configString = JSON.stringify({
                                                    ...configData,
                                                    widgetId: tournamentId
                                                }, null, 2);
                                                
                                                const position = ${JSON.stringify(eventData.config.position || "middle")};
                                                const positionClass = position.toLowerCase().replace(' ', '-');
                                                const wrapper = document.createElement('div');
                                                wrapper.id = tournamentId;
                                                wrapper.className = 'position-wrapper ' + positionClass;
                                                
                                                const innerPosition = document.createElement('div');
                                                innerPosition.className = 'inner-position';
                                                
                                                if (position === 'Custom' && ${JSON.stringify(eventData.config.customCoords)}) {
                                                    const coords = ${JSON.stringify(eventData.config.customCoords)};
                                                    innerPosition.style.position = 'absolute';
                                                    innerPosition.style.margin = '0';
                                                    if (coords.top !== null) innerPosition.style.top = coords.top + 'px';
                                                    if (coords.bottom !== null) innerPosition.style.bottom = coords.bottom + 'px';
                                                    if (coords.left !== null) innerPosition.style.left = coords.left + 'px';
                                                    if (coords.right !== null) innerPosition.style.right = coords.right + 'px';
                                                } else {
                                                    innerPosition.style.margin = '20px';
                                                }
                                                
                                                const updatedTemplate = template
                                                    .replace(/const CONFIG = {[\\s\\S]*?};/, 'const CONFIG = ' + configString + ';')
                                                    .replace('<div class="tournamentOverlay"', '<div class="tournamentOverlay"');
                                                
                                                innerPosition.innerHTML = updatedTemplate;
                                                wrapper.appendChild(innerPosition);
                                                $("#wrapper").append(wrapper);
                                                
                                                console.log('Tournament element created: ' + tournamentId);
                                            })
                                            .catch(error => {
                                                console.error('Failed to load tournament template:', error);
                                            });
                                    }
                                })();
                            `);
                            break;
                    }
                },
            },
        },
    };

    return updaterEffectType;
}
