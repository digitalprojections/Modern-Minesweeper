import { describe, expect, it, vi } from 'vitest';

import { createGameAudio, createSoundPlan, type GameSound } from './gameAudio';

describe('game audio plans', () => {
  it('defines short modern cues for each gameplay moment', () => {
    const sounds: GameSound[] = ['start', 'reveal', 'clear', 'flag', 'unflag', 'win', 'lose', 'reset', 'toggle'];

    for (const sound of sounds) {
      const plan = createSoundPlan(sound);

      expect(plan.tones.length).toBeGreaterThan(0);
      expect(plan.tones.every(tone => tone.duration > 0 && tone.duration <= 0.4)).toBe(true);
    }
  });

  it('makes win brighter and longer than a normal reveal', () => {
    const revealDuration = totalDuration(createSoundPlan('reveal'));
    const winDuration = totalDuration(createSoundPlan('win'));
    const winHighTone = createSoundPlan('win').tones.some(tone => tone.frequency > 1000);

    expect(winDuration).toBeGreaterThan(revealDuration);
    expect(winHighTone).toBe(true);
  });

  it('adds filtered noise to the mine explosion cue', () => {
    const plan = createSoundPlan('lose');

    expect(plan.noise).toMatchObject({ lowpass: 520 });
  });
});

describe('game audio player', () => {
  it('does not create an audio context while muted', () => {
    const factory = vi.fn(() => createAudioContextStub());
    const audio = createGameAudio({ initiallyEnabled: false, audioContextFactory: factory });

    audio.play('reveal');

    expect(factory).not.toHaveBeenCalled();
  });

  it('lazily creates one audio context and reuses it', () => {
    const factory = vi.fn(() => createAudioContextStub());
    const audio = createGameAudio({ audioContextFactory: factory });

    audio.play('flag');
    audio.play('unflag');

    expect(factory).toHaveBeenCalledTimes(1);
  });
});

function totalDuration(plan: ReturnType<typeof createSoundPlan>) {
  const toneDuration = plan.tones.reduce((max, tone) => Math.max(max, (tone.delay ?? 0) + tone.duration), 0);
  const noiseDuration = plan.noise ? (plan.noise.delay ?? 0) + plan.noise.duration : 0;
  return Math.max(toneDuration, noiseDuration);
}

function createAudioContextStub() {
  const audioParam = {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  const node = {
    connect: vi.fn(),
  };

  return {
    currentTime: 1,
    destination: node,
    sampleRate: 100,
    state: 'running',
    resume: vi.fn(),
    suspend: vi.fn(),
    createGain: vi.fn(() => ({ ...node, gain: audioParam })),
    createOscillator: vi.fn(() => ({
      ...node,
      frequency: audioParam,
      start: vi.fn(),
      stop: vi.fn(),
      type: 'sine',
    })),
    createBuffer: vi.fn(() => ({
      getChannelData: vi.fn(() => new Float32Array(20)),
    })),
    createBufferSource: vi.fn(() => ({
      ...node,
      start: vi.fn(),
      stop: vi.fn(),
      buffer: null,
    })),
    createBiquadFilter: vi.fn(() => ({
      ...node,
      frequency: audioParam,
      type: 'lowpass',
    })),
  } as unknown as AudioContext;
}
