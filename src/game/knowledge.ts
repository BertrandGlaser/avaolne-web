import type { Player, Role } from './types';
import { ROLE_LABELS_FR } from './constants';
import { isEvil } from './setup';

export function roleLabel(role: Role): string {
  return ROLE_LABELS_FR[role] ?? role;
}

/** Règle officielle : Merlin voit le Mal, sauf Mordred. */
function merlinSees(viewer: Player, players: Player[]): string[] {
  const lines: string[] = [];
  for (const p of players) {
    if (p.id === viewer.id) continue;
    if (!isEvil(p.role)) continue;
    if (p.role === 'mordred') continue;
    lines.push(`${p.name} → ${roleLabel(p.role)}`);
  }
  return lines.length ? lines : ['Aucun méchant visible (cas rare).'];
}

/** Percival voit Merlin et Morgane comme « peut être Merlin ». */
function percivalSees(viewer: Player, players: Player[]): string[] {
  const ambiguous = players.filter(
    (p) => p.id !== viewer.id && (p.role === 'merlin' || p.role === 'morgana'),
  );
  if (ambiguous.length === 0) return ['Personne ne vous semble être Merlin.'];
  return ambiguous.map((p) => `${p.name} pourrait être Merlin (Merlin ou Morgane).`);
}

/** Règle officielle : Oberon est isolé ; les autres méchants se connaissent. */
function evilTeamKnowledge(viewer: Player, players: Player[]): string[] {
  if (viewer.role === 'oberon') {
    return [
      'Vous êtes Oberon : vous ne connaissez pas les autres méchants, et ils ne vous connaissent pas.',
    ];
  }
  const mates = players.filter(
    (p) => p.id !== viewer.id && isEvil(p.role) && p.role !== 'oberon',
  );
  if (mates.length === 0) {
    return ['Aucun coéquipier méchant visible.'];
  }
  return mates.map((p) => `${p.name} → ${roleLabel(p.role)}`);
}

export function knowledgeLines(viewer: Player, players: Player[]): string[] {
  const role = viewer.role;
  if (role === 'merlin') return merlinSees(viewer, players);
  if (role === 'percival') return percivalSees(viewer, players);
  if (isEvil(role)) return evilTeamKnowledge(viewer, players);
  return [
    'Vous ne voyez aucun autre rôle.',
    'Les loyaux serviteurs ne reçoivent pas d’information de départ.',
  ];
}
