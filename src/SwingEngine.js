const DEFAULT_PROFILE = {
  takeawayRotation: 1.1,
  topRotation: 0.65,
  impactLinearG: 7.5,
  resetMs: 900
};

const CLUB_PROFILES = {
  Driver: { takeawayRotation: 1.35, topRotation: 0.7, impactLinearG: 10.0, resetMs: 1000 },
  '3-Wood': { takeawayRotation: 1.3, topRotation: 0.68, impactLinearG: 9.0, resetMs: 950 },
  '5-Iron': { takeawayRotation: 1.2, topRotation: 0.65, impactLinearG: 8.0, resetMs: 900 },
  '7-Iron': { takeawayRotation: 1.1, topRotation: 0.62, impactLinearG: 7.0, resetMs: 900 },
  '9-Iron': { takeawayRotation: 1.0, topRotation: 0.58, impactLinearG: 6.0, resetMs: 850 },
  Wedge: { takeawayRotation: 0.9, topRotation: 0.55, impactLinearG: 5.0, resetMs: 800 }
};

export const getClubProfile = club => CLUB_PROFILES[club] || DEFAULT_PROFILE;

export function createSwingEngine(club = '7-Iron') {
  let profile = getClubProfile(club);
  let state = 'ADDRESS';
  let t = { takeaway: 0, top: 0, impact: 0 };
  let peakLinearG = 0;
  let lastImpactAt = 0;

  const setClub = nextClub => {
    profile = getClubProfile(nextClub);
  };

  const reset = () => {
    state = 'ADDRESS';
    t = { takeaway: 0, top: 0, impact: 0 };
    peakLinearG = 0;
  };

  const process = sample => {
    const timestamp = Number(sample.timestamp || Date.now());
    const ax = Number(sample.ax || 0);
    const ay = Number(sample.ay || 0);
    const az = Number(sample.az || 0);
    const gx = Number(sample.gx || 0);
    const gy = Number(sample.gy || 0);
    const gz = Number(sample.gz || 0);

    const linearG = Math.sqrt(ax * ax + ay * ay + az * az) / 9.80665;
    const rotation = Math.sqrt(gx * gx + gy * gy + gz * gz);
    peakLinearG = Math.max(peakLinearG, linearG);

    if (state === 'IMPACT' && timestamp - lastImpactAt > profile.resetMs) reset();

    if (state === 'ADDRESS' && rotation > profile.takeawayRotation) {
      state = 'BACKSWING';
      t.takeaway = timestamp;
    } else if (state === 'BACKSWING' && rotation < profile.topRotation && timestamp - t.takeaway > 250) {
      state = 'DOWNSWING';
      t.top = timestamp;
    } else if (state === 'DOWNSWING' && linearG >= profile.impactLinearG) {
      state = 'IMPACT';
      t.impact = timestamp;
      lastImpactAt = timestamp;

      const backswingMs = Math.max(1, t.top - t.takeaway);
      const downswingMs = Math.max(1, t.impact - t.top);
      const tempoRatio = backswingMs / downswingMs;
      const perfect = tempoRatio >= 2.8 && tempoRatio <= 3.2;

      return {
        state,
        event: 'SWING_COMPLETE',
        metrics: {
          backswingMs,
          downswingMs,
          tempoRatio,
          peakLinearG,
          verdict: perfect ? 'ON TEMPO' : tempoRatio < 2.8 ? 'QUICK TRANSITION' : 'SLOW TRANSITION'
        }
      };
    }

    return { state, event: null, linearG, rotation };
  };

  return { process, setClub, reset, getState: () => state };
}
