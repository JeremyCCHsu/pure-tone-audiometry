import React, { useEffect, useState, useRef } from 'react';
import { HearingTestState } from '../types';
import { audioEngine } from '../audio/AudioEngine';
import { FREQUENCIES } from '../utils/constants';

interface TestInterfaceProps {
  state: HearingTestState;
  onInput: (key: string) => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onSwitchFreqs: (frequencies: number[]) => void;
  onRecalibrate: () => void;
  onHome: () => void;
  onFrequencyStep: (direction: 'next' | 'prev') => void;
}

export const TestInterface: React.FC<TestInterfaceProps> = ({ state, onInput, onStop, onPause, onResume, onSwitchFreqs, onRecalibrate, onHome, onFrequencyStep }) => {
  const [flash, setFlash] = useState<'left' | 'right' | 'space' | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      // Allow F/J/Space/Enter/U/O/Escape
      if (['f', 'j', ' ', 'enter', 'u', 'o', 'escape'].includes(k)) {

        if (k === 'u') {
            onFrequencyStep('prev');
            return;
        }
        if (k === 'o') {
            onFrequencyStep('next');
            return;
        }
        if (k === 'escape') {
            if (state.status === 'paused') onResume();
            else onPause();
            return;
        }

        onInput(e.key);

        if (k === 'f') setFlash('left');
        if (k === 'j') setFlash('right');
        if (k === ' ') setFlash('space');
        setTimeout(() => setFlash(null), 200);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onInput, onPause, onResume, onFrequencyStep, state.status]);

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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', justifyContent: 'center', position: 'relative' }}>

      {state.status === 'paused' && (
        <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px'
        }}>
            <h2>Test Paused</h2>
            <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column', width: '300px' }}>
                <button onClick={onResume} style={{ padding: '1rem' }}>Resume Test</button>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => onSwitchFreqs(FREQUENCIES.LOW)} style={{ flex: 1 }}>Switch to Low</button>
                    <button onClick={() => onSwitchFreqs(FREQUENCIES.HIGH)} style={{ flex: 1 }}>Switch to High</button>
                </div>
                <button onClick={onHome} style={{ padding: '1rem', backgroundColor: '#555' }}>Return to Home</button>
                <button onClick={onRecalibrate} style={{ padding: '1rem', backgroundColor: '#555' }}>Recalibrate</button>
                <button onClick={onStop} style={{ padding: '1rem', backgroundColor: '#d32f2f' }}>Stop & Show Results</button>
            </div>
        </div>
      )}

      <div style={{ marginBottom: '1rem', fontSize: '1.5em', color: '#888' }}>
        {state.isPlaying ? (
           <span style={{ color: '#646cff', fontWeight: 'bold' }}>Listening...</span>
        ) : (
           <span>Waiting...</span>
        )}
      </div>

      <canvas
        ref={canvasRef}
        width={400}
        height={100}
        style={{
            marginBottom: '1rem',
            borderRadius: '8px',
            background: '#242424',
            border: '1px solid #333',
            width: '100%',
            maxWidth: '400px',
            height: 'auto'
        }}
      />

      <div className="flash-container">
        <div
            className="flash-circle"
            style={{
                border: `4px solid ${flash === 'left' ? '#646cff' : '#444'}`,
                backgroundColor: flash === 'left' ? 'rgba(100,108,255,0.2)' : 'transparent',
            }}
        >
          F
          <span>LEFT</span>
        </div>

        <div
            className="flash-skip"
            style={{
                border: `2px solid ${flash === 'space' ? '#fff' : '#333'}`,
                backgroundColor: flash === 'space' ? 'rgba(255,255,255,0.1)' : 'transparent',
            }}
        >
          SKIP
        </div>

        <div
             className="flash-circle"
            style={{
                border: `4px solid ${flash === 'right' ? '#646cff' : '#444'}`,
                backgroundColor: flash === 'right' ? 'rgba(100,108,255,0.2)' : 'transparent',
            }}
        >
          J
          <span>RIGHT</span>
        </div>
      </div>

      <p style={{ marginTop: '2rem', color: '#666', fontSize: '1.2em' }}>
        Current Frequency: <strong>{state.currentFreq} Hz</strong> |
        Vol: <strong>{state.currentDb > 0 ? '+' : ''}{state.currentDb.toFixed(1)} dB</strong> |
        Ear: <span style={{ textTransform: 'uppercase', color: state.currentEar === 'left' ? '#646cff' : '#ff6384' }}>{state.currentEar}</span>
      </p>

      <div className="bottom-controls">
          <button
            onClick={onRecalibrate}
            style={{ backgroundColor: '#444', border: '1px solid #666', fontSize: '0.9em' }}
          >
              Recalibrate
          </button>
          <button
            onClick={onStop}
            style={{ backgroundColor: '#333', border: '1px solid #666', fontSize: '0.9em' }}
          >
              Stop Test (Show Results)
          </button>
      </div>
    </div>
  );
};
