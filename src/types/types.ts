// ============================================================================
// Basic Type Definitions
// ============================================================================

/**
 * Different tournament formats supported
 */
export type TournamentFormat = 'double-elimination' | 'single-elimination' | 'round-robin';

/**
 * Different modes of tournament selection
 */
export type TournamentSelectionMode = 'tournamentList' | 'manual';

/**
 * Tournament bracket stages used across the system
 */
export type BracketStage = 'winners' | 'losers' | 'final' | 'round-robin';

/**
 * Tournament lifecycle status actions
 */
export type TournamentStatus = 'start' | 'stop';

export type VisibilityAction = 'show' | 'hide';
export type BackupAction = 'restore' | 'remove';
export type PlayerActionType = 'add' | 'remove' | 'replace';

/**
 * Winner display graphic options
 */
export type WinnerGraphicType = 'trophy' | 'custom';
export type WinnerImageMode = 'url' | 'local';

// ============================================================================
// Base Interfaces
// ============================================================================

/**
 * Custom coordinates for tournament positioning
 */
export interface CustomCoords {
    top: number | null;
    bottom: number | null;
    left: number | null;
    right: number | null;
}

/**
 * Player in a tournament
 */
export interface Player {
    name: string;
    seed: number;
    wins: number;
    losses: number;
    draws?: number;
    eliminated: boolean;
}

/**
 * Match in a tournament
 */
export interface Match {
    id: string;
    matchNumber: number;
    player1: Player;
    player2: Player;
    bracket: BracketStage;
    round: number;
    isDraw?: boolean;
    resolvedRandomly?: boolean;
    winner: Player | null;
}

// ============================================================================
// Round Robin Settings
// ============================================================================

/**
 * Round Robin specific settings
 */
export interface RoundRobinSettings {
    pointsPerWin: number;
    pointsPerDraw: number;
    pointsPerLoss: number;
    allowDraws: boolean;
}

/**
 * Round Robin standings for a player
 */
export interface RoundRobinStanding {
    points: number;
    played: number;
    wins: number;
    draws: number;
    losses: number;
}

// ============================================================================
// Tournament Settings
// ============================================================================

export interface CustomBracketNames {
    winnersTitle?: string;
    winnersShortTitle?: string;
    losersTitle?: string;
    losersShortTitle?: string;
    singleEliminationTitle?: string;
    finalsTitle?: string;
}

/**
 * Tournament settings configuration
 */
export interface TournamentSettings {
    format: TournamentFormat;
    displayDuration: number;
    showSeed: boolean;
    showBracket: boolean;
    animateMatches: boolean;
    showWinnerDisplay: boolean;
    winnerGraphicType?: WinnerGraphicType;
    winnerImageMode?: WinnerImageMode;
    winnerImageUrl?: string;
    winnerImageFile?: string;
    winnerImageToken?: string;
    showWins: boolean;
    showLosses: boolean;
    showRecord: boolean;
    twoLineLayout: boolean;
    coloredStatBadges: boolean;
    maxVisibleMatches: number;
    customBracketNames?: CustomBracketNames;
    useManualShortNames?: boolean;
    showStandings: boolean;
    splitStandings: boolean;
    standingsTwoLineLayout: boolean;
    maxVisibleStandings: number;
    standingsPosition: string;
    standingsCustomCoords: CustomCoords;
    roundRobinSettings: RoundRobinSettings;
}

// ============================================================================
// Display & Style Configuration
// ============================================================================

/**
 * Visual styling configuration for tournaments
 */
