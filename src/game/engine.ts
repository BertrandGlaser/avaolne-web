import { QUEST_TEAM_SIZES, failsToFailMission } from './constants';
import type { GameSession, Phase, Player, ProposalState } from './types';

export type PhaseEnd = Extract<Phase, 'good_win' | 'evil_win'>;

export interface SessionTransition {
  session: GameSession;
  phaseEnd?: PhaseEnd;
}

export function beginSession(players: Player[], leaderStart: number): GameSession {
  return {
    players,
    startingLeaderIndex: leaderStart,
    rejectCountThisRound: 0,
    missionRound: 0,
    leaderCursor: leaderStart,
    phaseDetail: {
      kind: 'propose',
      proposal: { leaderIndex: leaderStart, picks: [] },
    },
    votesHistory: [],
    missionsHistory: [],
  };
}

export function updateProposal(
  session: GameSession,
  patch: (proposal: ProposalState) => ProposalState,
): GameSession {
  if (session.phaseDetail.kind !== 'propose' && session.phaseDetail.kind !== 'vote') {
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
    phaseDetail: { kind: 'vote', proposal: session.phaseDetail.proposal },
  };
}

export function tallyVote(
  session: GameSession,
  votes: Record<string, boolean>,
): SessionTransition {
  if (session.phaseDetail.kind !== 'vote') return { session };
  const approve = Object.values(votes).filter(Boolean).length;
  const accepted = approve > session.players.length / 2;
  const votesHistory = [
    ...session.votesHistory,
    { proposalIndex: session.missionRound, votes },
  ];

  if (!accepted) {
    const rejectCount = session.rejectCountThisRound + 1;
    if (rejectCount >= 5) {
      return {
        session: { ...session, rejectCountThisRound: rejectCount, votesHistory },
        phaseEnd: 'evil_win',
      };
    }
    const leaderCursor = (session.leaderCursor + 1) % session.players.length;
    return {
      session: {
        ...session,
        votesHistory,
        rejectCountThisRound: rejectCount,
        leaderCursor,
        phaseDetail: {
          kind: 'propose',
          proposal: { leaderIndex: leaderCursor, picks: [] },
        },
      },
    };
  }

  const requiredTeamSize = QUEST_TEAM_SIZES[session.players.length]![session.missionRound];
  const teamIds = session.phaseDetail.proposal.picks.filter(
    (playerId, index, picks) =>
      picks.indexOf(playerId) === index && session.players.some((player) => player.id === playerId),
  );
  if (teamIds.length !== requiredTeamSize) return { session };

  return {
    session: {
      ...session,
      votesHistory,
      rejectCountThisRound: 0,
      phaseDetail: { kind: 'mission', teamIds },
    },
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
