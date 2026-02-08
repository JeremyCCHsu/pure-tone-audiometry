const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  public analyser: AnalyserNode | null = null;

  constructor() {
    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;

    // Connect graph: masterGain -> analyser -> destination
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    this.masterGain.gain.value = 1.0; // Starting master volume
  }

  async init() {
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  // Convert "dB HL" approximation to gain (0-1).
  // This is relative. 0 dB means max calibrated volume. -10 dB is half perceived loudness?
  // Standard formula: gain = 10 ^ (dB / 20)
  // But here our Db scale is 0 (max) downwards or 0 (min) upwards?
  // Let's assume input 'db' is 0 to 100 where 100 is loud.
  // Actually, usually audiograms use 0 dBHL as very quiet and 100 dBHL as loud.
  // But we are working with digital full scale (dBFS).
  // Let's abstract this. The UI will pass a simplified Volume Level (0-100) or we map to gain directly.
  playTone(freq: number, volumeDb: number, pan: number, duration: number): { stop: () => void, promise: Promise<void>, setVolume: (db: number) => void } {
      let stopFunc = () => {};
      let setVolumeFunc = (db: number) => { console.log(db); }; // Placeholder

      const promise = new Promise<void>((resolve) => {
        if (!this.ctx || !this.masterGain) return resolve();

        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        const panner = this.ctx.createStereoPanner();

        osc.type = 'sine';
        osc.frequency.value = freq;

        panner.pan.value = pan; // -1 (left) to 1 (right)

        // Ramp to avoid clicks
        const now = this.ctx.currentTime;
        const attack = 0.02;
        const release = 0.02;

        const gain = volumeDb;

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(gain, now + attack);
        // If duration is very long, we don't schedule end ramp yet?
        // But the previous implementation scheduled it.
        // Let's keep scheduling it, but rely on stopFunc to cancel.
        gainNode.gain.setValueAtTime(gain, now + duration - release);
        gainNode.gain.linearRampToValueAtTime(0, now + duration);

        osc.connect(panner);
        panner.connect(gainNode);
        gainNode.connect(this.masterGain!);

        osc.start(now);
        osc.stop(now + duration + 0.1); // buffer

        let isStopped = false;

        stopFunc = () => {
            if (isStopped) return;
            isStopped = true;
            try {
                const t = this.ctx?.currentTime || 0;
                gainNode.gain.cancelScheduledValues(t);
                gainNode.gain.linearRampToValueAtTime(0, t + 0.05);
                osc.stop(t + 0.05);
            } catch(e) { console.error(e); }
        };

        setVolumeFunc = (vol: number) => {
            if (isStopped) return;
            try {
                 const t = this.ctx?.currentTime || 0;
                 // Ramp to new volume
                 gainNode.gain.cancelScheduledValues(t);
                 gainNode.gain.setValueAtTime(gainNode.gain.value, t); // Current value
                 gainNode.gain.linearRampToValueAtTime(vol, t + 0.1);

                 // Re-schedule end?
                 // Since we cancelled scheduled values, the 'end' ramp is gone.
                 // If we have a fixed duration, we should re-schedule the end?
                 // But for manual mode (toggle), we rely on manual stop.
                 // For original 'duration' based calls, this might be tricky if we don't know remaining time.
                 // However, setVolume is mostly for the toggle/manual mode which uses 3600s.
            } catch(e) { console.error(e); }
        };

        osc.onended = () => {
          osc.disconnect();
          panner.disconnect();
          gainNode.disconnect();
          resolve();
        };
      });

      return { stop: stopFunc, promise, setVolume: setVolumeFunc };
    }

  setMasterVolume(val: number) {
      if(this.masterGain) this.masterGain.gain.value = val;
  }

  getWaveformData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteTimeDomainData(dataArray);
    return dataArray;
  }
  startContinuousTone(freq: number, initialGain: number): { stop: () => void; setGain: (g: number) => void } {
    if (!this.ctx || !this.masterGain) {
      return { stop: () => {}, setGain: () => {} };
    }

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner();

    osc.type = 'sine';
    osc.frequency.value = freq;
    panner.pan.value = 0; // Center

    const now = this.ctx.currentTime;
    gainNode.gain.setValueAtTime(initialGain, now);

    osc.connect(panner);
    panner.connect(gainNode);
    gainNode.connect(this.masterGain);

    osc.start();

    return {
      stop: () => {
        try {
          const t = this.ctx?.currentTime || 0;
          gainNode.gain.linearRampToValueAtTime(0, t + 0.1);
          osc.stop(t + 0.1);
          setTimeout(() => {
            osc.disconnect();
            panner.disconnect();
            gainNode.disconnect();
          }, 200);
        } catch (e) {
          console.error(e);
        }
      },
      setGain: (g: number) => {
        const t = this.ctx?.currentTime || 0;
        gainNode.gain.cancelScheduledValues(t);
        gainNode.gain.linearRampToValueAtTime(g, t + 0.1);
      }
    };
  }
}

export const audioEngine = new AudioEngine();
