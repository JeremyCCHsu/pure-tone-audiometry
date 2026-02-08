import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FREQUENCIES } from '../utils/constants';

interface LandingProps {
  onStart: (frequencies: number[]) => void;
  onManualStart: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onStart, onManualStart }) => {
  const { t } = useTranslation();
  const [selectedSet, setSelectedSet] = useState<'LOW' | 'HIGH' | 'FULL'>('LOW');
  const [customFrequencies, setCustomFrequencies] = useState<string>(FREQUENCIES.FULL.join(', '));

  const getCurrentFrequencies = () => {
    if (selectedSet === 'FULL') {
      return customFrequencies
        .split(/[,\s]+/)
        .map(s => parseInt(s.trim()))
        .filter(n => !isNaN(n) && n > 0);
    }
    return FREQUENCIES[selectedSet];
  };

  const handleStart = () => {
    const freqs = getCurrentFrequencies();
    if (freqs.length === 0) {
      alert(t('landing.alertNoFreq'));
      return;
    }
    onStart(freqs);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
          handleStart();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSet, customFrequencies, onStart]);

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'left', padding: '0.5rem' }}>
      <h1 style={{ fontSize: '1.5rem', margin: '0.2rem 0' }}>{t('landing.title')}</h1>
      <p style={{ margin: '0.2rem 0 1rem 0', color: '#888', fontSize: '0.9rem' }}>
        {t('landing.description')}
      </p>

      <div style={{ margin: '1rem 0' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', marginTop: 0 }}>{t('landing.selectFrequencySet')}</h3>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedSet('LOW')}
            style={{
              backgroundColor: selectedSet === 'LOW' ? '#646cff' : '#333',
              border: '1px solid #646cff',
              flex: 1,
              padding: '0.5rem',
              minWidth: '90px',
              fontSize: '0.85rem'
            }}
          >
            <strong>{t('landing.baseSet')}</strong><br/>
            {t('landing.hzRange')}<br/>
            <small>({FREQUENCIES.LOW.length} {t('landing.freqs')})</small>
          </button>
          <button
            onClick={() => setSelectedSet('HIGH')}
            style={{
              backgroundColor: selectedSet === 'HIGH' ? '#646cff' : '#333',
              border: '1px solid #646cff',
              flex: 1,
              padding: '0.5rem',
              minWidth: '90px',
              fontSize: '0.85rem'
            }}
          >
            <strong>{t('landing.highFreq')}</strong><br/>
            {t('landing.hzRangeHigh')}<br/>
            <small>({FREQUENCIES.HIGH.length} {t('landing.freqs')})</small>
          </button>
          <button
            onClick={() => setSelectedSet('FULL')}
            style={{
              backgroundColor: selectedSet === 'FULL' ? '#646cff' : '#333',
              border: '1px solid #646cff',
              flex: 1,
              padding: '0.5rem',
              minWidth: '90px',
              fontSize: '0.85rem'
            }}
          >
            <strong>{t('landing.customSet')}</strong><br/>
            {t('landing.customList')}<br/>
            <small>({getCurrentFrequencies().length} {t('landing.freqs')})</small>
          </button>
        </div>

        <div style={{ padding: '0.6rem', backgroundColor: '#222', borderRadius: '6px', fontSize: '0.85rem' }}>
             <strong>{t('landing.selectedFrequencies')} ({getCurrentFrequencies().length}):</strong><br/>
             {selectedSet === 'FULL' ? (
               <textarea
                 value={customFrequencies}
                 onChange={(e) => setCustomFrequencies(e.target.value)}
                 style={{
                   width: '100%',
                   marginTop: '0.2rem',
                   padding: '0.3rem',
                   minHeight: '40px',
                   fontFamily: 'monospace',
                   backgroundColor: '#1a1a1a',
                   color: '#fff',
                   border: '1px solid #444',
                   borderRadius: '4px',
                   fontSize: '0.85rem'
                 }}
                 placeholder={t('landing.textareaPlaceholder')}
               />
             ) : (
               <span>{FREQUENCIES[selectedSet].join(', ')} Hz</span>
             )}
        </div>

      </div>

      <div style={{ textAlign: 'center', marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
        <button
            onClick={handleStart}
            style={{ fontSize: '1.1em', padding: '0.5em 2em' }}
        >
          {t('landing.startAuto')}
        </button>

        <button
            onClick={onManualStart}
            style={{ fontSize: '1em', padding: '0.5em 2em', backgroundColor: '#333', border: '1px solid #666' }}
        >
          {t('landing.enterManual')}
        </button>
      </div>
    </div>
  );
};
