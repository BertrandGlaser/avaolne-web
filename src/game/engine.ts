import { QUEST_TEAM_SIZES, failsToFailMission } from './constants';
import type { GameSession, Phase, Player, ProposalState } from './types';

export type PhaseEnd = Extract<Phase, 'good_win' | 'evil_win'>;

export interface SessionTransition {
  session: GameSession;
  phaseEnd?: PhaseEnd;
}

/** Crée une session vierge : aucune équipe n’est présélectionnée. */
export function beginSession(players: Player[], leaderStart: number): GameSession {
  return {
    players,
    startingLeaderIndex: leaderStart,
    missionRound: 0,
    leaderCursor: leaderStart,
    phaseDetail: {
      kind: 'propose',
      proposal: { leaderIndex: leaderStart, picks: [] },
    },
    missionsHistory: [],
  };
}

export function updateProposal(
  session: GameSession,
  patch: (proposal: ProposalState) => ProposalState,
): GameSession {
  if (session.phaseDetail.kind !== 'propose') {
    return session;
  }
  return {
    ...session,
    phaseDetail: {
      ...session.phaseDetail,
      proposal: patch(session.phaseDetail.proposal),
    },
  };
}

export function toggleProposalPick(
  session: GameSession,
  playerCount: number,
  playerId: string,
): GameSession {
  if (session.phaseDetail.kind !== 'propose') return session;
  const teamSize = QUEST_TEAM_SIZES[playerCount]![session.missionRound];
  return updateProposal(session, (proposal) => {
    const picks = proposal.picks.includes(playerId)
      ? proposal.picks.filter((id) => id !== playerId)
      : proposal.picks.length < teamSize
        ? [...proposal.picks, playerId]
        : proposal.picks;
    return { ...proposal, picks };
  });
}

export function confirmProposal(session: GameSession, playerCount: number): GameSession {
  if (session.phaseDetail.kind !== 'propose') return session;
  const teamSize = QUEST_TEAM_SIZES[playerCount]![session.missionRound];
  if (session.phaseDetail.proposal.picks.length !== teamSize) return session;
  return {
    ...session,
    phaseDetail: { kind: 'mission', teamIds: session.phaseDetail.proposal.picks },
  };
}

export function completeMission(
  session: GameSession,
  playerCount: number,
  failCount: number,
): SessionTransition {
  if (session.phaseDetail.kind !== 'mission') return { session };
  const passed = failCount < failsToFailMission(playerCount, session.missionRound);
  const missionsHistory = [
    ...session.missionsHistory,
    { roundIndex: session.missionRound, failsShown: failCount, passed },
  ];
  const successes = missionsHistory.filter((mission) => mission.passed).length;
  const failures = missionsHistory.length - successes;

  if (failures >= 3) {
    return { session: { ...session, missionsHistory }, phaseEnd: 'evil_win' };
  }
  if (successes >= 3) {
    return {
      session: { ...session, missionsHistory, phaseDetail: { kind: 'assassin_pick' } },
    };
  }

  const leaderCursor = (session.leaderCursor + 1) % session.players.length;
  const missionRound = session.missionRound + 1;
  return {
    session: {
      ...session,
      missionsHistory,
      missionRound,
      leaderCursor,
      phaseDetail: {
        kind: 'propose',
        proposal: { leaderIndex: leaderCursor, picks: [] },
      },
    },
  };
}
