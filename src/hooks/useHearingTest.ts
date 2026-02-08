import { useState, useRef } from 'react';
import { audioEngine } from '../audio/AudioEngine';
import { TEST_TONE_DURATION, RESPONSE_WINDOW, INTERVAL_GAP_MIN, INTERVAL_GAP_MAX, CALIBRATION_DB } from '../utils/constants';
import { Ear, HearingTestState } from '../types';

// Removed PendingTest interface as we manage state differently now
interface TestProgress {
    freqIndex: number;
    earsRemaining: Ear[];
    currentEar: Ear;
    currentDb: number;
    history: { [db: number]: number }; // track hits per db
}

export const useHearingTest = () => {
  const [state, setState] = useState<HearingTestState>({
    isPlaying: false,
    currentFreq: 0,
    currentDb: CALIBRATION_DB,
    currentEar: 'left',
    results: [],
    status: 'idle',
  });

  // State for test logic
  const progressRef = useRef<TestProgress | null>(null);
  const frequenciesRef = useRef<number[]>([]);
  const baselineGainRef = useRef<number>(0.001);

  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const responseHandledRef = useRef(false);
  const audioControlRef = useRef<{ stop: () => void } | null>(null);

  const startTest = (frequencies: number[], baselineGain: number, keepResults: boolean = false) => {
    // Sort frequencies to start with 125Hz
    const sortedFreqs = [...frequencies].sort((a, b) => a - b);
    frequenciesRef.current = sortedFreqs;
    baselineGainRef.current = baselineGain;

    // Initialize first frequency
    const firstFreqIndex = 0;
    const ears = Math.random() < 0.5 ? ['left', 'right'] as Ear[] : ['right', 'left'] as Ear[];

    progressRef.current = {
        freqIndex: firstFreqIndex,
        earsRemaining: ears, // both ears for this freq
        currentEar: ears[0],
        currentDb: 0, // Start at 0 dB relative to baseline
        history: {}
    };

    setState(prev => ({
        ...prev,
        status: 'testing',
        results: keepResults ? prev.results : [],
        currentFreq: sortedFreqs[0],
        currentEar: ears[0],
        baselineGain: baselineGain
    }));
    setTimeout(() => runTrial(), 1500);
  };

  const runTrial = async () => {
    if (!progressRef.current) {
        finishTest();
        return;
    }
    const { freqIndex, currentEar, currentDb } = progressRef.current;

    if (freqIndex >= frequenciesRef.current.length) {
        finishTest();
        return;
    }

    const freq = frequenciesRef.current[freqIndex];

    setState(prev => ({
      ...prev,
      currentFreq: freq,
      currentEar: currentEar,
      currentDb: currentDb,
      isPlaying: true
    }));

    responseHandledRef.current = false;
    startTimeRef.current = Date.now();

    // Calculate Gain
    // baselineGain corresponds to 0 dB (relative)
    // gain = baseline * 10^(db/20)
    const gain = baselineGainRef.current * Math.pow(10, currentDb / 20);
    // Clamp gain (don't go above 1.0)
    const clampedGain = Math.min(1.0, Math.max(0, gain));

    const pan = currentEar === 'left' ? -1 : 1;

    const { stop } = audioEngine.playTone(freq, clampedGain, pan, TEST_TONE_DURATION / 1000);
    audioControlRef.current = { stop };

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
        handleTimeout();
    }, RESPONSE_WINDOW);

    setTimeout(() => {
        setState(s => ({ ...s, isPlaying: false }));
    }, TEST_TONE_DURATION);
  };

  const handleTimeout = () => {
    if (responseHandledRef.current || !progressRef.current) return;
    responseHandledRef.current = true;

    // No response -> Increase volume by 5dB
    // Record fail for this specific trial
    if (progressRef.current) {
        recordResult(frequenciesRef.current[progressRef.current.freqIndex], progressRef.current.currentEar, progressRef.current.currentDb, false);
    }

    // But check safety limits
    if (progressRef.current.currentDb >= 60) {
        completeCurrentEar();
    } else {
        progressRef.current.currentDb += 5;
        scheduleNext();
    }
  };

  const scheduleNext = () => {
    const delay = Math.random() * (INTERVAL_GAP_MAX - INTERVAL_GAP_MIN) + INTERVAL_GAP_MIN;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => runTrial(), delay);
  };

  const handleInput = (key: string) => {
    if (key === 'Enter') {
        // "skips the current frequency-hear and go to the next frequency or ear"
        // Force move to next
        if (state.status !== 'testing' || !progressRef.current) return;

        if (audioControlRef.current) {
            audioControlRef.current.stop();
            audioControlRef.current = null;
        }
        if (timerRef.current) clearTimeout(timerRef.current);

        // Record as skip? Or just move on?
        // "Skips... and go to next".
        // Let's just call completeCurrentEar() which moves to next ear/freq.
        // Should we record a "Non-Response"?
        // Request doesn't specify recording. Assuming just "Next".
        // Use completeCurrentEar().
        completeCurrentEar();
        return;
    }

    if (state.status !== 'testing' || responseHandledRef.current || !progressRef.current) return;

    const reactionTime = Date.now() - startTimeRef.current;
    const { currentEar, currentDb, freqIndex } = progressRef.current;
    const freq = frequenciesRef.current[freqIndex];

    if (key === ' ') {
        // Skip -> Record as Miss due to skip?
        // "Failed trials are shown as crosses".
        // We will record it as a specialized failure or regular fail.
        if (audioControlRef.current) {
            audioControlRef.current.stop();
            audioControlRef.current = null;
        }
        recordResult(freq, currentEar, currentDb, false, reactionTime);
        handleTimeout(); // Proceed as if timeout (increase volume) but allow immediate next
        return;
    }

    let detectedEar: Ear | null = null;
    if (key.toLowerCase() === 'f') detectedEar = 'left';
    if (key.toLowerCase() === 'j') detectedEar = 'right';

    if (detectedEar) {
        responseHandledRef.current = true;
        if (audioControlRef.current) {
             audioControlRef.current.stop();
             audioControlRef.current = null;
        }
        if (timerRef.current) clearTimeout(timerRef.current);

        if (detectedEar === currentEar) {
            // Correct Ear
            // Track hit
            const hits = (progressRef.current.history[currentDb] || 0) + 1;
            progressRef.current.history[currentDb] = hits;


            // Check termination: 2 times
            if (hits >= 2) {
                // Threshold found!
                recordResult(freq, currentEar, currentDb, true, reactionTime);
                completeCurrentEar();
            } else {
                // Heard once. Decrease volume.
                progressRef.current.currentDb -= 2.5;
                scheduleNext();
            }
        } else {
            // Wrong ear. Record MISS.
            recordResult(freq, currentEar, currentDb, false, reactionTime);
             progressRef.current.currentDb += 5;
             scheduleNext();
        }
    }
  };

  const completeCurrentEar = () => {
      if (!progressRef.current) return;

      // Capture last dB for adaptive start
      const lastDb = progressRef.current.currentDb;

      // Move to next ear or next freq
      const earsRemaining = progressRef.current.earsRemaining;

      // We just finished earsRemaining[0]
      // Remove it?
      // Actually earsRemaining was initialized like ['left', 'right']
      // We are listening to 'currentEar'.
      // Let's just shift properly.

      // Wait, currentEar matches earsRemaining[0] implicitly in my logic?
      // Let's make it explicit.

      // Remove current ear from list
      const nextEars = earsRemaining.filter(e => e !== progressRef.current!.currentEar);

      if (nextEars.length > 0) {
          // Setup next ear for same freq
          progressRef.current.earsRemaining = nextEars;
          progressRef.current.currentEar = nextEars[0];
          progressRef.current.currentDb = 0; // Reset to baseline
          progressRef.current.history = {};
          scheduleNext();
      } else {
          // Next frequency
          const nextFreqIdx = progressRef.current.freqIndex + 1;
          if (nextFreqIdx >= frequenciesRef.current.length) {
              finishTest();
          } else {
              const newEars = Math.random() < 0.5 ? ['left', 'right'] as Ear[] : ['right', 'left'] as Ear[];
              progressRef.current.freqIndex = nextFreqIdx;
              progressRef.current.earsRemaining = newEars;
              progressRef.current.currentEar = newEars[0];
              progressRef.current.currentDb = lastDb;
              progressRef.current.history = {};
              scheduleNext();
          }
      }
  };

  const recordResult = (freq: number, ear: Ear, db: number, detected: boolean, time?: number) => {
    setState(prev => ({
        ...prev,
        results: [...prev.results, {
            frequency: freq,
            ear,
            db,
            responseDetected: detected,
            reactionTime: time,
            timestamp: Date.now()
        }]
    }));
  };

  const pauseTest = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setState(prev => ({ ...prev, status: 'paused', isPlaying: false }));
  };

  const resumeTest = () => {
      setState(prev => ({ ...prev, status: 'testing' }));
      // Resume immediately or with delay?
      setTimeout(() => runTrial(), 1000);
  };

  const stopTest = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      finishTest();
  };

  /* Manual Frequency Switch Logic */
  const switchFrequencyStep = (direction: 'next' | 'prev') => {
      if (!progressRef.current || frequenciesRef.current.length === 0) return;

      const currentIndex = progressRef.current.freqIndex;
      let newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;

      // Clamp index
      if (newIndex < 0) newIndex = 0;
      if (newIndex >= frequenciesRef.current.length) newIndex = frequenciesRef.current.length - 1;

      if (newIndex === currentIndex) return;

      // Reset for new freq
      const newEars = Math.random() < 0.5 ? ['left', 'right'] as Ear[] : ['right', 'left'] as Ear[];
      progressRef.current.freqIndex = newIndex;
      progressRef.current.earsRemaining = newEars;
      progressRef.current.currentEar = newEars[0];
      progressRef.current.currentDb = 0; // Reset DB for manual switch
      progressRef.current.history = {};

      // Stop current audio if playing
      if (audioControlRef.current) {
          audioControlRef.current.stop();
          audioControlRef.current = null;
      }
      if (timerRef.current) clearTimeout(timerRef.current);

      // Trigger next trial immediately if we are 'testing'
      // If 'paused', just update state to show new freq?
      if (state.status === 'testing') {
         runTrial();
      } else {
         // Just update display state
         setState(prev => ({
             ...prev,
             currentFreq: frequenciesRef.current[newIndex],
             currentEar: newEars[0],
             currentDb: 0
         }));
      }
  };

  const switchFrequencies = (frequencies: number[]) => {
      // Allow swiching frequencies mid test?
      // Reset progression with new frequencies
      const sortedFreqs = [...frequencies].sort((a, b) => a - b);
      frequenciesRef.current = sortedFreqs;

      // Reset logic: start from index 0 of new list?
      const firstFreqIndex = 0;
      const ears = Math.random() < 0.5 ? ['left', 'right'] as Ear[] : ['right', 'left'] as Ear[];

      progressRef.current = {
        freqIndex: firstFreqIndex,
        earsRemaining: ears,
        currentEar: ears[0],
        currentDb: 0,
        history: {}
      };
      // Logic from switchFrequencyStep might need to be applied if we want immediate update.
      // But switchFrequencies is usually called from menu. Resume will handle it?
  };

  const finishTest = () => {
    setState(prev => ({ ...prev, status: 'completed', isPlaying: false }));
  };

  return {
    state,
    startTest,
    handleInput,
    pauseTest,
    resumeTest,
    stopTest,
    switchFrequencies,
    switchFrequencyStep,
    addResult: recordResult
  };
};
