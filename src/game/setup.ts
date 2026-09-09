import type { Player, Role } from './types';

/** Composition officielle Avalon (rôles optionnels inclus selon l'effectif). */
function rolePoolForCount(n: number): Role[] {
  switch (n) {
    case 5:
      return ['merlin', 'loyal_servant', 'loyal_servant', 'morgana', 'assassin'];
    case 6:
      return [
        'merlin',
        'percival',
        'loyal_servant',
        'loyal_servant',
        'morgana',
        'assassin',
      ];
    case 7:
      return [
        'merlin',
        'percival',
        'loyal_servant',
        'loyal_servant',
        'morgana',
        'oberon',
        'assassin',
      ];
    case 8:
      return [
        'merlin',
        'percival',
        'loyal_servant',
        'loyal_servant',
        'loyal_servant',
        'morgana',
        'assassin',
        'minion',
      ];
    case 9:
      return [
        'merlin',
        'percival',
        'loyal_servant',
        'loyal_servant',
        'loyal_servant',
        'morgana',
        'mordred',
        'assassin',
        'minion',
      ];
    case 10:
      return [
        'merlin',
        'percival',
        'loyal_servant',
        'loyal_servant',
        'loyal_servant',
        'morgana',
        'mordred',
        'assassin',
        'minion',
        'minion',
      ];
    default:
      throw new Error(`Effectif invalide: ${n} (5–10)`);
  }
}

function shuffle<T>(arr: T[], random: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function assignRoles(names: string[], random: () => number = Math.random): Player[] {
  const trimmed = names.map((s) => s.trim()).filter(Boolean);
  const n = trimmed.length;
  const pool = shuffle(rolePoolForCount(n), random);
  return trimmed.map((name, i) => ({
    id: `p-${i}-${Math.random().toString(36).slice(2, 9)}`,
    name,
    role: pool[i]!,
  }));
}

export function isEvil(role: Role): boolean {
  return (
    role === 'morgana' ||
    role === 'assassin' ||
    role === 'minion' ||
    role === 'mordred' ||
    role === 'oberon'
  );
}

export function isGood(role: Role): boolean {
  return !isEvil(role);
}
