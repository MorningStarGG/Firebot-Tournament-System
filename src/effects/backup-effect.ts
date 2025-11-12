import { Firebot } from "@crowbartools/firebot-custom-scripts-types";
import { tournamentManager } from "../utility/tournament-manager";
import backupTemplate from "../templates/backup-template.html";
import { logger } from "../logger";
import { BackupTournament, BackupEffectModel } from "../types/types";

export function tournamentSystemBackupEffectType() {
    const backupEffectType: Firebot.EffectType<BackupEffectModel> = {
        definition: {
            id: "msgg:tournament-system-backup",
            name: "Advanced Tournament Backup Manager",
            description: "View and restore backed up tournaments",
            icon: "fad fa-archive",
            categories: ["overlay"]
        },
        optionsTemplate: backupTemplate,

        /**
         * Controller for handling the effect's options UI logic
         */
        optionsController: ($scope: any, backendCommunicator: any, $q: any, utilityService: any) => {
            $scope.backupTournaments = [];
            $scope.loading = false;

            if (!$scope.effect) {
                $scope.effect = {
                    tournamentSelectionMode: 'tournamentList',
                    manualTournamentTitle: '',
                    action: 'restore'
                };
            }

            /**
             * Handles the restoration of a backed up tournament
             */
            $scope.restoreTournament = (backupId: string) => {
                const tournamentId = backupId.split('::backup::')[0];

                backendCommunicator.fireEventAsync("checkTournamentExists", { tournamentId })
                    .then((exists: boolean) => {
                        if (exists) {
                            utilityService.showConfirmationModal({
                                title: "Tournament Already Exists",
                                question: "A tournament with this name already exists. Do you want to overwrite it?",
                                confirmLabel: "Overwrite",
                                cancelLabel: "Cancel",
                                confirmBtnType: "btn-danger"
                            }).then((response: boolean) => {
                                if (response === true) {
                                    return backendCommunicator.fireEventAsync("restoreTournament", { backupId, mode: 'overwrite' });
                                }
                            }).then(() => {
                                loadBackups();
                            });
                        } else {
                            backendCommunicator.fireEventAsync("restoreTournament", { backupId })
                                .then(() => {
                                    loadBackups();
                                });
                        }
                    });
            };

            /**
             * Handles the deletion of a tournament
             */
            $scope.deleteTournament = (tournamentId: string) => {
                backendCommunicator.fireEventAsync("removeBackupTournament", { tournamentId })
                    .then(() => {
                        loadBackups();
                    });
            };

            /**
             * Loads backup tournaments from the backend
             */
            function loadBackups() {
                if ($scope.effect.tournamentSelectionMode !== 'tournamentList') return;

                $scope.loading = true;
                backendCommunicator.fireEventAsync("getBackupTournaments", {})
                    .then((backups: BackupTournament[]) => {
                        $scope.backupTournaments = backups;
                        $scope.loading = false;
                    })
                    .catch(() => {
                        $scope.backupTournaments = [];
                        $scope.loading = false;
                    });
            }

            $scope.$watch('effect.tournamentSelectionMode', (newMode: string) => {
                if (newMode === 'tournamentList') {
                    loadBackups();
                }
            });

            $scope.effectValueChanged = () => {
                loadBackups();
            };

            loadBackups();
        },

        /**
         * Handles the actual triggering of the effect
         */
        onTriggerEvent: async (event: { effect: BackupEffectModel }) => {
            if (event.effect.tournamentSelectionMode === 'manual') {
                const searchTournamentId = event.effect.manualTournamentTitle.startsWith('tournament_')
                    ? event.effect.manualTournamentTitle
                    : `tournament_${event.effect.manualTournamentTitle.replace(/[^a-zA-Z0-9]/g, '_')}`;

                if (event.effect.action === 'restore') {
                    const backupTournaments = await tournamentManager.getBackupTournaments();

                    let backupId = searchTournamentId;
                    if (!searchTournamentId.includes('::backup::')) {
                        const baseTournamentId = `tournament_${searchTournamentId.replace(/^tournament_/, '')}`;
                        const matchingBackup = backupTournaments
                            .filter(backup => backup.id!.startsWith(baseTournamentId))
                            .sort((a, b) => new Date(b.removedAt).getTime() - new Date(a.removedAt).getTime())[0];

                        if (matchingBackup) {
                            backupId = matchingBackup?.id ?? searchTournamentId;
                        }
                    }

                    try {
                        await tournamentManager.restoreTournament(backupId);
                    } catch (error) {
                        logger.warn(`No backup found for tournament: ${backupId}`);
                    }
                } else if (event.effect.action === 'remove') {
                    await tournamentManager.removeTournament(searchTournamentId);
                }
            }

            return { success: true };
        }
    };
    return backupEffectType;
}