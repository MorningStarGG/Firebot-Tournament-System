import { TournamentSettings, TournamentState } from "../types/types";
import { modules } from "../main";
import { logger } from "../logger";

const WINNER_IMAGE_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
let warnedResourceManagerUnavailable = false;

/**
 * Creates a shallow copy of settings and, if needed, prepares a resource token
 * for winner images when using a local file.
 */
export function prepareWinnerDisplaySettings(
    settings?: TournamentSettings
): TournamentSettings | undefined {
    if (!settings) {
        return settings;
    }

    const prepared: TournamentSettings = { ...settings };

    if (prepared.winnerGraphicType !== "custom") {
        delete prepared.winnerImageToken;
        return prepared;
    }

    if (prepared.winnerImageMode === "local") {
        if (!prepared.winnerImageFile) {
            delete prepared.winnerImageToken;
            return prepared;
        }

        const tokenManager = modules?.resourceTokenManager;
        if (!tokenManager) {
            if (!warnedResourceManagerUnavailable) {
                logger.warn(
                    "Resource token manager unavailable; local winner images cannot be shared with the overlay."
                );
                warnedResourceManagerUnavailable = true;
            }
            delete prepared.winnerImageToken;
            return prepared;
        }

        try {
            prepared.winnerImageToken = tokenManager.storeResourcePath(
                prepared.winnerImageFile,
                WINNER_IMAGE_TOKEN_TTL_SECONDS
            );
        } catch (error) {
            logger.warn("Unable to prepare local winner image for overlay use.", error);
            delete prepared.winnerImageToken;
        }
    } else {
        delete prepared.winnerImageToken;
    }

    return prepared;
}

/**
 * Builds a normalized overlay config payload for the tournament overlay channel.
 */
export function buildTournamentOverlayConfig(
    tournamentId: string,
    state: TournamentState,
    displayTitle?: string
) {
    const preparedSettings = prepareWinnerDisplaySettings(state.tournamentData?.settings);

    const tournamentData = state.tournamentData
        ? {
              ...state.tournamentData,
              settings: preparedSettings,
          }
        : undefined;

    return {
        tournamentTitle: displayTitle ?? tournamentId.replace("tournament_", ""),
        tournamentData,
        styles: state.tournamentData?.styles,
        settings: preparedSettings,
        position: state.position,
        customCoords: state.customCoords,
    };
}
