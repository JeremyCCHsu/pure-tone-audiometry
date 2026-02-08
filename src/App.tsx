import { useState, useEffect } from 'react';

import { Calibration } from './components/Calibration';
import { Landing } from './components/Landing';
import { TestInterface } from './components/TestInterface';
import { Results } from './components/Results';
import { useHearingTest } from './hooks/useHearingTest';

import { ManualTestInterface } from './components/ManualTestInterface';

type View = 'landing' | 'calibration' | 'test' | 'manual' | 'results';

function App() {
  const [view, setView] = useState<View>('landing');
  const [testFrequencies, setTestFrequencies] = useState<number[]>([]);
  const [isManualMode, setIsManualMode] = useState(false);
  const [calibrationGain, setCalibrationGain] = useState<number>(0.001);

  const { state: testState, startTest, handleInput, pauseTest, resumeTest, stopTest, switchFrequencies, switchFrequencyStep, addResult } = useHearingTest();

  // Watch for test completion
  useEffect(() => {
     if (testState.status === 'completed' && view === 'test') {
         setView('results');
     }
  }, [testState.status, view]);

  const handleStartCalibration = (freqs: number[]) => {
      setTestFrequencies(freqs);
      setIsManualMode(false);
      setView('calibration');
  };

  const handleStartManual = () => {
      // Skip calibration for manual mode
      setIsManualMode(true);
      setCalibrationGain(0.001); // Default calibration or last known?
      // Ideally we might want to calibrate once? But request says skip.
      // We will use a default safe baseline.
      setView('manual');
  };

  const handleFinishCalibration = (baselineGain: number) => {
      setCalibrationGain(baselineGain);
      if (isManualMode) {
          setView('manual');
      } else {
          setView('test');
          startTest(testFrequencies, baselineGain);
      }
  };

  const handleRestart = () => {
      setView('landing');
      setIsManualMode(false);
  };

  const handleRecalibrate = () => {
      stopTest();
      setView('calibration');
  };

  const handleShowResults = () => {
      setView('results');
  };

  const handleContinue = () => {
    // Continue with HIGH frequencies, keeping previous results
    setView('test');
    startTest([5000, 5500, 6000, 6500, 7000, 7500, 8000], calibrationGain, true);
  };

  return (
    <div className="app-container">
      {view === 'landing' && <Landing onStart={handleStartCalibration} onManualStart={handleStartManual} />}
      {view === 'calibration' && <Calibration onComplete={handleFinishCalibration} onHome={handleRestart} />}
      {view === 'test' && (
          <TestInterface
            state={testState}
            onInput={handleInput}
            onStop={stopTest}
            onPause={pauseTest}
            onResume={resumeTest}
            onSwitchFreqs={switchFrequencies}
            onRecalibrate={handleRecalibrate}
            onHome={handleRestart}
            onFrequencyStep={switchFrequencyStep}
          />
      )}
      {view === 'manual' && (
          <ManualTestInterface
              baselineGain={calibrationGain}
              onRecordResult={(res) => addResult(res.frequency, res.ear, res.db, res.responseDetected, res.reactionTime)}
              onHome={handleRestart}
              onViewResults={handleShowResults}
          />
      )}
      {view === 'results' &&
        <Results
            results={testState.results}
            baselineGain={testState.baselineGain}
            onRestart={handleRestart}
            onContinue={handleContinue}
            onHome={handleRestart}
        />
      }
    </div>
  );
}

export default App;
