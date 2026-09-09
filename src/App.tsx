import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  QUEST_TEAM_SIZES,
  failsToFailMission,
  ROLE_LABELS_FR,
} from './game/constants';
import { assignRoles, isGood } from './game/setup';
import { knowledgeLines, roleLabel } from './game/knowledge';
import type { GameSession, Phase, Player, ProposalState } from './game/types';

function emptyProposal(leaderIndex: number): ProposalState {
  return { leaderIndex, picks: new Set() };
}

type PhaseEnd = Extract<Phase, 'good_win' | 'evil_win'>;

interface SessionTransition {
  session: GameSession;
  phaseEnd?: PhaseEnd;
}

function beginSession(players: Player[], leaderStart: number): GameSession {
  return {
    players,
    startingLeaderIndex: leaderStart,
    rejectCountThisRound: 0,
    missionRound: 0,
    leaderCursor: leaderStart,
    phaseDetail: {
      kind: 'propose',
      proposal: emptyProposal(leaderStart),
    },
    votesHistory: [],
    missionsHistory: [],
  };
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('home');
  const [players, setPlayers] = useState<Player[]>([]);
  const [setupDraft, setSetupDraft] = useState('');
  const [session, setSession] = useState<GameSession | null>(null);
  const [revealIdx, setRevealIdx] = useState(0);
  const [roleHidden, setRoleHidden] = useState(true);
  /** Pendant une mission : joueur courant qui pose carte */
  const [missionTurnIdx, setMissionTurnIdx] = useState(0);
  const [pendingMissionCards, setPendingMissionCards] = useState<
    Record<string, 'success' | 'fail'>
  >({});
  const [voteTurn, setVoteTurn] = useState(0);

  const namesFromDraft = useMemo(
    () =>
      setupDraft
        .split(/\n|,/)
        .map((s) => s.trim())
        .filter(Boolean),
    [setupDraft],
  );

  const playerCount = players.length;

  function resetAll() {
    setPhase('home');
    setPlayers([]);
    setSession(null);
    setRevealIdx(0);
    setRoleHidden(true);
    setMissionTurnIdx(0);
    setPendingMissionCards({});
    setVoteTurn(0);
    setSetupDraft('');
  }

  function startSetup() {
    setPhase('setup');
    setSetupDraft('');
  }

  function launchGame() {
    const n = namesFromDraft.length;
    if (n < 5 || n > 10) return;
    const p = assignRoles(namesFromDraft);
    setPlayers(p);
    setRevealIdx(0);
    setRoleHidden(true);
    setPhase('reveal');
  }

  function finishRevealAndPlay() {
    const leaderStart = Math.floor(Math.random() * players.length);
    setSession(beginSession(players, leaderStart));
    setPhase('playing');
    setMissionTurnIdx(0);
    setPendingMissionCards({});
    setVoteTurn(0);
  }

  function countSuccesses(sessionNow: GameSession) {
    return sessionNow.missionsHistory.filter((m) => m.passed).length;
  }

  function countFailures(sessionNow: GameSession) {
    return sessionNow.missionsHistory.filter((m) => !m.passed).length;
  }

  function updateProposal(
    sess: GameSession,
    patch: (prop: ProposalState) => ProposalState,
  ): GameSession {
    if (sess.phaseDetail.kind !== 'propose' && sess.phaseDetail.kind !== 'vote') {
      return sess;
    }
    const proposal = patch(sess.phaseDetail.proposal);
    return {
      ...sess,
      phaseDetail: { ...sess.phaseDetail, proposal },
    };
  }

  function confirmProposal(sess: GameSession): GameSession {
    if (sess.phaseDetail.kind !== 'propose') return sess;
    const qs =
      QUEST_TEAM_SIZES[playerCount]?.[sess.missionRound] ??
      QUEST_TEAM_SIZES[5]![0];
    if (sess.phaseDetail.proposal.picks.size !== qs) return sess;
    return {
      ...sess,
      phaseDetail: {
        kind: 'vote',
        proposal: sess.phaseDetail.proposal,
      },
    };
  }

  function tallyVote(sess: GameSession, votes: Record<string, boolean>): SessionTransition {
    if (sess.phaseDetail.kind !== 'vote') return { session: sess };
    let approve = 0;
    let reject = 0;
    for (const p of sess.players) {
      const v = votes[p.id];
      if (v === true) approve++;
      else reject++;
    }
    const accepted = approve > reject;
    const nextHistory = [...sess.votesHistory, { proposalIndex: sess.missionRound, votes }];
    if (!accepted) {
      const rej = sess.rejectCountThisRound + 1;
      if (rej >= 5) {
        return {
          session: { ...sess, rejectCountThisRound: rej, votesHistory: nextHistory },
          phaseEnd: 'evil_win',
        };
      }
      const nextLeader = (sess.leaderCursor + 1) % sess.players.length;
      return {
        session: {
          ...sess,
          votesHistory: nextHistory,
          rejectCountThisRound: rej,
          leaderCursor: nextLeader,
          phaseDetail: {
            kind: 'propose',
            proposal: emptyProposal(nextLeader),
          },
        },
      };
    }
    const teamIds = [...sess.phaseDetail.proposal.picks];
    return {
      session: {
        ...sess,
        votesHistory: nextHistory,
        rejectCountThisRound: 0,
        phaseDetail: { kind: 'mission', teamIds },
      },
    };
  }

  function completeMission(sess: GameSession, failCount: number): SessionTransition {
    if (sess.phaseDetail.kind !== 'mission') return { session: sess };
    const needFail = failsToFailMission(playerCount, sess.missionRound);
    const passed = failCount < needFail;
    const rec = {
      roundIndex: sess.missionRound,
      failsShown: failCount,
      passed,
    };
    const missionsHistory = [...sess.missionsHistory, rec];
    const ok = countSuccesses({ ...sess, missionsHistory });
    const bad = countFailures({ ...sess, missionsHistory });
    if (bad >= 3) {
      return {
        session: {
          ...sess,
          missionsHistory,
        },
        phaseEnd: 'evil_win',
      };
    }
    if (ok >= 3) {
      return {
        session: {
          ...sess,
          missionsHistory,
          phaseDetail: { kind: 'assassin_pick' },
        },
      };
    }
    const nextLeader = (sess.leaderCursor + 1) % sess.players.length;
    const nextRound = sess.missionRound + 1;
    return {
      session: {
        ...sess,
        missionsHistory,
        missionRound: nextRound,
        leaderCursor: nextLeader,
        phaseDetail: {
          kind: 'propose',
          proposal: emptyProposal(nextLeader),
        },
      },
    };
  }

  const viewer = players[revealIdx];

  return (
    <div className="wrapper">
      <header style={{ marginBottom: '1.25rem' }}>
        <div className="header-row">
          <div>
            <h1 style={{ margin: '0 0 0.35rem', fontSize: '1.65rem' }}>Avalon</h1>
            <p className="muted" style={{ margin: 0 }}>
              Déduction sociale autour de la Table ronde — interface locale, un seul téléphone.
            </p>
          </div>
          <button type="button" className="btn" onClick={() => setPhase('docs')}>
            Guide
          </button>
          {phase !== 'home' && phase !== 'docs' && (
            <button type="button" className="btn" onClick={resetAll}>
              Nouvelle partie
            </button>
          )}
        </div>
      </header>

      {phase === 'home' && (
        <section className="panel">
          <h2>Bienvenue</h2>
            <p>
              Le jeu de déduction sociale autour de la Table ronde : trois quêtes réussies pour le
              Bien, trois échecs pour le Mal, puis l’Assassin tente de trouver Merlin.
            </p>
          <details className="rules">
            <summary>Règles courtes</summary>
            <ul className="muted">
              <li>5 à 10 joueurs, comme dans les règles officielles ; les rôles sont tirés selon l’effectif.</li>
              <li>
                À tour de rôle, un chef propose une équipe ; tout le monde vote ; si la mission part,
                les membres jouent Succès ou Échec (les Loyaux ne peuvent jouer que Succès).
              </li>
              <li>
                Après 5 propositions refusées d’affilée pour une même mission, le Mal gagne la
                partie.
              </li>
              <li>
                Si le Bien réussit 3 missions, l’Assassin désigne Merlin : bonne désignation =
                victoire du Mal.
              </li>
            </ul>
          </details>
          <div className="row" style={{ marginTop: '1rem' }}>
            <button type="button" className="btn primary" onClick={startSetup}>
              Nouvelle partie
            </button>
            <button type="button" className="btn" onClick={() => setPhase('docs')}>
              Voir le guide
            </button>
          </div>
        </section>
      )}

      {phase === 'docs' && <RulesGuide onBack={() => setPhase('home')} />}

      {phase === 'setup' && (
        <section className="panel">
          <h2>Joueurs</h2>
          <p className="muted">
            Entrez entre <strong>5 et 10</strong> prénoms, un par ligne (ou séparés par des
            virgules).
          </p>
          <textarea
            rows={8}
            value={setupDraft}
            onChange={(e) => setSetupDraft(e.target.value)}
            placeholder={'Alice\nBob\n…'}
            style={{
              width: '100%',
              font: 'inherit',
              padding: '0.55rem 0.65rem',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: '#12161f',
              color: 'var(--text)',
              resize: 'vertical',
            }}
          />
          <p className="muted">
            Joueurs détectés : <strong>{namesFromDraft.length}</strong>
          </p>
          <div className="row">
            <button
              type="button"
              className="btn primary"
              disabled={namesFromDraft.length < 5 || namesFromDraft.length > 10}
              onClick={launchGame}
            >
              Tirer les rôles au hasard
            </button>
            <button type="button" className="btn" onClick={() => setPhase('home')}>
              Retour
            </button>
          </div>
        </section>
      )}

      {phase === 'reveal' && viewer && (
        <section className="panel">
          <h2>Rôles secrets</h2>
          <p>
            Passez l’appareil à <strong>{viewer.name}</strong> sans que les autres regardent.
          </p>
          {roleHidden ? (
            <button type="button" className="btn primary" onClick={() => setRoleHidden(false)}>
              Afficher mon rôle
            </button>
          ) : (
            <>
              <p style={{ fontSize: '1.1rem' }}>
                Vous êtes :{' '}
                <span className={`tag ${isGood(viewer.role) ? 'good' : 'evil'}`}>
                  {ROLE_LABELS_FR[viewer.role]}
                </span>
              </p>
              <ul className="muted">
                {knowledgeLines(viewer, players).map((line, i) => (
                  <li key={`${viewer.id}-k-${i}`}>{line}</li>
                ))}
              </ul>
              <div className="row" style={{ marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setRoleHidden(true)}
                >
                  Masquer
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => {
                    setRoleHidden(true);
                    if (revealIdx + 1 >= players.length) finishRevealAndPlay();
                    else setRevealIdx(revealIdx + 1);
                  }}
                >
                  {revealIdx + 1 >= players.length ? 'Commencer la partie' : 'Joueur suivant'}
                </button>
              </div>
            </>
          )}
          <p className="muted" style={{ marginTop: '1rem' }}>
            Révélation {revealIdx + 1} / {players.length}
          </p>
        </section>
      )}

      {phase === 'playing' && session && (
        <>
          <BoardStrip session={session} playerCount={playerCount} />

          {session.phaseDetail.kind === 'propose' && (
            <section className="panel">
              <h2>Proposition d’équipe</h2>
              <p>
                Chef :{' '}
                <strong>{session.players[session.phaseDetail.proposal.leaderIndex]?.name}</strong>
              </p>
              <p className="muted">
                Sélectionnez exactement{' '}
                <strong>
                  {QUEST_TEAM_SIZES[playerCount]![session.missionRound]}
                </strong>{' '}
                joueur(s) pour la mission {session.missionRound + 1}.
              </p>
              <select
                className="person-selector"
                multiple
                value={[...session.phaseDetail.proposal.picks]}
                onChange={(event) => {
                  const selected = Array.from(
                    event.target.selectedOptions,
                    (option) => option.value,
                  );
                  const limit = QUEST_TEAM_SIZES[playerCount]![session.missionRound];
                  setSession((currentSession) =>
                    currentSession
                      ? updateProposal(currentSession, (proposal) => ({
                          ...proposal,
                          picks: new Set(selected.slice(0, limit)),
                        }))
                      : currentSession,
                  );
                }}
              >
                {session.players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p className="muted">
                Sélectionnés : {session.phaseDetail.proposal.picks.size}
              </p>
              <div className="row" style={{ marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn primary"
                  disabled={
                    (session.phaseDetail.kind === 'propose'
                      ? session.phaseDetail.proposal.picks.size
                      : 0) !==
                    QUEST_TEAM_SIZES[playerCount]![session.missionRound]
                  }
                  onClick={() => setSession((s) => (s ? confirmProposal(s) : s))}
                >
                  Lancer le vote
                </button>
              </div>
            </section>
          )}

          {session.phaseDetail.kind === 'vote' && (
            <VotePanel
              session={session}
              voteTurn={voteTurn}
              setVoteTurn={setVoteTurn}
              onResolve={(votes) => {
                setVoteTurn(0);
                setSession((s) => {
                  if (!s) return s;
                  const t = tallyVote(s, votes);
                  if (t.phaseEnd)
                    queueMicrotask(() => {
                      setPhase(t.phaseEnd!);
                    });
                  return t.session;
                });
              }}
            />
          )}

          {session.phaseDetail.kind === 'mission' && (
            <MissionPanel
              session={session}
              missionTurnIdx={missionTurnIdx}
              setMissionTurnIdx={setMissionTurnIdx}
              pendingMissionCards={pendingMissionCards}
              setPendingMissionCards={setPendingMissionCards}
              onComplete={(failCount) => {
                setMissionTurnIdx(0);
                setPendingMissionCards({});
                setSession((s) => {
                  if (!s) return s;
                  const t = completeMission(s, failCount);
                  if (t.phaseEnd)
                    queueMicrotask(() => {
                      setPhase(t.phaseEnd!);
                    });
                  return t.session;
                });
              }}
            />
          )}

          {session.phaseDetail.kind === 'assassin_pick' && (
            <AssassinPanel
              players={session.players}
              onPickMerlin={(merlinId) => {
                const merlin = session.players.find((p) => p.role === 'merlin');
                const ok = merlin?.id === merlinId;
                setPhase(ok ? 'evil_win' : 'good_win');
              }}
            />
          )}

          <div className="row" style={{ marginTop: '1rem' }}>
            <button type="button" className="btn" onClick={resetAll}>
              Quitter et tout réinitialiser
            </button>
          </div>
        </>
      )}

      {(phase === 'good_win' || phase === 'evil_win') && (
        <section className="panel">
          <h2>{phase === 'good_win' ? 'Victoire du Bien !' : 'Victoire du Mal !'}</h2>
          <p className="muted">
            Les rôles étaient répartis ainsi — vérifiez ensemble avant une nouvelle partie.
          </p>
          <ul>
            {players.map((p) => (
              <li key={p.id}>
                <strong>{p.name}</strong> — {roleLabel(p.role)}
              </li>
            ))}
          </ul>
          <button type="button" className="btn primary" onClick={resetAll}>
            Retour à l’accueil
          </button>
        </section>
      )}
    </div>
  );
}

function RulesGuide({ onBack }: { onBack: () => void }) {
  const roles = [
    ['merlin', 'Bien', 'Connaît les joueurs maléfiques, sauf Mordred. Il doit rester caché jusqu’à la fin.'],
    ['percival', 'Bien', 'Voit Merlin et Morgane comme deux personnes possibles.'],
    ['loyal_servant', 'Bien', 'N’a aucun pouvoir spécial et ne peut jouer que Succès en mission.'],
    ['morgana', 'Mal', 'Apparaît comme Merlin aux yeux de Perceval.'],
    ['assassin', 'Mal', 'Après trois missions réussies par le Bien, tente d’identifier Merlin.'],
    ['minion', 'Mal', 'Connaît les autres méchants, sauf Oberon, et peut jouer Échec.'],
    ['mordred', 'Mal', 'Est invisible pour Merlin, mais connu des autres méchants.'],
    ['oberon', 'Mal', 'Ne connaît pas les autres méchants et n’est pas connu d’eux.'],
  ] as const;

  return (
    <section className="panel guide">
      <div className="guide-heading">
        <div>
          <p className="eyebrow">Manuel de la Table ronde</p>
          <h2>Règles et pouvoirs</h2>
        </div>
        <button type="button" className="btn" onClick={onBack}>Retour</button>
      </div>
      <div className="guide-section">
        <h3>But de la partie</h3>
        <p>Le Bien gagne en réussissant trois missions, sauf si l’Assassin trouve Merlin. Le Mal gagne avec trois missions échouées ou cinq équipes refusées d’affilée.</p>
      </div>
      <div className="guide-section">
        <h3>Déroulement d’une mission</h3>
        <ol className="muted">
          <li>Le chef choisit exactement le nombre de joueurs demandé.</li>
          <li>Chaque joueur vote secrètement pour accepter ou refuser l’équipe.</li>
          <li>Si l’équipe est acceptée, ses membres jouent une carte en secret.</li>
          <li>Une carte Échec suffit normalement à faire échouer la mission. À 7 joueurs ou plus, la quatrième mission demande deux Échecs.</li>
        </ol>
      </div>
      <div className="guide-section">
        <h3>Personnages</h3>
        <div className="role-list">
          {roles.map(([role, camp, power]) => (
            <article className="role-entry" key={role}>
              <div className="role-entry-heading">
                <strong>{ROLE_LABELS_FR[role]}</strong>
                <span className={`tag ${camp === 'Bien' ? 'good' : 'evil'}`}>{camp}</span>
              </div>
              <p className="muted">{power}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function BoardStrip({
  session,
  playerCount,
}: {
  session: GameSession;
  playerCount: number;
}) {
  const qs = QUEST_TEAM_SIZES[playerCount]!;
  const succ = session.missionsHistory.filter((m) => m.passed).length;
  const fail = session.missionsHistory.filter((m) => !m.passed).length;
  return (
    <section className="panel">
      <h2>Table ronde</h2>
      <p className="muted">
        Quêtes réussies : <strong>{succ}</strong> · Quêtes échouées : <strong>{fail}</strong>
        {' · '}
        Propositions refusées d’affilée : <strong>{session.rejectCountThisRound}</strong> / 5
      </p>
      <div className="quest-track">
        {[0, 1, 2, 3, 4].map((i) => {
          const done = session.missionsHistory.find((m) => m.roundIndex === i);
          const active = i === session.missionRound && session.phaseDetail.kind !== 'assassin_pick';
          return (
            <div
              key={i}
              className={`quest-slot ${done?.passed === true ? 'win' : ''} ${done?.passed === false ? 'loss' : ''} ${active ? 'active' : ''}`}
            >
              M{i + 1}
              <div className="muted" style={{ fontSize: '0.75rem' }}>
                {qs[i]} joueurs
              </div>
              {done && (
                <div style={{ marginTop: '0.25rem' }}>
                  {done.passed ? 'Réussite' : 'Échec'}
                  {done.failsShown > 0 ? ` · ${done.failsShown} échec(s)` : ''}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function VotePanel({
  session,
  voteTurn,
  setVoteTurn,
  onResolve,
}: {
  session: GameSession;
  voteTurn: number;
  setVoteTurn: (value: number) => void;
  onResolve: (votes: Record<string, boolean>) => void;
}) {
  const [votes, setVotes] = useState<Record<string, boolean>>({});
  const [currentVote, setCurrentVote] = useState<boolean | undefined>();
  const voter = session.players[voteTurn];

  function confirmVote() {
    if (!voter || currentVote === undefined) return;
    const nextVotes = { ...votes, [voter.id]: currentVote };
    if (voteTurn === session.players.length - 1) {
      onResolve(nextVotes);
      setVotes({});
      setCurrentVote(undefined);
      return;
    }
    setVotes(nextVotes);
    setCurrentVote(undefined);
    setVoteTurn(voteTurn + 1);
  }

  return (
    <section className="panel">
      <h2>Vote sur l’équipe</h2>
      <p className="muted">
        Passez le téléphone à chaque joueur. Les votes déjà enregistrés restent cachés jusqu’au
        décompte final. En cas d’égalité, la proposition est <strong>refusée</strong>.
      </p>
      <div className="private-turn">
        <p className="eyebrow">
          Vote privé {voteTurn + 1} / {session.players.length}
        </p>
        <h3>{voter?.name}, à vous de voter</h3>
        <div className="row">
          <button
            type="button"
            className={`btn good ${currentVote === true ? 'selected' : ''}`}
            onClick={() => setCurrentVote(true)}
          >
            Approuver
          </button>
          <button
            type="button"
            className={`btn evil ${currentVote === false ? 'selected' : ''}`}
            onClick={() => setCurrentVote(false)}
          >
            Refuser
          </button>
        </div>
      </div>
      <button
        type="button"
        className="btn primary"
        disabled={currentVote === undefined}
        onClick={confirmVote}
      >
        {voteTurn === session.players.length - 1
          ? 'Révéler le décompte'
          : 'Valider et passer le téléphone'}
      </button>
    </section>
  );
}

function MissionPanel({
  session,
  missionTurnIdx,
  setMissionTurnIdx,
  pendingMissionCards,
  setPendingMissionCards,
  onComplete,
}: {
  session: GameSession;
  missionTurnIdx: number;
  setMissionTurnIdx: (n: number) => void;
  pendingMissionCards: Record<string, 'success' | 'fail'>;
  setPendingMissionCards: Dispatch<SetStateAction<Record<string, 'success' | 'fail'>>>;
  onComplete: (failCount: number) => void;
}) {
  const [reveal, setReveal] = useState<{ successes: number; hasFailure: boolean } | null>(null);
  if (session.phaseDetail.kind !== 'mission') return null;
  const teamIds = session.phaseDetail.teamIds;
  const teamPlayers = teamIds
    .map((id) => session.players.find((p) => p.id === id)!)
    .filter(Boolean);
  const current = teamPlayers[missionTurnIdx];

  function submitCard(choice: 'success' | 'fail') {
    if (!current) return;
    if (choice === 'fail' && isGood(current.role)) return;
    const next = { ...pendingMissionCards, [current.id]: choice };
    setPendingMissionCards(next);
    if (missionTurnIdx + 1 >= teamPlayers.length) {
      const fails = Object.values(next).filter((c) => c === 'fail').length;
      const successes = teamPlayers.length - fails;
      setReveal({ successes, hasFailure: fails > 0 });
      window.setTimeout(() => onComplete(fails), 2200);
    } else setMissionTurnIdx(missionTurnIdx + 1);
  }

  if (reveal) {
    return (
      <section className="panel mission-reveal" aria-live="polite">
        <p className="eyebrow">Résultat collectif</p>
        <h2>Les cartes sont révélées</h2>
        <div className="reveal-lights" aria-label="Révélation progressive du résultat">
          {Array.from({ length: reveal.successes }).map((_, index) => (
            <span className="reveal-light success" key={`success-${index}`} />
          ))}
          {reveal.hasFailure && <span className="reveal-light failure" />}
        </div>
        <p className="reveal-caption">
          {reveal.hasFailure ? 'La mission a échoué.' : 'La mission est réussie.'}
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Mission en cours</h2>
      <p>
        Cartes jouées dans le secret : passez l’appareil à{' '}
        <strong>{current?.name}</strong> ({missionTurnIdx + 1} / {teamPlayers.length}).
      </p>
      <div className="row">
        <button type="button" className="btn good" onClick={() => submitCard('success')}>
          Succès
        </button>
        <button
          type="button"
          className="btn evil"
          disabled={current ? isGood(current.role) : true}
          title={
            current && isGood(current.role)
              ? 'Un loyal serviteur ne peut pas jouer Échec.'
              : undefined
          }
          onClick={() => submitCard('fail')}
        >
          Échec
        </button>
      </div>
      <p className="muted" style={{ marginTop: '0.75rem' }}>
        Les Loyaux et Merlin / Percival ne peuvent jouer que Succès. Les méchants peuvent choisir.
      </p>
    </section>
  );
}

function AssassinPanel({
  players,
  onPickMerlin,
}: {
  players: Player[];
  onPickMerlin: (merlinId: string) => void;
}) {
  const assassin = players.find((p) => p.role === 'assassin');
  const [pick, setPick] = useState<string | null>(null);
  return (
    <section className="panel">
      <h2>Dernière chance du Mal</h2>
      <p>
        Trois missions ont réussi. L’Assassin (<strong>{assassin?.name}</strong>) désigne qui il
        croit être <strong>Merlin</strong>.
      </p>
      <select
        value={pick ?? ''}
        onChange={(e) => setPick(e.target.value || null)}
        style={{
          font: 'inherit',
          padding: '0.45rem',
          borderRadius: 8,
          width: '100%',
          border: '1px solid var(--border)',
          background: '#12161f',
          color: 'var(--text)',
        }}
      >
        <option value="">— Choisir un joueur —</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <div className="row" style={{ marginTop: '1rem' }}>
        <button
          type="button"
          className="btn primary"
          disabled={!pick}
          onClick={() => pick && onPickMerlin(pick)}
        >
          Révéler la cible
        </button>
      </div>
    </section>
  );
}
