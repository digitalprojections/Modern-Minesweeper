export type GameSound = 'start' | 'reveal' | 'clear' | 'flag' | 'unflag' | 'win' | 'lose' | 'reset' | 'toggle';

type OscillatorKind = 'sine' | 'triangle' | 'square' | 'sawtooth';

export type ToneStep = {
  oscillator: OscillatorKind;
  frequency: number;
  duration: number;
  delay?: number;
  gain?: number;
  slideTo?: number;
};

export type NoiseStep = {
  duration: number;
  delay?: number;
  gain?: number;
  lowpass?: number;
};

export type SoundPlan = {
  tones: ToneStep[];
  noise?: NoiseStep;
};

type AudioContextLike = AudioContext;

type AudioOptions = {
  initiallyEnabled?: boolean;
  audioContextFactory?: () => AudioContextLike;
};

export function createGameAudio(options: AudioOptions = {}) {
  let enabled = options.initiallyEnabled ?? true;
  let context: AudioContextLike | null = null;

  const getContext = () => {
    if (!enabled) return null;
    if (context) return context;

    const factory = options.audioContextFactory ?? getBrowserAudioContextFactory();
    if (!factory) return null;

    try {
      context = factory();
      return context;
    } catch {
      return null;
    }
  };

  const play = (sound: GameSound) => {
    const audioContext = getContext();
    if (!audioContext) return;

    if (audioContext.state === 'suspended') {
      void audioContext.resume();
    }

    playPlan(audioContext, createSoundPlan(sound));
  };

  return {
    play,
    setEnabled(value: boolean) {
      enabled = value;
      if (!enabled && context) {
        void context.suspend();
      }
    },
    isEnabled() {
      return enabled;
    },
  };
}

export function createSoundPlan(sound: GameSound): SoundPlan {
  switch (sound) {
    case 'start':
      return {
        tones: [
          { oscillator: 'triangle', frequency: 392, slideTo: 587, duration: 0.08, gain: 0.08 },
          { oscillator: 'sine', frequency: 784, duration: 0.07, delay: 0.06, gain: 0.045 },
        ],
      };
    case 'reveal':
      return {
        tones: [
          { oscillator: 'triangle', frequency: 520, slideTo: 720, duration: 0.045, gain: 0.045 },
        ],
      };
    case 'clear':
      return {
        tones: [
          { oscillator: 'sine', frequency: 330, slideTo: 660, duration: 0.11, gain: 0.045 },
          { oscillator: 'triangle', frequency: 990, duration: 0.06, delay: 0.035, gain: 0.026 },
        ],
      };
    case 'flag':
      return {
        tones: [
          { oscillator: 'square', frequency: 740, duration: 0.05, gain: 0.035 },
          { oscillator: 'triangle', frequency: 980, duration: 0.04, delay: 0.04, gain: 0.035 },
        ],
      };
    case 'unflag':
      return {
        tones: [
          { oscillator: 'triangle', frequency: 840, slideTo: 420, duration: 0.075, gain: 0.04 },
        ],
      };
    case 'win':
      return {
        tones: [
          { oscillator: 'sine', frequency: 523.25, duration: 0.12, gain: 0.05 },
          { oscillator: 'sine', frequency: 659.25, duration: 0.12, delay: 0.08, gain: 0.05 },
          { oscillator: 'sine', frequency: 783.99, duration: 0.16, delay: 0.16, gain: 0.06 },
          { oscillator: 'triangle', frequency: 1174.66, duration: 0.2, delay: 0.26, gain: 0.035 },
        ],
      };
    case 'lose':
      return {
        tones: [
          { oscillator: 'sawtooth', frequency: 180, slideTo: 54, duration: 0.38, gain: 0.075 },
        ],
        noise: { duration: 0.18, gain: 0.05, lowpass: 520 },
      };
    case 'reset':
      return {
        tones: [
          { oscillator: 'triangle', frequency: 620, slideTo: 280, duration: 0.075, gain: 0.035 },
          { oscillator: 'sine', frequency: 440, duration: 0.055, delay: 0.055, gain: 0.03 },
        ],
      };
    case 'toggle':
      return {
        tones: [
          { oscillator: 'sine', frequency: 680, duration: 0.045, gain: 0.03 },
        ],
      };
  }
}

function playPlan(audioContext: AudioContextLike, plan: SoundPlan) {
  const now = audioContext.currentTime;
  const output = audioContext.createGain();
  output.gain.setValueAtTime(0.9, now);
  output.connect(audioContext.destination);

  plan.tones.forEach(step => playTone(audioContext, output, now, step));
  if (plan.noise) playNoise(audioContext, output, now, plan.noise);
}

function playTone(audioContext: AudioContextLike, output: GainNode, now: number, step: ToneStep) {
  const start = now + (step.delay ?? 0);
  const end = start + step.duration;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const peak = step.gain ?? 0.04;

  oscillator.type = step.oscillator;
  oscillator.frequency.setValueAtTime(step.frequency, start);
  if (step.slideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(step.slideTo, end);
  }

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  oscillator.connect(gain);
  gain.connect(output);
  oscillator.start(start);
  oscillator.stop(end + 0.02);
}

function playNoise(audioContext: AudioContextLike, output: GainNode, now: number, step: NoiseStep) {
  const sampleRate = audioContext.sampleRate;
  const frameCount = Math.max(1, Math.floor(sampleRate * step.duration));
  const buffer = audioContext.createBuffer(1, frameCount, sampleRate);
  const data = buffer.getChannelData(0);

  for (let index = 0; index < frameCount; index++) {
    data[index] = (Math.random() * 2 - 1) * (1 - index / frameCount);
  }

  const start = now + (step.delay ?? 0);
  const end = start + step.duration;
  const source = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();

  source.buffer = buffer;
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(step.lowpass ?? 800, start);
  gain.gain.setValueAtTime(step.gain ?? 0.04, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(output);
  source.start(start);
  source.stop(end + 0.02);
}

function getBrowserAudioContextFactory() {
  if (typeof window === 'undefined') return null;
  return window.AudioContext ? () => new window.AudioContext() : null;
}
