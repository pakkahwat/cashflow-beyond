'use client';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getIdToken } from '../lib/firebase';
import { useAuth } from './AuthGate';
import { useGame } from '../store/gameStore';

interface ProfileData {
  uid: string;
  name: string;
  photoURL: string | null;
  createdAt: number;
  lastLoginAt: number;
}

interface StatsData {
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  bestPassiveIncome: number;
  winRate: number;
}

interface MatchPlayer {
  uid: string;
  name: string;
  escapedRatRace: boolean;
  finalPassiveIncome: number;
  result: 'win' | 'loss' | 'draw';
}

interface MatchEntry {
  _id?: string;
  roomCode: string;
  winnerUid: string | null;
  startedAt: number;
  endedAt: number;
  vsBots: boolean;
  players: MatchPlayer[];
}

interface Props {
  onBack: () => void;
}

const fmt = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `$${(n / 1_000).toFixed(0)}k`
    : `$${n}`;

const dateStr = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function Profile({ onBack }: Props) {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const resetGame = useGame((s) => s.reset);
  // Reset in-memory game state too, so the next sign-in starts clean (signOut already
  // clears the persisted session keys).
  const handleSignOut = () => {
    resetGame();
    signOut();
  };
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [matchList, setMatchList] = useState<MatchEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const token = await getIdToken();
      if (!token) {
        if (!cancelled) setError('not_signed_in');
        return;
      }
      const headers = { Authorization: `Bearer ${token}` };

      try {
        const [meRes, matchesRes] = await Promise.all([
          fetch('/api/me', { headers }),
          fetch('/api/matches', { headers }),
        ]);

        if (!meRes.ok) throw new Error(`/api/me ${meRes.status}`);
        if (!matchesRes.ok) throw new Error(`/api/matches ${matchesRes.status}`);

        const meJson = await meRes.json();
        const matchesJson = await matchesRes.json();

        if (!cancelled) {
          setProfile(meJson.profile);
          setStats(meJson.stats);
          setMatchList(matchesJson.matches ?? []);
          setLoading(false);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'fetch_failed');
          setLoading(false);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="screen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', gap: '1rem' }}>
        <div className="spinner" />
        <p style={{ color: 'var(--muted)' }}>{t('profile.loading', 'Loading profile…')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="screen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', gap: '1.2rem' }}>
        <p style={{ color: 'var(--red)' }}>{error}</p>
        <button className="btn" onClick={onBack}>{t('profile.back', '← Back')}</button>
      </div>
    );
  }

  return (
    <div className="screen profile-screen" style={{ maxWidth: 560, margin: '0 auto', padding: '2rem 1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button className="btn ghost small" onClick={onBack} style={{ padding: '6px 10px', fontSize: 18 }}>←</button>
        <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>{t('profile.title', 'Profile')}</h2>
        <button className="btn ghost small" onClick={handleSignOut} style={{ marginLeft: 'auto' }}>
          {t('profile.signOut', 'Sign out')}
        </button>
      </div>

      {/* Player identity */}
      <div className="card-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
        {profile?.photoURL ? (
          <img src={profile.photoURL} alt="" style={{ width: 52, height: 52, borderRadius: '50%', border: '2px solid var(--line)' }} />
        ) : (
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--panel2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>
            {profile?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{profile?.name}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
            {t('profile.memberSince', 'Member since')} {profile ? dateStr(profile.createdAt) : '—'}
          </div>
        </div>
      </div>

      {/* Aggregate stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <StatBox label={t('profile.gamesPlayed', 'Games')} value={String(stats.gamesPlayed)} />
          <StatBox label={t('profile.wins', 'Wins')} value={String(stats.gamesWon)} accent="var(--green)" />
          <StatBox label={t('profile.winRate', 'Win rate')} value={`${(stats.winRate * 100).toFixed(0)}%`} accent="var(--primary)" />
          <StatBox label={t('profile.losses', 'Losses')} value={String(stats.gamesLost)} />
          <StatBox label={t('profile.bestPassive', 'Best passive')} value={fmt(stats.bestPassiveIncome)} accent="var(--gold)" colSpan={2} />
        </div>
      )}

      {/* Recent matches */}
      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--muted)', marginBottom: '0.6rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {t('profile.recentMatches', 'Recent Matches')}
      </div>

      {matchList.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '1.5rem 0', fontSize: '0.9rem' }}>
          {t('profile.noMatches', 'No matches yet — play a game!')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {matchList.map((m, i) => {
            const me = m.players.find((p) => p.uid === profile?.uid);
            const result = me?.result ?? 'loss';
            const resultColor = result === 'win' ? 'var(--green)' : result === 'draw' ? 'var(--gold)' : 'var(--muted)';
            return (
              <div key={m._id ?? i} style={{ background: 'var(--panel)', borderRadius: 10, padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--line)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    <span style={{ color: resultColor, marginRight: 8, textTransform: 'capitalize' }}>{result}</span>
                    <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{m.roomCode}</span>
                    {m.vsBots && <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--muted)', background: 'var(--panel2)', padding: '1px 6px', borderRadius: 5 }}>vs bots</span>}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 2 }}>
                    {m.players.length} players · {dateStr(m.endedAt)}
                  </div>
                </div>
                {me && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, color: 'var(--gold)', fontSize: '0.9rem' }}>{fmt(me.finalPassiveIncome)}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{t('profile.passive', 'passive/mo')}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, accent, colSpan }: { label: string; value: string; accent?: string; colSpan?: number }) {
  return (
    <div style={{
      background: 'var(--panel)',
      border: '1px solid var(--line)',
      borderRadius: 10,
      padding: '0.65rem 0.85rem',
      gridColumn: colSpan ? `span ${colSpan}` : undefined,
    }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: '1.1rem', color: accent ?? 'var(--text)' }}>{value}</div>
    </div>
  );
}
