import type { Player, Role } from './types';

/** Composition officielle Avalon (rôles optionnels inclus selon l'effectif). */
export function defaultRolesForCount(n: number): Role[] {
  switch (n) {
    case 5:
      return ['merlin', 'loyal_servant', 'loyal_servant', 'assassin', 'minion'];
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
        'loyal_servant',
        'morgana',
        'mordred',
        'assassin',
      ];
    case 10:
      return [
        'merlin',
        'percival',
        'loyal_servant',
        'loyal_servant',
        'loyal_servant',
        'loyal_servant',
        'morgana',
        'mordred',
        'assassin',
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

export function assignRoles(
  names: string[],
  roles?: Role[],
  random: () => number = Math.random,
): Player[] {
  const trimmed = names.map((s) => s.trim()).filter(Boolean);
  const n = trimmed.length;
  const selectedRoles = roles ?? defaultRolesForCount(n);
  if (selectedRoles.length !== n || !selectedRoles.includes('merlin')) {
    throw new Error('La composition doit contenir exactement un rôle par joueur et Merlin.');
  }
  const pool = shuffle(selectedRoles, random);
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