export interface TournamentStyles {
    backgroundColor: string;
    accentColor: string;
    textColor: string;
    titleColor: string;
    fontSize: string;
    winnerColor: string;
    winnerTextColor?: string;
    winnerRecordColor?: string;
    loserColor: string;
    borderColor: string;
    shadowColor: string;
    playerCardColor: string;
    statsCardColor: string;
    seedBadgeColor: string;
    percentageBadgeColor: string;
    tournamentScale: number;
    nameTextColor: string;
    statsTextColor: string;
    seedBadgeTextColor?: string;
    winsBadgeTextColor?: string;
    lossesBadgeTextColor?: string;
    percentageBadgeTextColor?: string;
    standingsBgColor?: string;
    standingsPlayerBgColor?: string;
    standingsStatsBgColor?: string;
    standingsBorderColor?: string;
    standingsTitleColor?: string;
    standingsPointsColor?: string;
    standingsRecordColor?: string;
    standingsPlayerNameColor?: string;
    standingRank1BgColor?: string;
    standingRank1TextColor?: string;
    standingRank2BgColor?: string;
    standingRank2TextColor?: string;
    standingRank3BgColor?: string;
    standingRank3TextColor?: string;
    standingRank4BgColor?: string;
    standingRank4TextColor?: string;
    standingRank5BgColor?: string;
    standingRank5TextColor?: string;
    standingRankOthersBgColor?: string;
    standingRankOthersTextColor?: string;
}

// ============================================================================
// Tournament Configuration
// ============================================================================

/**
 * Core tournament data structure
 */
export interface TournamentData {
    players: Player[];
    winnersPlayers: Player[];
    losersPlayers: Player[];
    eliminatedPlayers: Player[];
    currentMatches: Match[];
    completedMatches: Match[];
    matchCounter: number;
    winnersRound: number;
    losersRound: number;
    bracketStage: BracketStage;
    winner: Player | null;
    requireTrueFinal: boolean;
    trueFinalPlayed: boolean;
    initialPlayerCount: number;
    title: string;
    settings: TournamentSettings;
    styles: TournamentStyles;
    standings?: { [playerName: string]: RoundRobinStanding };
}

/**
 * Tournament options for creation/updating
 */
export interface TournamentOptionsConfig {
    resetOnLoad: boolean;
}

/**
 * Base configuration for creating/updating tournaments
 */
export interface BaseTournamentConfig {
    tournamentTitle: string;
    styles: TournamentStyles;
    settings: TournamentSettings;
    position: string;
    customCoords: CustomCoords;
    overlayInstance: string;
}

/**
 * Complete tournament configuration including options and data
 */
export interface TournamentConfig extends BaseTournamentConfig {
    oldTournamentTitle?: string;
    tournamentOptions: TournamentOptionsConfig;
    tournamentData?: TournamentData;
}

// ============================================================================
// State & Events
// ============================================================================

/**
 * Represents the current state of a tournament
 */
export interface TournamentState {
    uuid: string;
    tournamentData: TournamentData;
    ended: boolean;
    paused: boolean;
    manuallyEnded?: boolean;
    createdAt: string;
    updatedAt: string;
    position: string;
    customCoords: CustomCoords;
    overlayInstance: string;
}

/**
 * Backup tournament extension
 */
export interface BackupTournament extends TournamentState {
    removedAt: string;
    id?: string;
}

// ============================================================================
// Event Metadata
// ============================================================================

/**
 * Tournament start event metadata
 */
export interface TournamentStartMetadata {
    tournamentId: string;
    tournamentTitle: string;
    players: string[];
}

/**
 * Tournament match update event metadata
 */
export interface TournamentUpdateMetadata {
    tournamentId: string;
    tournamentTitle: string;
    matchNumber: number;
    player1: string;
    player2: string;
    winner: string;
    bracketStage: BracketStage;
    round: number;
    isDraw?: boolean;
    drawHandling?: string;
}

/**
 * Tournament end event metadata
 */
export interface TournamentEndMetadata {
    tournamentId: string;
    tournamentTitle: string;
    winner: string;
    matchesPlayed: number;
    duration: number;
}

// ============================================================================
// Effect Models
// ============================================================================

/**
 * Base model for tournament effects
 */
export interface BaseEffectModel extends BaseTournamentConfig {
    tournamentSelectionMode: TournamentSelectionMode;
    manualTournamentTitle?: string;
}

/**
 * Setting update types
 */
