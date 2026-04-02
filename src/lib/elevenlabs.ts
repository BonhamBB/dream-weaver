/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TTSOptions {
  text: string;
  voiceId?: string; // default to a warm, child-friendly voice
  modelId?: string;
  onChunk?: (audio: ArrayBuffer) => void;
}

// Default voices optimized for bedtime stories
export const VOICE_PRESETS = {
  warm_female: 'EXAVITQu4vr4xnSDxMaL', // "Sarah" - warm and gentle
  warm_male: 'pNInz6obpgDQGcFmaJgB', // "Adam" - calm narrator
  child_friendly: 'jBpfAIEERM9E5sMkJ3jF', // soft voice
} as const;

export type VoicePreset = keyof typeof VOICE_PRESETS;

/**
 * Check if ElevenLabs is configured (API key exists on server)
 */
export async function isElevenLabsAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/tts/status');
    const data = await res.json();
    return data.available === true;
  } catch {
    return false;
  }
}

/**
 * Generate speech audio from text via server proxy.
 * Returns an audio Blob (mp3).
 */
export async function generateSpeech(
  text: string,
  voicePreset: VoicePreset = 'warm_female',
): Promise<Blob | null> {
  try {
    const res = await fetch('/api/tts/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voiceId: VOICE_PRESETS[voicePreset],
      }),
    });
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

/**
 * Play TTS audio with controls. Returns control object.
 */
export function playTTSAudio(blob: Blob): {
  audio: HTMLAudioElement;
  play: () => void;
  pause: () => void;
  stop: () => void;
  setRate: (rate: number) => void;
  setVolume: (vol: number) => void;
  onEnd: (cb: () => void) => void;
} {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.playbackRate = 0.9; // slightly slower for bedtime

  return {
    audio,
    play: () => audio.play(),
    pause: () => audio.pause(),
    stop: () => { audio.pause(); audio.currentTime = 0; URL.revokeObjectURL(url); },
    setRate: (rate: number) => { audio.playbackRate = rate; },
    setVolume: (vol: number) => { audio.volume = Math.max(0, Math.min(1, vol)); },
    onEnd: (cb: () => void) => { audio.addEventListener('ended', cb); },
  };
}
