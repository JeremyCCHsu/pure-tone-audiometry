import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { audioEngine } from '../audio/AudioEngine';

interface CalibrationProps {
  onComplete: (baselineGain: number) => void;
  onHome: () => void;
}

export const Calibration: React.FC<CalibrationProps> = ({ onComplete, onHome }) => {
  const { t } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [gain, setGain] = useState(0.001); // Start at ~-60dB
  const toneControl = useRef<{ stop: () => void; setGain: (g: number) => void } | null>(null);

  /* Move handleStartTest up */
  const handleStartTest = () => {
    if (toneControl.current) {
      toneControl.current.stop();
    }
    onComplete(gain);
  };

  useEffect(() => {
    return () => {
      if (toneControl.current) {
        toneControl.current.stop();
      }
    };
  }, []);

  const adjustVolume = (dbStep: number) => {
      const multiplier = Math.pow(10, dbStep / 20);
      let newGain = gain * multiplier;
      // Clamp between -90dB and 0dB (approx)
      newGain = Math.min(1.0, Math.max(0.0000001, newGain));
      setGain(newGain);
      if (toneControl.current) {
          toneControl.current.setGain(newGain);
      }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
          handleStartTest();
          return;
      }

      if (!isPlaying) return;

      const k = e.key.toLowerCase();
      if (k === 'y') {
        adjustVolume(5);
      } else if (k === 'h') {
        adjustVolume(-5);
      } else if (k === 'i') {
        adjustVolume(1);
      } else if (k === 'k') {
        adjustVolume(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, gain, handleStartTest]);

  const toggleTone = async () => {
    if (isPlaying) {
      if (toneControl.current) {
        toneControl.current.stop();
        toneControl.current = null;
      }
      setIsPlaying(false);
    } else {
      await audioEngine.init();
      toneControl.current = audioEngine.startContinuousTone(500, gain);
      setIsPlaying(true);
    }
  };

  /* Removed old handleStartTest */

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

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

    if (data.length > 0 && isPlaying) {
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
    if(isPlaying) {
        drawWaveform();
    } else {
        if(animationRef.current) cancelAnimationFrame(animationRef.current);
        // Clear canvas
        const canvas = canvasRef.current;
        if(canvas) {
            const ctx = canvas.getContext('2d');
            if(ctx) ctx.clearRect(0,0, canvas.width, canvas.height);
        }
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying]);

  return (
    <div style={{ maxWidth: '600px', width: '100%', margin: '0 auto', textAlign: 'left', padding: '0.5rem' }}>
      <button onClick={onHome} style={{marginBottom: '0.5rem', padding: '0.4rem'}}>← {t('calibration.home')}</button>
      <h2 style={{ fontSize: '1.5rem', margin: '0.5rem 0' }}>{t('calibration.title')}</h2>
      <p style={{ fontSize: '0.9rem', marginBottom: '1rem', color: '#ccc' }}>
        {t('calibration.description')}
      </p>
      <ol style={{ paddingLeft: '1.2rem', fontSize: '0.9rem', lineHeight: '1.4' }}>
        <li>{t('calibration.step1')}</li>
        <li>{t('calibration.step2')}</li>
        <li>{t('calibration.step3')}</li>
        <li>{t('calibration.step4')}</li>
        <li>{t('calibration.step5')}</li>
      </ol>

      <div style={{ margin: '1.5rem 0', textAlign: 'center' }}>
        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
                onClick={() => adjustVolume(-5)}
                style={{ backgroundColor: '#444', border: '1px solid #666', padding: '0.4rem 0.8rem', fontSize: '0.9em', minWidth: '45px' }}
                disabled={!isPlaying}
            >-5</button>
            <button
                onClick={() => adjustVolume(-1)}
                style={{ backgroundColor: '#444', border: '1px solid #666', padding: '0.4rem 0.8rem', fontSize: '0.9em', minWidth: '45px' }}
                disabled={!isPlaying}
            >-1</button>
            <button
                onClick={() => adjustVolume(1)}
                style={{ backgroundColor: '#444', border: '1px solid #666', padding: '0.4rem 0.8rem', fontSize: '0.9em', minWidth: '45px' }}
                disabled={!isPlaying}
            >+1</button>
            <button
                onClick={() => adjustVolume(5)}
                style={{ backgroundColor: '#444', border: '1px solid #666', padding: '0.4rem 0.8rem', fontSize: '0.9em', minWidth: '45px' }}
                disabled={!isPlaying}
            >+5</button>
        </div>
        <button
          onClick={toggleTone}
          style={{
            padding: '0.8rem 1.5rem',
            fontSize: '1.1em',
            backgroundColor: isPlaying ? '#d32f2f' : '#2e7d32', // Red when playing, Green when stopped
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {isPlaying ? t('calibration.stopTone') : t('calibration.startTone')}
        </button>
        <div style={{ marginTop: '0.5rem' }}>
           <small>{t('calibration.level')}: {(20 * Math.log10(gain / 0.001)).toFixed(1)} dB</small>
        </div>
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', width: '100%' }}>
             <canvas
                ref={canvasRef}
                width={300}
                height={80}
                style={{
                    borderRadius: '8px',
                    background: '#242424',
                    border: '1px solid #333',
                    maxWidth: '100%',
                    height: 'auto'
                }}
            />
        </div>
      </div>

      <div style={{ marginTop: '1.5rem', borderTop: '1px solid #444', paddingTop: '1rem' }}>
        <h3 style={{ fontSize: '1.1rem', margin: '0.5rem 0' }}>{t('calibration.instructions')}</h3>
        <ul style={{ paddingLeft: '1.2rem', fontSize: '0.9rem', lineHeight: '1.4' }}>
            <li>{t('calibration.instrLeft')}</li>
            <li>{t('calibration.instrRight')}</li>
            <li>{t('calibration.instrSpace')}</li>
        </ul>
        <div style={{textAlign: 'center', marginTop: '1.5rem'}}>
            <button
                onClick={handleStartTest}
                style={{ backgroundColor: '#646cff', color: 'white', padding: '0.8em 2em', fontSize: '1.1em', width: '100%', maxWidth: '300px' }}
            >
                {t('calibration.startTest')}
            </button>
        </div>
      </div>
    </div>
  );
};
