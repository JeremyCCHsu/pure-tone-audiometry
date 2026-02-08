export type Ear = 'left' | 'right';

export interface TestResult {
  frequency: number;
  ear: Ear;
  db: number; // Relative dB (0 to -X or a 0-100 scale represented as dBHL approximation)
  responseDetected: boolean;
  reactionTime?: number; // ms
  timestamp: number;
}

export interface HearingTestState {
  isPlaying: boolean;
  currentFreq: number;
  currentDb: number;
  currentEar: Ear;
  results: TestResult[];
  status: 'idle' | 'calibrating' | 'testing' | 'paused' | 'completed';
  baselineGain?: number;
}
