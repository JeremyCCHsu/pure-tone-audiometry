import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { audioEngine } from '../audio/AudioEngine';
import { Ear, TestResult } from '../types';

interface ManualTestInterfaceProps {
  baselineGain: number;
  onRecordResult: (result: TestResult) => void;
  onHome: () => void;
  onViewResults: () => void;
}

export const ManualTestInterface: React.FC<ManualTestInterfaceProps> = ({
  baselineGain,
  onRecordResult,
  onHome,
  onViewResults
}) => {
  const { t } = useTranslation();
  const [currentFreq, setCurrentFreq] = useState<number>(1000);
  const [currentVol, setCurrentVol] = useState<number>(0); // dB relative
  const [currentEar, setCurrentEar] = useState<Ear>('left');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const audioControlRef = useRef<{ stop: () => void, setVolume: (g: number) => void } | null>(null);

  const [lastRecorded, setLastRecorded] = useState<string | null>(null);
  const [testedEars, setTestedEars] = useState<Ear[]>([]);

  // Available frequencies for stepping
  const availableFreqs = [125, 250, 500, 750, 1000, 1500, 2000, 3000, 4000, 6000, 8000];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();

      // Volume controls
      if (k === 'y') {
        adjustVolume(5);
      } else if (k === 'h') {
        adjustVolume(-5);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentVol, isPlaying]); // Add isPlaying dependency as ajustVolume uses ref potentially? No, adjustVolume updates state which triggers effect?
  // Wait, adjustVolume uses functional state update. But we need to update audio if isPlaying.
  // We can do that inside setCurrentVol callback or as a side effect.
  // Best to do it in the function itself but we need access to ref.

  // Re-write adjustVolume to check valid range and possibly update audio.

  const adjustVolume = (delta: number) => {
    setCurrentVol(prev => {
        const newVol = prev + delta;
        // Calculate max dB based on baselineGain
        const headroom = 20 * Math.log10(1.0 / baselineGain);
        const limit = 80;
        const maxDb = Math.min(headroom, limit);

        let finalVol = newVol;
        if (finalVol > maxDb) finalVol = Math.floor(maxDb);
        if (finalVol < -30) finalVol = -30; // Allow quieter

        // If playing, update gain immediately
        if (audioControlRef.current) {
             const gain = baselineGain * Math.pow(10, finalVol / 20);
             const clampedGain = Math.min(1.0, Math.max(0, gain));
             audioControlRef.current.setVolume(clampedGain);
             // Note: setVolume in AudioEngine ramps to value.
        }

        return finalVol;
    });
  };

  const toggleTone = () => {
    if (isPlaying) {
        if (audioControlRef.current) {
            audioControlRef.current.stop();
            audioControlRef.current = null;
        }
        setIsPlaying(false);
    } else {
        // Calculate Gain
        // gain = baseline * 10^(db/20)
        const gain = baselineGain * Math.pow(10, currentVol / 20);
        const clampedGain = Math.min(1.0, Math.max(0, gain));
        const pan = currentEar === 'left' ? -1 : 1;

        setIsPlaying(true);
        // Play for a very long duration (e.g. 1 hour) effectively infinite until stopped
        // Play for a very long duration (e.g. 1 hour) effectively infinite until stopped
        const { stop, setVolume } = audioEngine.playTone(currentFreq, clampedGain, pan, 3600);
        audioControlRef.current = { stop, setVolume };
    }
  };

  const handleRecord = () => {
      const result: TestResult = {
          frequency: currentFreq,
          ear: currentEar,
          db: currentVol,
          responseDetected: true, // User confirmed they heard it
          timestamp: Date.now()
      };
      onRecordResult(result);
      setLastRecorded(`${currentFreq}Hz ${currentEar.toUpperCase()} @ ${currentVol}dB`);

      // Clear message after 3s
      setTimeout(() => setLastRecorded(null), 3000);

      // Stop tone if playing
      if (isPlaying) {
          toggleTone();
      }

      // Smart Navigation
      const newTestedEars = [...testedEars];
      if (!newTestedEars.includes(currentEar)) {
          newTestedEars.push(currentEar);
      }
      setTestedEars(newTestedEars);

      const hasLeft = newTestedEars.includes('left');
      const hasRight = newTestedEars.includes('right');

      if (hasLeft && hasRight) {
           // Both ears done for this freq -> Next Freq
           const idx = availableFreqs.indexOf(currentFreq);
           if (idx < availableFreqs.length - 1) {
               const nextFreq = availableFreqs[idx + 1];
               setCurrentFreq(nextFreq);
               setCurrentEar('left');
               setTestedEars([]);
               setCurrentVol(0); // Reset volume
           } else {
               // Finished all?
               alert(t('manual.allTested'));
           }
      } else {
          // Switch Ear
          setCurrentEar(prev => prev === 'left' ? 'right' : 'left');
          setCurrentVol(0); // Reset volume
      }
  };

  const stepFreq = (dir: 'up' | 'down') => {
      const idx = availableFreqs.indexOf(currentFreq);
      let newFreq = currentFreq;
      if (dir === 'up') {
          if (idx < availableFreqs.length - 1) newFreq = availableFreqs[idx + 1];
      } else {
          if (idx > 0) newFreq = availableFreqs[idx - 1];
      }

      if (newFreq !== currentFreq) {
          setCurrentFreq(newFreq);
          setTestedEars([]); // Reset tested ears when manually changing freq
          if (isPlaying) toggleTone(); // Stop if playing
      }
  };

  // Waveform visualization (reused)
  const drawWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const data = audioEngine.getWaveformData();

    ctx.fillStyle = '#242424';
    ctx.fillRect(0, 0, width, height);

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    if (data.length > 0) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#646cff';
        ctx.beginPath();

        const sliceWidth = width * 1.0 / data.length;
        let x = 0;

        for (let i = 0; i < data.length; i++) {
            const v = data[i] / 128.0;
            const y = (v * height) / 2;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
            x += sliceWidth;
        }
        ctx.stroke();
    }

    animationRef.current = requestAnimationFrame(drawWaveform);
  };

  useEffect(() => {
    drawWaveform();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', justifyContent: 'center' }}>
      <h2>{t('manual.title')}</h2>

      <div style={{ marginBottom: '1rem', fontSize: '1.5em', color: '#888' }}>
        {isPlaying ? (
           <span style={{ color: '#646cff', fontWeight: 'bold' }}>{t('manual.playing')}</span>
        ) : (
           <span>{t('manual.ready')}</span>
        )}
      </div>

      <div style={{ height: '24px', marginBottom: '0.5rem', color: '#4caf50', fontWeight: 'bold' }}>
          {lastRecorded && <span>{t('manual.recorded')}: {lastRecorded}</span>}
      </div>

      <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.5rem',
          width: '100%',
          maxWidth: '500px',
          backgroundColor: '#1a1a1a',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '0.5rem'
      }}>
          {/* Ear Control */}
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <button
                onClick={() => setCurrentEar('left')}
                style={{
                    flex: 1,
                    backgroundColor: currentEar === 'left' ? 'rgba(100,108,255,0.2)' : '#333',
                    border: `1px solid ${currentEar === 'left' ? '#646cff' : '#444'}`,
                    color: currentEar === 'left' ? '#fff' : '#888',
                    padding: '0.5rem'
                }}
              >
                  {t('manual.leftEar')}
              </button>
              <button
                onClick={() => setCurrentEar('right')}
                style={{
                    flex: 1,
                    backgroundColor: currentEar === 'right' ? 'rgba(255,99,132,0.2)' : '#333',
                    border: `1px solid ${currentEar === 'right' ? '#ff6384' : '#444'}`,
                    color: currentEar === 'right' ? '#fff' : '#888',
                    padding: '0.5rem'
                }}
              >
                  {t('manual.rightEar')}
              </button>
          </div>

          {/* Frequency Control */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
              <span style={{ color: '#888', fontSize: '0.8rem' }}>{t('manual.frequency')}</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', width: '120px', textAlign: 'center' }}>{currentFreq} Hz</div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => stepFreq('down')} style={{ padding: '0.3rem 0.8rem' }}>&lt;</button>
                  <button onClick={() => stepFreq('up')} style={{ padding: '0.3rem 0.8rem' }}>&gt;</button>
              </div>
          </div>

          {/* Volume Control */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
              <span style={{ color: '#888', fontSize: '0.8rem' }}>{t('manual.volume')}</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', width: '100px', textAlign: 'center' }}>{currentVol} dB</div>
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button onClick={() => adjustVolume(-5)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>-5</button>
                  <button onClick={() => adjustVolume(-1)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>-1</button>
                  <button onClick={() => adjustVolume(1)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>+1</button>
                  <button onClick={() => adjustVolume(5)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>+5</button>
              </div>
          </div>
      </div>

      <canvas
        ref={canvasRef}
        width={400}
        height={60}
        style={{
            marginBottom: '0.5rem',
            borderRadius: '4px',
            background: '#242424',
            border: '1px solid #333',
            width: '100%',
            maxWidth: '500px',
            height: '60px'
        }}
      />

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={toggleTone}
            style={{
                backgroundColor: isPlaying ? '#d32f2f' : '#646cff',
                padding: '1rem 2rem',
                fontSize: '1.1rem',
                minWidth: '150px'
            }}
          >
              {isPlaying ? t('manual.stopTone') : t('manual.playTone')}
          </button>

          <button
            onClick={handleRecord}
            style={{
                backgroundColor: '#28a745',
                padding: '1rem 2rem',
                fontSize: '1.1rem',
                minWidth: '150px'
            }}
          >
              {t('manual.confirmRecord')}
          </button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
          <button onClick={onHome} style={{ backgroundColor: '#444' }}>{t('manual.home')}</button>
          <button onClick={onViewResults} style={{ backgroundColor: '#444' }}>{t('manual.viewResults')}</button>
      </div>

    </div>
  );
};
