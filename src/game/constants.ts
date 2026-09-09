import type { Role } from './types';

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

/** Répartition officielle des camps : [Bien, Mal]. */
export const ALIGNMENT_COUNTS: Record<number, readonly [number, number]> = {
  5: [3, 2],
  6: [4, 2],
  7: [4, 3],
  8: [5, 3],
  9: [6, 3],
  10: [6, 4],
};

/** À partir de 7 joueurs, la quête 4 échoue s'il y a au moins 2 cartes Échec. */
export function failsToFailMission(playerCount: number, missionIndex: number): number {
  if (playerCount >= 7 && missionIndex === 3) return 2;
  return 1;
}

export const ROLE_LABELS_FR: Record<Role, string> = {
  loyal_servant: 'Loyal serviteur d’Arthur',
  merlin: 'Merlin',
  percival: 'Perceval',
  morgana: 'Morgane',
  assassin: 'Assassin',
  minion: 'Serviteur du Mal',
  mordred: 'Mordred',
  oberon: 'Oberon',
};

export type Alignment = 'Bien' | 'Mal';

/** Source unique utilisée par le guide et les écrans de révélation. */
export const ROLE_DETAILS: Record<Role, { alignment: Alignment; power: string }> = {
  merlin: {
    alignment: 'Bien',
    power: 'Connaît les serviteurs du Mal, sauf Mordred. Il doit rester caché.',
  },
  percival: {
    alignment: 'Bien',
    power: 'Voit Merlin et Morgane comme deux personnes possibles, sans savoir laquelle est Merlin.',
  },
  loyal_servant: {
    alignment: 'Bien',
    power: 'N’a aucun pouvoir spécial et ne peut jouer que Succès en mission.',
  },
  morgana: {
    alignment: 'Mal',
    power: 'Est connue comme méchante par les autres méchants et apparaît comme Merlin pour Perceval.',
  },
  assassin: {
    alignment: 'Mal',
    power: 'Après trois missions réussies par le Bien, désigne le joueur qu’il croit être Merlin.',
  },
  minion: {
    alignment: 'Mal',
    power: 'Connaît les autres méchants, sauf Oberon, et peut jouer Échec.',
  },
  mordred: {
    alignment: 'Mal',
    power: 'Est invisible pour Merlin, mais connu des autres méchants, sauf Oberon.',
  },
  oberon: {
    alignment: 'Mal',
    power: 'Ne connaît aucun autre méchant et n’est pas connu des autres méchants.',
  },
};
