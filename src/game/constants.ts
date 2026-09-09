/**
 * Tailles d'équipe par nombre de joueurs puis par mission (1–5).
 * Aligné sur les règles Avalon / The Resistance standard.
 */
export const QUEST_TEAM_SIZES: Record<number, readonly number[]> = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
};

/** À partir de 7 joueurs, la quête 4 échoue s'il y a au moins 2 cartes Échec. */
export function failsToFailMission(playerCount: number, missionIndex: number): number {
  if (playerCount >= 7 && missionIndex === 3) return 2;
  return 1;
}

export const ROLE_LABELS_FR: Record<string, string> = {
  loyal_servant: 'Loyal serviteur d’Arthur',
  merlin: 'Merlin',
  percival: 'Perceval',
  morgana: 'Morgane',
  assassin: 'Assassin',
  minion: 'Serviteur de Mordred',
  mordred: 'Mordred',
  oberon: 'Oberon',
};