export type SettingUpdate = BooleanSetting | StyleSetting | NumericSetting | StringSetting;

/**
 * Boolean setting update
 */
export interface BooleanSetting {
    type: 'showSeed' | 'showBracket' | 'animateMatches' | 'showWinnerDisplay' |
    'showWins' | 'showLosses' | 'showRecord' | 'twoLineLayout' | 'coloredStatBadges' |
    'showStandings' | 'splitStandings' | 'standingsTwoLineLayout' | 'allowDraws' |
    'useManualShortNames';
    value: boolean;
}

/**
 * Numeric setting update
 */
export interface NumericSetting {
    type: 'maxVisibleMatches' | 'tournamentScale' | 'pointsPerWin' |
    'pointsPerDraw' | 'pointsPerLoss' | 'displayDuration' | 'maxVisibleStandings';
    value: number;
}

/**
 * String setting update
 */
export interface StringSetting {
    type: 'standingsPosition' | 'format' | 'winnersTitle' | 'losersTitle' |
    'singleEliminationTitle' | 'finalsTitle' | 'winnersShortTitle' | 'losersShortTitle' |
    'winnerGraphicType' | 'winnerImageMode' | 'winnerImageUrl' | 'winnerImageFile';
    value: string;
}

/**
 * Style setting update
 */
export interface StyleSetting {
    type: 'backgroundColor' | 'accentColor' | 'textColor' | 'titleColor' |
    'winnerColor' | 'winnerTextColor' | 'winnerRecordColor' |
    'loserColor' | 'borderColor' | 'shadowColor' |
    'tournamentScale' | 'playerCardColor' | 'statsCardColor' |
    'seedBadgeColor' | 'percentageBadgeColor' | 'nameTextColor' |
    'statsTextColor' | 'seedBadgeTextColor' | 'winsBadgeTextColor' |
    'lossesBadgeTextColor' | 'percentageBadgeTextColor' |
    'standingsBgColor' | 'standingsPlayerBgColor' | 'standingsStatsBgColor' |
    'standingsBorderColor' | 'standingsTitleColor' | 'standingsPointsColor' |
    'standingsRecordColor' | 'standingsPlayerNameColor' |
    'standingRank1BgColor' | 'standingRank1TextColor' |
    'standingRank2BgColor' | 'standingRank2TextColor' |
    'standingRank3BgColor' | 'standingRank3TextColor' |
    'standingRank4BgColor' | 'standingRank4TextColor' |
    'standingRank5BgColor' | 'standingRank5TextColor' |
    'standingRankOthersBgColor' | 'standingRankOthersTextColor';
    value: string | number;
}

/**
 * Model for match update effects
 */
export interface MatchUpdateModel extends BaseEffectModel {
    mode: 'setWinner' | 'updateStyles' | 'updateSettings' | 'updateStandings' | 'updatePosition' |
    'updateOverlayInstance' | 'toggleVisibility' | 'tournamentStatus' |
    'resetTournament' | 'undoReset' | 'removeTournament' | 'playerActions';
    matchNumber?: number;
    playerNumber?: number | string;
    drawHandling?: string;
    visibilityAction?: VisibilityAction;
    setting?: SettingUpdate;
    tournamentStatus?: TournamentStatus;
    manualTournamentTitle: string;
    tournamentOptions?: {
        displayDuration?: number;
        roundRobinSettings?: RoundRobinSettings;
    };
    playerAction?: PlayerActionType;
    playerName?: string;
    replacementPlayerName?: string;
}

/**
 * Model for backup effects
 */
export interface BackupEffectModel {
    mode?: string;
    tournamentSelectionMode: TournamentSelectionMode;
    manualTournamentTitle: string;
    action: BackupAction;
}

export interface ResetTournamentOptions {
    snapshotOverride?: TournamentState;
}

/**
 * Model for general effects
 */
export interface EffectModel extends BaseTournamentConfig {
    tournamentOptions: TournamentOptionsConfig;
}