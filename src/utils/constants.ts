export const FREQUENCIES = {
  LOW: [125, 250, 500, 1000, 2000, 4000],
  HIGH: [4000, 4500, 5000, 5500, 6000, 6500, 7000, 7500, 8000],
  FULL: [125, 250, 500, 1000, 2000, 4000, 6000, 8000, 10000],
};

// We will default to a combined list or allow selection.
// Starting with standard clinical set.
export const STANDARD_FREQUENCIES = FREQUENCIES.LOW;

export const MAX_REL_DB = 0; // "0 dB" at full volume relative to calibration
export const MIN_REL_DB = -80;
export const DB_STEP = 5; // Clinical standard is 5dB steps

export const TEST_TONE_DURATION = 2000; // ms
export const RESPONSE_WINDOW = 2500; // ms window to respond after start
export const INTERVAL_GAP_MIN = 1000;
export const INTERVAL_GAP_MAX = 3000;
export const CALIBRATION_DB = -60;
