import { useState, useEffect } from 'react';

import { Calibration } from './components/Calibration';
import { Landing } from './components/Landing';
import { TestInterface } from './components/TestInterface';
import { Results } from './components/Results';
import { useHearingTest } from './hooks/useHearingTest';

type View = 'landing' | 'calibration' | 'test' | 'results';

function App() {
  const [view, setView] = useState<View>('landing');
  const [testFrequencies, setTestFrequencies] = useState<number[]>([]);

  const { state: testState, startTest, handleInput, pauseTest, resumeTest, stopTest, switchFrequencies, switchFrequencyStep } = useHearingTest();

  // Watch for test completion
  useEffect(() => {
     if (testState.status === 'completed' && view === 'test') {
         setView('results');
     }
  }, [testState.status, view]);

  const handleStartCalibration = (freqs: number[]) => {
      setTestFrequencies(freqs);
      setView('calibration');
  };

  const handleFinishCalibration = (baselineGain: number) => {
      setView('test');
      startTest(testFrequencies, baselineGain);
  };

  const handleRestart = () => {
      setView('landing');
  };

  const handleRecalibrate = () => {
      stopTest();
      setView('calibration');
  };

  const handleContinue = () => {
    // Continue with HIGH frequencies, keeping previous results
    setView('test');
    startTest([5000, 5500, 6000, 6500, 7000, 7500, 8000], testState.baselineGain || 0.001, true);
  };

  return (
    <div className="app-container">
      {view === 'landing' && <Landing onStart={handleStartCalibration} />}
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
