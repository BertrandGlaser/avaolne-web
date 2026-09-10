import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  ALIGNMENT_COUNTS,
  QUEST_TEAM_SIZES,
  ROLE_DETAILS,
  ROLE_LABELS_FR,
} from './game/constants';
import { assignRoles, defaultRolesForCount, isGood } from './game/setup';
import { knowledgeLines, roleLabel } from './game/knowledge';
import {
  beginSession,
  completeMission,
  confirmProposal,
  toggleProposalPick,
} from './game/engine';
import type { GameSession, Phase, Player, Role } from './game/types';

export default function App() {
  const [phase, setPhase] = useState<Phase>('home');
  const [players, setPlayers] = useState<Player[]>([]);
  const [setupDraft, setSetupDraft] = useState('');
  const [roleDraft, setRoleDraft] = useState<Role[]>([]);
  const [session, setSession] = useState<GameSession | null>(null);
  const [revealIdx, setRevealIdx] = useState(0);
  const [roleHidden, setRoleHidden] = useState(true);
  /** Pendant une mission : joueur courant qui pose carte */
  const [missionTurnIdx, setMissionTurnIdx] = useState(0);
  const [pendingMissionCards, setPendingMissionCards] = useState<
    Record<string, 'success' | 'fail'>
  >({});
  const [assassinReveal, setAssassinReveal] = useState<{
    target: Player;
    correct: boolean;
  } | null>(null);

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
    setAssassinReveal(null);
    setSetupDraft('');
    setRoleDraft([]);
  }

  function startSetup() {
    setPhase('setup');
    setSetupDraft('');
    setRoleDraft([]);
  }

  function launchGame() {
    const n = namesFromDraft.length;
    if (n < 5 || n > 10) return;
    const p = assignRoles(namesFromDraft, roleDraft);
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
  }

  const viewer = players[revealIdx];

  return (
    <div className="tavern-shell">
      <div className="tavern-glow" aria-hidden="true" />
      <div className="wrapper">
      <header style={{ marginBottom: '1.25rem' }}>
        <div className="header-row">
          <div>
            <p className="tavern-sign">🍺 THE ROUND TABLE INN 🍺</p>
            <h1 style={{ margin: '0 0 0.35rem', fontSize: '1.65rem' }}>Avalon</h1>
            <p className="muted" style={{ margin: 0 }}>
              La taverne est fermée aux innocents. Entrez, si vous l’osez.
            </p>
          </div>
          <div className="header-actions">
            <button type="button" className="btn header-action secondary" onClick={() => setPhase('docs')}>
              <span className="button-icon" aria-hidden="true">?</span>
              Guide
            </button>
            {phase !== 'home' && phase !== 'docs' && (
              <button type="button" className="btn header-action primary" onClick={resetAll}>
                <span className="button-icon" aria-hidden="true">+</span>
                Nouvelle partie
              </button>
            )}
          </div>
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
                À tour de rôle, un chef propose une équipe ; la table vote à main levée ; les membres
                jouent ensuite Succès ou Échec (les Loyaux ne peuvent jouer que Succès).
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
            className="player-input"
            rows={8}
            value={setupDraft}
            onChange={(e) => {
              const nextDraft = e.target.value;
              const nextNames = nextDraft
                .split(/\n|,/)
                .map((name) => name.trim())
                .filter(Boolean);
              setSetupDraft(nextDraft);
              setRoleDraft(
                nextNames.length >= 5 && nextNames.length <= 10
                  ? defaultRolesForCount(nextNames.length)
                  : [],
              );
            }}
            placeholder={'Alice\nBob\n…'}
          />
          <p className="muted">
            Joueurs détectés : <strong>{namesFromDraft.length}</strong>
          </p>
          {namesFromDraft.length >= 5 && namesFromDraft.length <= 10 && (
            <RoleSelector
              playerCount={namesFromDraft.length}
              roles={roleDraft}
              onChange={setRoleDraft}
            />
          )}
          <div className="row setup-actions">
            <button
              type="button"
              className="btn primary"
              disabled={
                namesFromDraft.length < 5 ||
                namesFromDraft.length > 10 ||
                roleDraft.length !== namesFromDraft.length ||
                !roleDraft.includes('merlin') ||
                roleDraft.filter((role) => ROLE_DETAILS[role].alignment === 'Bien').length !==
                  ALIGNMENT_COUNTS[namesFromDraft.length]?.[0] ||
                roleDraft.filter((role) => ROLE_DETAILS[role].alignment === 'Mal').length !==
                  ALIGNMENT_COUNTS[namesFromDraft.length]?.[1]
              }
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
          <PlayerRoster session={session} />

          {session.phaseDetail.kind === 'propose' && (
            <section className="panel">
              <p className="eyebrow">Mission {session.missionRound + 1} · choix de l’équipe</p>
              <h2>Proposition d’équipe</h2>
              <p className="lead-copy">
                <span className="player-highlight">
                  {session.players[session.phaseDetail.proposal.leaderIndex]?.name}
                </span>{' '}
                est le chef et choisit les joueurs de la mission.
              </p>
              <p className="muted">
                Sélectionnez exactement{' '}
                <strong>
                  {QUEST_TEAM_SIZES[playerCount]![session.missionRound]}
                </strong>{' '}
                joueur(s) pour la mission {session.missionRound + 1}.
              </p>
              <div className="player-selector" aria-label="Joueurs de la mission">
                {session.players.map((p) => {
                  const selected =
                    session.phaseDetail.kind === 'propose' &&
                    session.phaseDetail.proposal.picks.includes(p.id);
                  return (
                    <button
                      type="button"
                      className={`player-choice ${selected ? 'selected' : ''}`}
                      aria-pressed={selected}
                      key={p.id}
                      onClick={() =>
                        setSession((s) =>
                          s ? toggleProposalPick(s, playerCount, p.id) : s,
                        )
                      }
                    >
                      <span>{p.name}</span>
                      <span aria-hidden="true">{selected ? '✓' : '+'}</span>
                    </button>
                  );
                })}
              </div>
              <p className="selection-status" aria-live="polite">
                Équipe sélectionnée : <strong>{session.phaseDetail.proposal.picks.length}</strong> /{' '}
                {QUEST_TEAM_SIZES[playerCount]![session.missionRound]}
              </p>
              <div className="row" style={{ marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn primary"
                  disabled={
                    (session.phaseDetail.kind === 'propose'
                      ? session.phaseDetail.proposal.picks.length
                      : 0) !==
                    QUEST_TEAM_SIZES[playerCount]![session.missionRound]
                  }
                  onClick={() =>
                    setSession((s) => (s ? confirmProposal(s, playerCount) : s))
                  }
                >
                  Valider à main levée
                </button>
              </div>
            </section>
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
                  const t = completeMission(s, playerCount, failCount);
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
                const target = session.players.find((p) => p.id === merlinId);
                if (!target) return;
                setAssassinReveal({ target, correct: ok });
                window.setTimeout(() => {
                  setAssassinReveal(null);
                  setPhase(ok ? 'evil_win' : 'good_win');
                }, 10500);
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
        <section className={`panel victory-panel ${phase === 'good_win' ? 'good-win' : 'evil-win'}`}>
          <p className="eyebrow">La partie est terminée</p>
          <div className="victory-mark" aria-hidden="true">{phase === 'good_win' ? '✓' : '!'}</div>
          <h2>{phase === 'good_win' ? 'Le Bien remporte la partie' : 'Le Mal remporte la partie'}</h2>
          <p className="victory-summary">
            {phase === 'good_win'
              ? 'Les serviteurs loyaux ont accompli leur mission.'
              : 'Les forces du Mal ont pris le dessus sur la Table ronde.'}
          </p>
          <div className="role-reveal-list">
            {players.map((p) => (
              <div className="role-reveal-row" key={p.id}>
                <strong>{p.name}</strong>
                <span className={`tag ${isGood(p.role) ? 'good' : 'evil'}`}>
                  {roleLabel(p.role)}
                </span>
              </div>
            ))}
          </div>
          <button type="button" className="btn primary" onClick={resetAll}>
            Nouvelle partie
          </button>
        </section>
      )}
      {assassinReveal && <AssassinReveal reveal={assassinReveal} />}
    </div>
    </div>
  );
}

const selectableRoles: Role[] = [
  'merlin',
  'percival',
  'loyal_servant',
  'morgana',
  'assassin',
  'minion',
  'mordred',
  'oberon',
];

function RoleSelector({
  playerCount,
  roles,
  onChange,
}: {
  playerCount: number;
  roles: Role[];
  onChange: (roles: Role[]) => void;
}) {
  const counts = roles.reduce<Partial<Record<Role, number>>>((result, role) => {
    result[role] = (result[role] ?? 0) + 1;
    return result;
  }, {});
  const [requiredGood, requiredEvil] = ALIGNMENT_COUNTS[playerCount]!;
  const goodCount = roles.filter((role) => ROLE_DETAILS[role].alignment === 'Bien').length;
  const evilCount = roles.length - goodCount;

  function changeRole(role: Role, amount: 1 | -1) {
    const current = counts[role] ?? 0;
    const isEvilRole = ROLE_DETAILS[role].alignment === 'Mal';
    const currentAlignmentCount = isEvilRole ? evilCount : goodCount;
    const requiredAlignmentCount = isEvilRole ? requiredEvil : requiredGood;
    if (role === 'merlin' && amount === -1 && current <= 1) return;
    if (amount === 1 && roles.length >= playerCount) return;
    if (amount === 1 && currentAlignmentCount >= requiredAlignmentCount) return;
    if (amount === 1 && role !== 'loyal_servant' && role !== 'minion' && current >= 1) return;
    if (amount === -1 && current === 0) return;

    if (amount === 1) onChange([...roles, role]);
    else {
      const index = roles.lastIndexOf(role);
      onChange([...roles.slice(0, index), ...roles.slice(index + 1)]);
    }
  }

  return (
    <div className="role-selector">
      <div className="role-selector-heading">
        <div>
          <h3>Personnages</h3>
          <p className="muted">La composition officielle est proposée. Merlin est obligatoire.</p>
        </div>
        <strong className={
          roles.length === playerCount && goodCount === requiredGood && evilCount === requiredEvil
            ? 'count-ready'
            : 'count-warning'
        }>
          {roles.length} / {playerCount}
        </strong>
      </div>
      <div className="role-options">
        {selectableRoles.map((role) => {
          const count = counts[role] ?? 0;
          const single = role !== 'loyal_servant' && role !== 'minion';
          const isEvilRole = ROLE_DETAILS[role].alignment === 'Mal';
          const currentAlignmentCount = isEvilRole ? evilCount : goodCount;
          const requiredAlignmentCount = isEvilRole ? requiredEvil : requiredGood;
          return (
            <div className="role-option" key={role}>
              <div>
                <strong>{ROLE_LABELS_FR[role]}</strong>
                <span className={`tag ${ROLE_DETAILS[role].alignment === 'Bien' ? 'good' : 'evil'}`}>
                  {ROLE_DETAILS[role].alignment}
                </span>
              </div>
              <div className="role-stepper">
                <button
                  type="button"
                  className="stepper-button"
                  aria-label={`Retirer ${ROLE_LABELS_FR[role]}`}
                  disabled={
                    count === 0 ||
                    (role === 'merlin' && count === 1)
                  }
                  onClick={() => changeRole(role, -1)}
                >
                  −
                </button>
                <strong>{count}</strong>
                <button
                  type="button"
                  className="stepper-button"
                  aria-label={`Ajouter ${ROLE_LABELS_FR[role]}`}
                  disabled={
                    roles.length >= playerCount ||
                    (single && count === 1) ||
                    currentAlignmentCount >= requiredAlignmentCount
                  }
                  onClick={() => changeRole(role, 1)}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {roles.length !== playerCount && (
        <p className="selection-status" role="alert">
          Ajoutez ou retirez des personnages pour atteindre exactement {playerCount} joueurs.
        </p>
      )}
      <p className="selection-status">
        Camp : <strong>{goodCount} / {requiredGood} Bien</strong> ·{' '}
        <strong>{evilCount} / {requiredEvil} Mal</strong>
      </p>
    </div>
  );
}

function RulesGuide({ onBack }: { onBack: () => void }) {
  const roles = Object.entries(ROLE_DETAILS) as [keyof typeof ROLE_DETAILS, (typeof ROLE_DETAILS)[keyof typeof ROLE_DETAILS]][];

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
        <p>Le Bien gagne en réussissant trois missions, sauf si l’Assassin trouve Merlin. Le Mal gagne avec trois missions échouées.</p>
      </div>
      <div className="guide-section">
        <h3>Déroulement d’une mission</h3>
        <ol className="muted">
          <li>Le chef choisit exactement le nombre de joueurs demandé.</li>
          <li>Tout le monde vote à main levée pour valider l’équipe proposée.</li>
          <li>Si l’équipe est acceptée, ses membres jouent une carte en secret.</li>
          <li>Une carte Échec suffit normalement à faire échouer la mission. À 7 joueurs ou plus, la quatrième mission demande deux Échecs.</li>
        </ol>
      </div>
      <div className="guide-section">
        <h3>Personnages</h3>
        <div className="role-list">
          {roles.map(([role, details]) => (
            <article className="role-entry" key={role}>
              <div className="role-entry-heading">
                <strong>{ROLE_LABELS_FR[role]}</strong>
                <span className={`tag ${details.alignment === 'Bien' ? 'good' : 'evil'}`}>
                  {details.alignment}
                </span>
              </div>
              <p className="muted">{details.power}</p>
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

/** Vue de repérage : les rôles restent secrets, les statuts publics restent visibles. */
function PlayerRoster({ session }: { session: GameSession }) {
  const detail = session.phaseDetail;
  const proposedIds = detail.kind === 'propose'
    ? detail.proposal.picks
    : [];
  const missionIds = detail.kind === 'mission' ? detail.teamIds : [];
  const leaderIndex = detail.kind === 'propose'
    ? detail.proposal.leaderIndex
    : session.leaderCursor;

  return (
    <section className="panel roster-panel">
      <div className="roster-heading">
        <div>
          <p className="eyebrow">Table ronde</p>
          <h2>Les joueurs</h2>
        </div>
        <p className="muted">Les rôles restent secrets</p>
      </div>
      <div className="roster-grid">
        {session.players.map((player, index) => {
          const isLeader = index === leaderIndex;
          const isProposed = proposedIds.includes(player.id);
          const isOnMission = missionIds.includes(player.id);
          const status = isOnMission ? 'Mission' : isProposed ? 'Proposé' : isLeader ? 'Chef' : '';
          return (
            <div className={`roster-player ${isOnMission ? 'on-mission' : ''} ${isProposed ? 'proposed' : ''}`} key={player.id}>
              <span className="player-avatar" aria-hidden="true">{player.name.charAt(0).toUpperCase()}</span>
              <span className="roster-player-name">{player.name}</span>
              {status && <span className="roster-status">{status}</span>}
            </div>
          );
        })}
      </div>
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
      window.setTimeout(() => onComplete(fails), 4200 + teamPlayers.length * 1350);
    } else setMissionTurnIdx(missionTurnIdx + 1);
  }

  if (reveal) {
    return (
      <section className="mission-reveal" aria-live="polite">
        <div className="mission-reveal-content">
          <p className="eyebrow">Les cartes restent face cachée</p>
          <p className="mission-reveal-kicker">⚔️ La Table ronde retient son souffle ⚔️</p>
          <h2>Le destin de la mission...</h2>
          <div className="reveal-lights" aria-label="Révélation progressive du résultat">
            {Array.from({ length: reveal.successes }).map((_, index) => (
              <span
                className="reveal-light success"
                key={`success-${index}`}
                style={{ animationDelay: `${1.8 + index * 1.35}s` }}
              />
            ))}
            {reveal.hasFailure && (
              <span
                className="reveal-light failure"
                style={{ animationDelay: `${1.8 + reveal.successes * 1.35}s` }}
              />
            )}
          </div>
          <p
            className="reveal-caption"
            style={{ animationDelay: `${2.8 + teamPlayers.length * 1.35}s` }}
          >
            {reveal.hasFailure ? '💥 La mission a échoué. 💥' : '🌟 La mission est réussie. 🌟'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Mission en cours</h2>
      <div className="mission-team" aria-label="Joueurs envoyés en mission">
        <p className="eyebrow">Équipe verrouillée</p>
        <div className="team-chips">
          {teamPlayers.map((player) => (
            <span className="team-chip" key={player.id}>{player.name}</span>
          ))}
        </div>
      </div>
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

function AssassinReveal({
  reveal,
}: {
  reveal: { target: Player; correct: boolean };
}) {
  return (
    <section className={`assassin-reveal ${reveal.correct ? 'assassin-wins' : 'assassin-fails'}`} aria-live="assertive">
      <div className="assassin-reveal-stars" aria-hidden="true">✦　✧　✦　✧　✦</div>
      <p className="assassin-eyebrow">☠️ Le dernier murmure de la taverne ☠️</p>
      <h2>L’Assassin a choisi...</h2>
      <p className="assassin-target-label">La cible est</p>
      <div className="assassin-target">{reveal.target.name}</div>
      <div className="assassin-verdict">
        {reveal.correct ? '🩸 MERLIN EST DÉMASQUÉ 🩸' : '🛡️ MERLIN EST SAUVÉ 🛡️'}
      </div>
      <p className="assassin-verdict-subtitle">
        {reveal.correct
          ? 'Le royaume tombe dans la nuit.'
          : 'Le dernier espoir du Bien survit à la nuit.'}
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
