// WebAudio synth: every sound in the game is synthesized, no audio files.
// The context is created on the first user gesture (browsers block audio
// before one) and M toggles mute. Every call is guarded, so a headless run
// with no audio device simply stays silent instead of throwing.
export function createAudio() {
  let ctx = null;
  let master = null;
  let drone = null;
  let droneGain = null;
  let muted = false;
  let stepHigh = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // The alarm drone: a low sawtooth whose volume follows the alarm level.
      drone = ctx.createOscillator();
      drone.type = 'sawtooth';
      drone.frequency.value = 55;
      droneGain = ctx.createGain();
      droneGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 220;
      drone.connect(filter);
      filter.connect(droneGain);
      droneGain.connect(master);
      drone.start();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, seconds, type = 'sine', volume = 0.2, when = 0) {
    if (!ctx || muted) return;
    try {
      const t0 = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + seconds + 0.05);
    } catch {
      // Silence is always an acceptable fallback.
    }
  }

  function noise(seconds, volume = 0.2, filterFreq = 1200, when = 0) {
    if (!ctx || muted) return;
    try {
      const t0 = ctx.currentTime + when;
      const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = filterFreq;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(t0);
    } catch {
      // Silence is always an acceptable fallback.
    }
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() {
      return muted;
    },
    setAlarmLevel(level) {
      if (!ctx || !droneGain || muted) return;
      try {
        droneGain.gain.setTargetAtTime(level * 0.05, ctx.currentTime, 0.2);
      } catch {
        // Ignore.
      }
    },
    footstep(sneaking) {
      stepHigh = !stepHigh;
      noise(0.05, sneaking ? 0.05 : 0.12, stepHigh ? 900 : 600);
    },
    guardAlert() {
      tone(660, 0.12, 'square', 0.12);
      tone(880, 0.16, 'square', 0.12, 0.12);
    },
    chaseSting() {
      tone(220, 0.25, 'sawtooth', 0.18);
      tone(175, 0.35, 'sawtooth', 0.18, 0.15);
    },
    cameraBeep(urgent) {
      tone(1000, 0.07, 'sine', urgent ? 0.16 : 0.08);
    },
    lootChime() {
      tone(659, 0.18, 'sine', 0.2);
      tone(880, 0.3, 'sine', 0.2, 0.1);
    },
    smokePoof() {
      noise(0.4, 0.18, 500);
    },
    pickupBlip() {
      tone(1200, 0.08, 'sine', 0.12);
    },
    fuseBuzz() {
      tone(180, 0.3, 'sawtooth', 0.15);
      noise(0.25, 0.1, 2500, 0.1);
    },
    winJingle() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'sine', 0.2, i * 0.13));
    },
    bustedSting() {
      [392, 311, 233].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.18, i * 0.18));
    },
  };
}
