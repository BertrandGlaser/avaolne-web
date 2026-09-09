export type Role =
  | 'loyal_servant'
  | 'merlin'
  | 'percival'
  | 'morgana'
  | 'assassin'
  | 'minion'
  | 'mordred'
  | 'oberon';

export interface Player {
  id: string;
  name: string;
  role: Role;
}

export type Phase =
  | 'home'
  | 'setup'
  | 'reveal'
  | 'playing'
  | 'good_win'
  | 'evil_win';

export interface ProposalState {
  leaderIndex: number;
  picks: Set<string>;
}

export interface VoteRecord {
  proposalIndex: number;
  votes: Record<string, boolean>;
}

export interface MissionRecord {
  roundIndex: number;
  failsShown: number;
  passed: boolean;
}

export interface GameSession {
  players: Player[];
  startingLeaderIndex: number;
  rejectCountThisRound: number;
  /** Current mission round 0–4 */
  missionRound: number;
  leaderCursor: number;
  phaseDetail:
    | { kind: 'propose'; proposal: ProposalState }
    | { kind: 'vote'; proposal: ProposalState }
    | { kind: 'mission'; teamIds: string[] }
    | { kind: 'assassin_pick'; merlinGuess?: string };
  votesHistory: VoteRecord[];
  missionsHistory: MissionRecord[];
}
