/**
 * Ambient Sound Engine for Dream Weaver
 *
 * Generates procedural ambient sounds using the Web Audio API.
 * Designed for a children's bedtime story app -- all volumes are
 * intentionally very low so the audio serves as gentle background.
 */

export type AmbientType = 'piano' | 'nature' | 'lullaby' | 'none';

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let currentType: AmbientType = 'none';
let playing = false;
let activeNodes: AudioNode[] = [];
let activeTimers: number[] = [];
let userVolume = 0.1; // default master volume (0-1 maps into the 0.05-0.15 range)

/** Lazily create (or resume) the shared AudioContext. */
function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = userVolume;
    masterGain.connect(audioCtx.destination);
  }

  // Mobile browsers suspend the context until a user gesture triggers resume.
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  return audioCtx;
}

function getMasterGain(): GainNode {
  getAudioContext(); // ensure initialised
  return masterGain!;
}

/** Track a node so we can disconnect it later. */
function track<T extends AudioNode>(node: T): T {
  activeNodes.push(node);
  return node;
}

/** Track a timer id so we can clear it on stop. */
function trackTimer(id: number): number {
  activeTimers.push(id);
  return id;
}

/** Disconnect and release every tracked node / timer. */
function cleanUp(): void {
  for (const id of activeTimers) {
    clearTimeout(id);
  }
  activeTimers = [];

  for (const node of activeNodes) {
    try {
      node.disconnect();
    } catch {
      // already disconnected -- ignore
    }
  }
  activeNodes = [];
}

// ---------------------------------------------------------------------------
// Sound generators
// ---------------------------------------------------------------------------

// Pentatonic scale frequencies (C4, D4, E4, G4, A4)
const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// -- Piano ------------------------------------------------------------------

function startPiano(): void {
  const ctx = getAudioContext();
  const dest = getMasterGain();

  function playNote(): void {
    if (!playing) return;

    const freq = randomFrom(PENTATONIC);
    const now = ctx.currentTime;

    // Oscillator -- triangle gives a soft, piano-ish timbre
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;

    // ADSR-ish envelope via a gain node
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.12, now + 0.3);   // soft attack  (0.3 s)
    env.gain.linearRampToValueAtTime(0.08, now + 0.6);   // decay / sustain
    env.gain.linearRampToValueAtTime(0, now + 2.5);      // long release (2 s from peak)

    osc.connect(track(env));
    env.connect(dest);
    track(osc);

    osc.start(now);
    osc.stop(now + 2.6);

    // Schedule the next note at a random interval (2-5 s)
    const delay = randomBetween(2000, 5000);
    trackTimer(window.setTimeout(playNote, delay));
  }

  playNote();
}

// -- Nature (wind / rain) ---------------------------------------------------

function startNature(): void {
  const ctx = getAudioContext();
  const dest = getMasterGain();

  // Generate white noise buffer (2 seconds, looped)
  const bufferSize = ctx.sampleRate * 2;
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuffer;
  noiseSource.loop = true;

  // Lowpass filter to soften the noise into a gentle wind / rain texture
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800;
  filter.Q.value = 0.7;

  // Extra gain to keep nature sound very quiet
  const natureGain = ctx.createGain();
  natureGain.gain.value = 0.06;

  noiseSource.connect(track(filter));
  filter.connect(track(natureGain));
  natureGain.connect(dest);
  track(noiseSource);

  noiseSource.start();
}

// -- Lullaby ----------------------------------------------------------------

function startLullaby(): void {
  const ctx = getAudioContext();
  const dest = getMasterGain();

  // A simple repeating melody using a small set of notes
  const melodyFreqs = [261.63, 329.63, 392.0, 329.63, 293.66, 261.63];
  let noteIndex = 0;

  function playLullabyNote(): void {
    if (!playing) return;

    const freq = melodyFreqs[noteIndex % melodyFreqs.length];
    noteIndex++;
    const now = ctx.currentTime;

    // Fundamental -- warm sine
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = freq;

    // Soft harmonic one octave below for warmth
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq / 2;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.07, now + 0.5);  // gentle attack
    env.gain.linearRampToValueAtTime(0.05, now + 1.5);  // sustain
    env.gain.linearRampToValueAtTime(0, now + 3.0);     // slow release

    const harmGain = ctx.createGain();
    harmGain.gain.value = 0.03; // harmonic is quieter

    osc1.connect(track(env));
    osc2.connect(track(harmGain));
    harmGain.connect(env);
    env.connect(dest);
    track(osc1);
    track(osc2);

    osc1.start(now);
    osc1.stop(now + 3.1);
    osc2.start(now);
    osc2.stop(now + 3.1);

    // Next note every ~3.5 s for a slow, sleepy tempo
    trackTimer(window.setTimeout(playLullabyNote, 3500));
  }

  playLullabyNote();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start playing an ambient sound type. Stops any currently playing sound
 * before starting the new one.
 */
export function startAmbientMusic(type: AmbientType): void {
  // Stop whatever is currently playing (instantly, no fade)
  if (playing) {
    cleanUp();
    playing = false;
  }

  if (type === 'none') {
    currentType = 'none';
    return;
  }

  // Ensure the context is ready
  getAudioContext();
  getMasterGain().gain.value = userVolume;

  playing = true;
  currentType = type;

  switch (type) {
    case 'piano':
      startPiano();
      break;
    case 'nature':
      startNature();
      break;
    case 'lullaby':
      startLullaby();
      break;
  }
}

/**
 * Fade out over 2 seconds, then fully stop and clean up.
 */
export function stopAmbientMusic(): void {
  fadeOutMusic(2000);
}

/**
 * Set the master volume (0 -- 1). The value is scaled internally so
 * even at 1.0 the output stays in a child-safe range (~0.15).
 */
export function setMusicVolume(volume: number): void {
  userVolume = Math.max(0, Math.min(1, volume)) * 0.15;
  if (masterGain) {
    masterGain.gain.value = userVolume;
  }
}

/**
 * Gradually fade the current ambient sound to silence over `durationMs`,
 * then stop and clean up all audio nodes.
 */
export function fadeOutMusic(durationMs: number): void {
  if (!playing || !masterGain || !audioCtx) return;

  const now = audioCtx.currentTime;
  const durationSec = durationMs / 1000;

  masterGain.gain.setValueAtTime(masterGain.gain.value, now);
  masterGain.gain.linearRampToValueAtTime(0, now + durationSec);

  trackTimer(
    window.setTimeout(() => {
      cleanUp();
      playing = false;
      currentType = 'none';
      // Restore the gain for the next play
      if (masterGain) {
        masterGain.gain.value = userVolume;
      }
    }, durationMs + 50) // small buffer to ensure ramp completes
  );
}

/** Returns `true` when ambient audio is actively playing. */
export function isAmbientPlaying(): boolean {
  return playing;
}

/** Returns the currently active ambient type, or `'none'`. */
export function getAmbientType(): AmbientType {
  return currentType;
}
