import { Firebot } from "@crowbartools/firebot-custom-scripts-types";
import { TournamentState, EffectModel, TournamentSettings } from "../types/types";
import { tournamentManager } from "../utility/tournament-manager";
import mainTemplate from "../templates/main-template.html";
import { logger } from "../logger";
import { randomUUID } from "crypto";
import { webServer, settings, modules } from "../main";
import { buildTournamentOverlayConfig } from "../utility/overlay-config";

let currentTournamentState: TournamentState = {
    uuid: '',
    tournamentData: {
        players: [],
        winnersPlayers: [],
        losersPlayers: [],
        eliminatedPlayers: [],
        currentMatches: [],
        completedMatches: [],
        matchCounter: 0,
        winnersRound: 1,
        losersRound: 1,
        bracketStage: 'winners',
        winner: null,
        requireTrueFinal: false,
        trueFinalPlayed: false,
        initialPlayerCount: 0,
        title: '',
        settings: {
            format: 'double-elimination',
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
            customBracketNames: {
                winnersTitle: 'Winners Bracket',
                losersTitle: 'Losers Bracket',
                singleEliminationTitle: 'Tournament Bracket',
                finalsTitle: 'Finals'
            },
            visibilityMode: 'showAll',
            showStandings: true,
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
        styles: {
            backgroundColor: "rgba(17, 17, 17, 1)",
            accentColor: "#a60000",
            textColor: "#e3e3e3",
            titleColor: "#e3e3e3",
            fontSize: "24px",
            winnerColor: "#00cc66",
            winnerTextColor: "#ffffff",
            winnerRecordColor: "#371F06",
            loserColor: "#cc3333",
            borderColor: "#333333",
            shadowColor: "#a60000",
            playerCardColor: "#222222",
            statsCardColor: "#1a1a1a",
            seedBadgeColor: "#a60000",
            percentageBadgeColor: "#a60000",
            nameTextColor: "#ffffff",
            statsTextColor: "#d3d3d3",
            seedBadgeTextColor: "#ffffff",
            winsBadgeTextColor: "#ffffff",
            lossesBadgeTextColor: "#ffffff",
            percentageBadgeTextColor: "#ffffff",
            standingsBgColor: "#111111",
            standingsPlayerBgColor: "#222222",
            standingsStatsBgColor: "#222222",
            standingsBorderColor: "#333333",
            standingsTitleColor: "#e3e3e3",
            standingsPlayerNameColor: "#ffffff",
            standingsPointsColor: "#00cc66",
            standingsRecordColor: "#d3d3d3",
            standingRank1BgColor: "#ffd700",
            standingRank1TextColor: "#000000",
            standingRank2BgColor: "#c0c0c0",
            standingRank2TextColor: "#000000",
            standingRank3BgColor: "#cd7f32",
            standingRank3TextColor: "#000000",
            standingRank4BgColor: "#a60000",
            standingRank4TextColor: "#ffffff",
            standingRank5BgColor: "#a60000",
            standingRank5TextColor: "#ffffff",
            standingRankOthersBgColor: "#333333",
            standingRankOthersTextColor: "#ffffff",
            tournamentScale: 1
        }
    },
    ended: false,
    paused: false,
    createdAt: '',
    updatedAt: '',
    position: 'Middle',
    customCoords: {
        top: null,
        bottom: null,
        left: null,
        right: null
    },
    overlayInstance: ''
};

/**
 * Generates a random integer between min and max (inclusive)
 */
function getRandomInt(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns a random preset position for the tournament
 */
function getRandomPresetLocation(): string {
    const presetPositions = [
        'Top Left', 'Top Middle', 'Top Right',
        'Middle Left', 'Middle', 'Middle Right',
        'Bottom Left', 'Bottom Middle', 'Bottom Right'
    ];
    const randomIndex = getRandomInt(0, presetPositions.length - 1);
    return presetPositions[randomIndex];
}

/**
 * Checks if a tournament has generated any matches yet
 */
function hasGeneratedMatches(state?: TournamentState | null): boolean {
    if (!state?.tournamentData) {
        return false;
    }

    const { tournamentData } = state;
    return (
        (tournamentData.matchCounter ?? 0) > 0 ||
        (tournamentData.currentMatches?.length ?? 0) > 0 ||
        (tournamentData.completedMatches?.length ?? 0) > 0
    );
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
/**
 * Defines and exports the tournament system effect type for Firebot
 */
export function tournamentSystemEffectType() {
    const effectType: Firebot.EffectType<EffectModel> = {
        definition: {
            id: "msgg:tournament-system",
            name: "Advanced Tournament System",
            description: "Create and display a tournament (Single/Double Elimination or Round-Robin)",
            icon: "fad fa-trophy",
            categories: ["overlay"],
            dependencies: [],
            triggers: {
                command: true,
                custom_script: true,
                startup_script: true,
                api: true,
                event: true,
                hotkey: true,
                timer: true,
                counter: true,
                preset: true,
                manual: true,
            },
            outputs: []
        },

        optionsTemplate: mainTemplate,

        /**
         * Controller for handling the options interface
         * Manages the UI state and interactions for tournament configuration
         */
        optionsController: ($scope: any, backendCommunicator: any, utilityService: any) => {
            const DEFAULT_STYLES = {
                backgroundColor: "#111111",
                accentColor: "#a60000",
                textColor: "#e3e3e3",
                titleColor: "#e3e3e3",
                fontSize: "24px",
                winnerColor: "#00cc66",
                winnerTextColor: "#ffffff",
                winnerRecordColor: "#371F06",
                winnerInlineRecordColor: "#ffffff",
                loserColor: "#cc3333",
                borderColor: "#333333",
                playerCardColor: "#222222",
                statsCardColor: "#1a1a1a",
                shadowColor: "#a60000",
                tournamentScale: 1,
                nameTextColor: "#ffffff",
                statsTextColor: "#d3d3d3",
                seedBadgeColor: "#a60000",
                percentageBadgeColor: "#a60000",
                seedBadgeTextColor: "#ffffff",
                winsBadgeTextColor: "#ffffff",
                lossesBadgeTextColor: "#ffffff",
                percentageBadgeTextColor: "#ffffff",
                standingsBgColor: "#111111",
                standingsBorderColor: "#333333",
                standingsPlayerBgColor: "#222222",
                standingsStatsBgColor: "#222222",
                standingsStatusColor: "#d3d3d3",
                standingsTitleColor: "#e3e3e3",
                standingsPlayerNameColor: "#ffffff",
                standingsPointsColor: "#e3e3e3",
                standingsRecordColor: "#e3e3e3",
                standingRank1BgColor: "#ffd700",
                standingRank1TextColor: "#000000",
                standingRank2BgColor: "#c0c0c0",
                standingRank2TextColor: "#000000",
                standingRank3BgColor: "#cd7f32",
                standingRank3TextColor: "#000000",
                standingRank4BgColor: "#a60000",
                standingRank4TextColor: "#ffffff",
                standingRank5BgColor: "#a60000",
                standingRank5TextColor: "#ffffff",
                standingRankOthersBgColor: "#333333",
                standingRankOthersTextColor: "#ffffff"
            };

            const DEFAULT_SETTINGS: TournamentSettings = {
                format: 'double-elimination',
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
                customBracketNames: {
                    winnersTitle: 'Winners Bracket',
                    winnersShortTitle: 'Winners',
                    losersTitle: 'Losers Bracket',
                    losersShortTitle: 'Losers',
                    singleEliminationTitle: 'Tournament Bracket',
                finalsTitle: 'Finals'
            },
            useManualShortNames: false,
            visibilityMode: 'showAll',
            showStandings: true,
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


            const DEFAULT_TOURNAMENT_OPTIONS = {
                resetOnLoad: false
            };

            const POSITIONS = [
                'Random',
                'Top Left', 'Top Middle', 'Top Right',
                'Middle Left', 'Middle', 'Middle Right',
                'Bottom Left', 'Bottom Middle', 'Bottom Right',
                'Custom'
            ];

            function normalizeVisibilitySettings(settings: TournamentSettings): TournamentSettings {
                const visibilityMode = settings.visibilityMode ?? (settings.showStandings ? 'showAll' : 'showTournamentOnly');
                const showStandings = visibilityMode === 'hideAll' || visibilityMode === 'showTournamentOnly' ? false : true;

                return {
                    ...settings,
                    visibilityMode,
                    showStandings
                };
            }

            /**
             * Initializes default values for the tournament configuration
             */
            function initializeDefaults() {
                $scope.effect.styles = {
                    ...DEFAULT_STYLES,
                    ...($scope.effect.styles || {})
                };

                $scope.effect.settings = {
                    ...DEFAULT_SETTINGS,
                    ...($scope.effect.settings || {}),
                    roundRobinSettings: {
                        ...DEFAULT_SETTINGS.roundRobinSettings,
                        ...($scope.effect.settings?.roundRobinSettings || {})
                    },
                    standingsCustomCoords: {
                        ...DEFAULT_SETTINGS.standingsCustomCoords,
                        ...($scope.effect.settings?.standingsCustomCoords || {})
                    }
                };
                $scope.effect.settings = normalizeVisibilitySettings($scope.effect.settings);

                $scope.effect.tournamentOptions = {
                    ...DEFAULT_TOURNAMENT_OPTIONS,
                    ...($scope.effect.tournamentOptions || {})
                };

                $scope.positions = POSITIONS;
            }

            /**
             * Loads existing tournament data if available
             */
            function loadExistingTournamentData() {
                if (!$scope.effect.tournamentTitle) return;

                const sanitizedTitle = $scope.effect.tournamentTitle.replace(/[^a-zA-Z0-9]/g, '_');
                const tournamentId = `tournament_${sanitizedTitle}`;

                backendCommunicator.fireEventAsync("getTournamentData", tournamentId)
                    .then((tournamentData: any) => {
                        if (!tournamentData?.tournamentData) return;

                        if (tournamentData.tournamentData.styles) {
                            $scope.effect.styles = {
                                ...DEFAULT_STYLES,
                                ...tournamentData.tournamentData.styles
                            };
                        }

                        if (tournamentData.tournamentData.settings) {
                            $scope.effect.settings = {
                                ...DEFAULT_SETTINGS,
                                ...tournamentData.tournamentData.settings,
                                roundRobinSettings: {
                                    ...DEFAULT_SETTINGS.roundRobinSettings,
                                    ...tournamentData.tournamentData.settings.roundRobinSettings
                                },
                                standingsCustomCoords: {
                                    ...DEFAULT_SETTINGS.standingsCustomCoords,
                                    ...tournamentData.tournamentData.settings.standingsCustomCoords
                                }
                            };
                            $scope.effect.settings = normalizeVisibilitySettings($scope.effect.settings);
                        }

                    })
                    .catch((error: Error) => {
                        console.error('Error loading tournament data:', error);
                    });
            }

            /**
             * Updates conditional style defaults based on settings
             */
            function updateConditionalStyles() {
                if (!$scope.effect.settings.showSeed && $scope.effect.styles.seedBadgeColor === DEFAULT_STYLES.seedBadgeColor) {
                    $scope.effect.styles.seedBadgeColor = $scope.effect.styles.accentColor;
                }

                if (!$scope.effect.settings.showRecord && $scope.effect.styles.percentageBadgeColor === DEFAULT_STYLES.percentageBadgeColor) {
                    $scope.effect.styles.percentageBadgeColor = $scope.effect.styles.accentColor;
                }
            }

            initializeDefaults();
            loadExistingTournamentData();

            $scope.$watch('effect.settings.maxVisibleMatches', (newVal: number) => {
                if (newVal !== undefined && newVal !== null) {
                    const numVal = Number(newVal);
                    if (isNaN(numVal) || numVal < 1) {
                        $scope.effect.settings.maxVisibleMatches = 1;
                    } else if (numVal > 5) {
                        $scope.effect.settings.maxVisibleMatches = 5;
                    }
                }
            });

            $scope.$watch('effect.settings.maxVisibleStandings', (newVal: number) => {
                if (newVal !== undefined && newVal !== null) {
                    const numVal = Number(newVal);
                    if (isNaN(numVal) || numVal < 1) {
                        $scope.effect.settings.maxVisibleStandings = 1;
                    } else if (numVal > 10) {
                        $scope.effect.settings.maxVisibleStandings = 10;
                    }
                }
            });

            $scope.$watch('effect.settings.showSeed', (newVal: boolean, oldVal: boolean) => {
                if (newVal !== oldVal) {
                    updateConditionalStyles();
                }
            });

            $scope.$watch('effect.settings.showRecord', (newVal: boolean, oldVal: boolean) => {
                if (newVal !== oldVal) {
                    updateConditionalStyles();
                }
            });

            $scope.$watch('effect.settings.showWins', (newVal: boolean, oldVal: boolean) => {
                if (newVal && !$scope.effect.styles.winnerColor) {
                    $scope.effect.styles.winnerColor = DEFAULT_STYLES.winnerColor;
                }
            });

            $scope.$watch('effect.settings.showLosses', (newVal: boolean, oldVal: boolean) => {
                if (newVal && !$scope.effect.styles.loserColor) {
                    $scope.effect.styles.loserColor = DEFAULT_STYLES.loserColor;
                }
            });

            $scope.$watch('effect.settings.coloredStatBadges', (newVal: boolean, oldVal: boolean) => {
                if (newVal) {
                    if ($scope.effect.settings.showWins && !$scope.effect.styles.winnerColor) {
                        $scope.effect.styles.winnerColor = DEFAULT_STYLES.winnerColor;
                    }
                    if ($scope.effect.settings.showLosses && !$scope.effect.styles.loserColor) {
                        $scope.effect.styles.loserColor = DEFAULT_STYLES.loserColor;
                    }
                    if ($scope.effect.settings.showSeed && !$scope.effect.styles.seedBadgeColor) {
                        $scope.effect.styles.seedBadgeColor = $scope.effect.styles.accentColor || DEFAULT_STYLES.seedBadgeColor;
                    }
                    if ($scope.effect.settings.showRecord && !$scope.effect.styles.percentageBadgeColor) {
                        $scope.effect.styles.percentageBadgeColor = $scope.effect.styles.accentColor || DEFAULT_STYLES.percentageBadgeColor;
                    }
                }
            });

            $scope.$watch('effect.styles.accentColor', (newVal: string, oldVal: string) => {
                if (newVal !== oldVal) {
                    if ($scope.effect.styles.seedBadgeColor === oldVal) {
                        $scope.effect.styles.seedBadgeColor = newVal;
                    }
                    if ($scope.effect.styles.percentageBadgeColor === oldVal) {
                        $scope.effect.styles.percentageBadgeColor = newVal;
                    }
                }
            });

            $scope.showOverlayInfoModal = (overlayInstance: any) => {
                utilityService.showOverlayInfoModal(overlayInstance);
            };
        },

        /**
         * Validates the tournament configuration
         */
        optionsValidator: (effect: EffectModel) => {
            const errors = [];
            if (effect.tournamentTitle == null || effect.tournamentTitle === "") {
                errors.push("Please provide a tournament title");
            }

            if (effect.settings && effect.settings.maxVisibleMatches) {
                const maxMatches = Number(effect.settings.maxVisibleMatches);
                if (isNaN(maxMatches) || maxMatches < 1 || maxMatches > 5) {
                    errors.push("Max visible matches must be between 1 and 5");
                }
            }

            if (effect.settings && effect.settings.maxVisibleStandings) {
                const maxStandings = Number(effect.settings.maxVisibleStandings);
                if (isNaN(maxStandings) || maxStandings < 1 || maxStandings > 10) {
                    errors.push("Max visible standings must be between 1 and 10");
                }
            }

            return errors;
        },

        /**
         * Handles the actual triggering of the tournament effect
         */
        onTriggerEvent: async (event) => {
            const sanitizedTitle = event.effect.tournamentTitle.replace(/[^a-zA-Z0-9]/g, '_');
            const tournamentId = `tournament_${sanitizedTitle}`;

            try {
                if (event.effect.position === 'Random') {
                    event.effect.position = getRandomPresetLocation();
                }

                const existingTournament = await tournamentManager.getTournament(tournamentId);

                if (existingTournament && !event.effect.tournamentOptions.resetOnLoad && !existingTournament.ended) {
                    logger.info(`Updating existing active tournament ${tournamentId}`);
                    existingTournament.tournamentData.settings = event.effect.settings;
                    existingTournament.tournamentData.styles = event.effect.styles;
                    existingTournament.position = event.effect.position;
                    existingTournament.customCoords = event.effect.customCoords;
                    existingTournament.overlayInstance = event.effect.overlayInstance || '';
                    existingTournament.updatedAt = new Date().toISOString();

                    await tournamentManager.updateTournament(tournamentId, existingTournament);
                    currentTournamentState = existingTournament;
                } else {
                    if (existingTournament && existingTournament.ended) {
                        logger.info(`Existing tournament ${tournamentId} is ended. Backing up before creating new tournament.`);
                        await tournamentManager.backupTournament(tournamentId);
                    } else if (existingTournament && event.effect.tournamentOptions.resetOnLoad) {
                        logger.info(`Reset on load enabled for ${tournamentId}`);
                    } else if (!existingTournament) {
                        logger.info(`Creating new tournament ${tournamentId}`);
                    }

                    const format = event.effect.settings.format;
                    const bracketStage: 'winners' | 'losers' | 'final' | 'round-robin' =
                        format === 'round-robin' ? 'round-robin' : 'winners';

                    currentTournamentState = {
                        uuid: randomUUID(),
                        tournamentData: {
                            players: [],
                            winnersPlayers: [],
                            losersPlayers: [],
                            eliminatedPlayers: [],
                            currentMatches: [],
                            completedMatches: [],
                            matchCounter: 0,
                            winnersRound: 1,
                            losersRound: 1,
                            bracketStage,
                            winner: null,
                            requireTrueFinal: false,
                            trueFinalPlayed: false,
                            initialPlayerCount: 0,
                            title: event.effect.tournamentTitle,
                            settings: event.effect.settings,
                            styles: event.effect.styles,
                            standings: format === 'round-robin' ? {} : undefined
                        },
                        ended: false,
                        paused: false,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        position: event.effect.position,
                        customCoords: event.effect.customCoords,
                        overlayInstance: event.effect.overlayInstance || ''
                    };

                    await tournamentManager.createTournament(tournamentId, currentTournamentState);

                    logger.info(`Tournament ${tournamentId} created without players. Use the updater's Player Actions to build the roster before starting.`);

                    const updatedTournament = await tournamentManager.getTournament(tournamentId);
                    if (updatedTournament) {
                        currentTournamentState = updatedTournament;
                    }
                }

                const shouldBroadcastOverlay = hasGeneratedMatches(currentTournamentState);

                if (shouldBroadcastOverlay) {
                    const overlayConfig = buildTournamentOverlayConfig(
                        tournamentId,
                        currentTournamentState,
                        event.effect.tournamentTitle
                    );
                    const data = {
                        uuid: currentTournamentState.uuid,
                        overlayInstance: event.effect.overlayInstance,
                        config: overlayConfig
                    };

                    if (settings.useOverlayInstances()) {
                        if (event.effect.overlayInstance != null) {
                            if (settings.getOverlayInstances().includes(event.effect.overlayInstance)) {
                                data.overlayInstance = event.effect.overlayInstance;
                            }
                        }
                    }

                    await webServer.sendToOverlay("tournament-system", data);
                } else {
                    logger.info(
                        `Tournament ${tournamentId} created/updated without matches; overlay update deferred until the updater starts the bracket.`
                    );
                }

                return { success: true };
            }
            catch (error) {
                logger.error('Tournament System Error:', error);
                return { success: false };
            }
        },

        /**
         * Defines the overlay extension functionality
         * Handles how the tournament is displayed in the streaming overlay
         */
        overlayExtension: {
            dependencies: {
                css: [],
                js: []
            },
            event: {
                name: "tournament-system",
                onOverlayEvent: (data: unknown) => {
                    const tournamentConfig = data as any;
                    const type = tournamentConfig?.type ?? "update";
                    const visibilityMode = (tournamentConfig?.config?.visibilityMode ||
                        tournamentConfig?.config?.settings?.visibilityMode) as
                        | 'showAll'
                        | 'showTournamentOnly'
                        | 'showStandingsOnly'
                        | 'hideAll'
                        | undefined;

                    if (type === "remove") {
                        const title = tournamentConfig?.config?.tournamentTitle;
                        if (!title) return;
                        const sanitizedRemoveTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
                        const removeWidgetId = `tournament_${sanitizedRemoveTitle}`;
                        document
                            .querySelectorAll(`#${removeWidgetId}`)
                            .forEach(element => element.remove());
                        document
                            .querySelectorAll(`#${removeWidgetId}_standings_split`)
                            .forEach(element => element.remove());
                        return;
                    }

                    if (!tournamentConfig?.config) return;

                    const title = tournamentConfig?.config?.tournamentTitle;
                    if (!title) return;

                    const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
                    const widgetId = `tournament_${sanitizedTitle}`;
                    const standingsId = `${widgetId}_standings_split`;

                    const showTournament = (() => {
                        switch (visibilityMode) {
                            case 'showTournamentOnly':
                                return true;
                            case 'showStandingsOnly':
                                return false;
                            case 'showAll':
                                return true;
                            case 'hideAll':
                                return false;
                            default:
                                return type !== "hide";
                        }
                    })();

                    const showStandings = (() => {
                        switch (visibilityMode) {
                            case 'showTournamentOnly':
                                return false;
                            case 'showStandingsOnly':
                                return true;
                            case 'showAll':
                                return true;
                            case 'hideAll':
                                return false;
                            default:
                                return type !== "hide";
                        }
                    })();

                    const tournamentWrapperExisting = document.getElementById(widgetId);
                    const standingsExisting = document.getElementById(standingsId);
                    const hasSplitStandings = !!standingsExisting;
                    const shouldShowWrapper = showTournament || (showStandings && !hasSplitStandings);

                    const positionClass = tournamentConfig.config.position.toLowerCase().replace(' ', '-');
                    const { customCoords } = tournamentConfig.config;

                    const applyVisibilityToWrapper = (wrapper: HTMLElement | null) => {
                        if (!wrapper) return;
                        wrapper.style.display = shouldShowWrapper ? '' : 'none';

                        const matchesEl = wrapper.querySelector('#active-matches') as HTMLElement | null;
                        if (matchesEl) matchesEl.style.display = showTournament ? '' : 'none';

                        const remainingEl = wrapper.querySelector('#remaining-matches') as HTMLElement | null;
                        if (remainingEl) remainingEl.style.display = showTournament ? '' : 'none';

                        const statusEl = wrapper.querySelector('#tournament-status') as HTMLElement | null;
                        if (statusEl) statusEl.style.display = showTournament ? '' : 'none';

                        const inlineStandingsEl = wrapper.querySelector('#standings-container') as HTMLElement | null;
                        if (inlineStandingsEl) inlineStandingsEl.style.display = showStandings && !hasSplitStandings ? '' : 'none';
                    };

                    if (type === "hide" || type === "show") {
                        applyVisibilityToWrapper(tournamentWrapperExisting as HTMLElement | null);
                        if (standingsExisting) {
                            (standingsExisting as HTMLElement).style.display =
                                showStandings ? "" : "none";
                        }
                        if (type === "hide") {
                            return;
                        }
                    }

                    let tournamentWrapper = tournamentWrapperExisting;
                    if (tournamentWrapper) {
                        applyVisibilityToWrapper(tournamentWrapper as HTMLElement);
                        const split = standingsExisting;
                        if (split) {
                            split.style.display = showStandings ? '' : 'none';
                        }

                        tournamentWrapper.className = `position-wrapper ${positionClass}`;

                        const innerPosition = tournamentWrapper.querySelector('.inner-position') as HTMLElement;
                        if (innerPosition) {
                            innerPosition.style.position = '';
                            innerPosition.style.top = '';
                            innerPosition.style.bottom = '';
                            innerPosition.style.left = '';
                            innerPosition.style.right = '';
                            innerPosition.style.margin = '20px';

                            if (tournamentConfig.config.position === 'Custom' && customCoords) {
                                innerPosition.style.position = 'absolute';
                                innerPosition.style.margin = '0';
                                if (customCoords.top !== null) {
                                    innerPosition.style.top = `${customCoords.top}px`;
                                }
                                if (customCoords.bottom !== null) {
                                    innerPosition.style.bottom = `${customCoords.bottom}px`;
                                }
                                if (customCoords.left !== null) {
                                    innerPosition.style.left = `${customCoords.left}px`;
                                }
                                if (customCoords.right !== null) {
                                    innerPosition.style.right = `${customCoords.right}px`;
                                }
                            }
                        }

                        const script = document.createElement('script');
                        script.textContent = `
                            window.dispatchEvent(new CustomEvent('tournamentSystemUpdate', {
                                detail: ${JSON.stringify(tournamentConfig)}
                            }));
                        `;
                        document.body.appendChild(script);
                        script.remove();
                        return;
                    }

                    fetch(`http://${window.location.hostname}:7472/integrations/tournament-system/tournament-system.html`)
                        .then(response => response.text())
                        .then(template => {
                            const configString = JSON.stringify(tournamentConfig.config);
                            const updatedTemplate = template.replace(/const CONFIG = \{[\s\S]*?\};/, `const CONFIG = ${configString};`);

                            const existingTournaments = document.querySelectorAll(`#${widgetId}`);
                            existingTournaments.forEach(poll => poll.remove());

                            const wrapper = document.createElement('div');
                            wrapper.id = widgetId;
                            wrapper.className = `position-wrapper ${positionClass}`;
                            wrapper.style.display = shouldShowWrapper ? '' : 'none';

                            let innerHtml = `<div class="inner-position tournamentOverlay"`;

                            if (tournamentConfig.config.position === 'Custom' && customCoords) {
                                innerHtml += ` style="position: absolute;`;
                                if (customCoords.top !== null) {
                                    innerHtml += `top: ${customCoords.top}px;`;
                                }
                                if (customCoords.bottom !== null) {
                                    innerHtml += `bottom: ${customCoords.bottom}px; top: auto;`;
                                }
                                if (customCoords.left !== null) {
                                    innerHtml += `left: ${customCoords.left}px;`;
                                }
                                if (customCoords.right !== null) {
                                    innerHtml += `right: ${customCoords.right}px; left: auto;`;
                                }
                                innerHtml += `"`;
                            } else {
                                innerHtml += ` style="margin: 20px;"`;
                            }
                            innerHtml += `>${updatedTemplate}</div>`;

                            wrapper.innerHTML = innerHtml;
                            $("#wrapper").append(wrapper);

                            applyVisibilityToWrapper(wrapper);

                            setTimeout(() => {
                                const split = document.getElementById(standingsId);
                                if (split) {
                                    (split as HTMLElement).style.display = showStandings ? '' : 'none';
                                }
                            }, 0);

                            setTimeout(() => {
                                const script = document.createElement('script');
                                script.textContent = `
                                    (function() {
                                        const event = new Event('resize');
                                        window.dispatchEvent(event);
                                        
                                        if (window.ResizeObserver) {
                                            const tournamentContainer = document.querySelector('#${widgetId} .current-matches');
                                            if (tournamentContainer) {
                                                const resizeObserver = new ResizeObserver(entries => {
                                                    const event = new Event('resize');
                                                    window.dispatchEvent(event);
                                                });
                                                resizeObserver.observe(tournamentContainer);
                                            }
                                        }
                                    })();
                                `;
                                document.body.appendChild(script);
                                script.remove();
                            }, 500);
                        });
                }
            }
        }

    };
    return effectType;
}
