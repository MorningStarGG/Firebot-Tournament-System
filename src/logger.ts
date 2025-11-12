/**
 * Simple logger utility for the tournament system
 */

import { Logger } from "@crowbartools/firebot-custom-scripts-types/types/modules/logger";

let logger: Logger = console;

/**
 * Initializes the logger with a Firebot logger instance
 * @param firebotLogger The Firebot logger instance to use
 */
export function initLogger(firebotLogger: Logger) {
    logger = firebotLogger;
}

/**
 * Export the logger instance
 */
export { logger };