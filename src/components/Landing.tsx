import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FREQUENCIES } from '../utils/constants';

interface LandingProps {
  onStart: (frequencies: number[]) => void;
  onManualStart: () => void;
  onImport: (results: any[], baselineGain: number) => void;
}

export const Landing: React.FC<LandingProps> = ({ onStart, onManualStart, onImport }) => {
  const { t } = useTranslation();
  const [selectedSet, setSelectedSet] = useState<'LOW' | 'HIGH' | 'FULL'>('LOW');
  const [customFrequencies, setCustomFrequencies] = useState<string>(FREQUENCIES.FULL.join(', '));
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.results && Array.isArray(json.results)) {
          onImport(json.results, json.baselineGain || 0.001);
        } else {
          alert('Invalid JSON format: missing results array');
        }
      } catch (err) {
        alert('Failed to parse JSON file');
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const sets: ('LOW' | 'HIGH' | 'FULL')[] = ['LOW', 'HIGH', 'FULL'];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'TEXTAREA') return;

      if (e.key === 'Enter') {
        handleStart();
      } else if (e.key === 'ArrowRight') {
        const nextIndex = (sets.indexOf(selectedSet) + 1) % sets.length;
        setSelectedSet(sets[nextIndex]);
      } else if (e.key === 'ArrowLeft') {
        const nextIndex = (sets.indexOf(selectedSet) - 1 + sets.length) % sets.length;
        setSelectedSet(sets[nextIndex]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSet, customFrequencies, handleStart]);

  const getCustomFrequenciesCount = () => {
    return customFrequencies
      .split(/[,\s]+/)
      .map(s => parseInt(s.trim()))
      .filter(n => !isNaN(n) && n > 0).length;
  };

  return (
    <div style={{ maxWidth: '600px', width: '100%', margin: '0 auto', textAlign: 'left', padding: '0.5rem', boxSizing: 'border-box' }}>
      <h1 style={{ fontSize: '1.5rem', margin: '0.2rem 0' }}>{t('landing.title')}</h1>
      <p style={{ margin: '0.2rem 0 1rem 0', color: '#888', fontSize: '0.9rem' }}>
        {t('landing.description')}
      </p>

      <div style={{ margin: '1rem 0' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', marginTop: 0 }}>{t('landing.selectFrequencySet')}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            onClick={() => setSelectedSet('LOW')}
            style={{
              backgroundColor: selectedSet === 'LOW' ? '#646cff' : '#333',
              border: '1px solid #646cff',
              padding: '0.5rem',
              fontSize: '0.85rem',
              height: '80px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              lineHeight: '1.2'
            }}
          >
            <strong>{t('landing.baseSet')}</strong>
            <span style={{ fontSize: '0.8rem', margin: '2px 0' }}>{t('landing.hzRange')}</span>
            <small style={{ color: '#aaa' }}>({FREQUENCIES.LOW.length} {t('landing.freqs')})</small>
          </button>
          <button
            onClick={() => setSelectedSet('HIGH')}
            style={{
              backgroundColor: selectedSet === 'HIGH' ? '#646cff' : '#333',
              border: '1px solid #646cff',
              padding: '0.5rem',
              fontSize: '0.85rem',
              height: '80px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              lineHeight: '1.2'
            }}
          >
            <strong>{t('landing.highFreq')}</strong>
            <span style={{ fontSize: '0.8rem', margin: '2px 0' }}>{t('landing.hzRangeHigh')}</span>
            <small style={{ color: '#aaa' }}>({FREQUENCIES.HIGH.length} {t('landing.freqs')})</small>
          </button>
          <button
            onClick={() => setSelectedSet('FULL')}
            style={{
              backgroundColor: selectedSet === 'FULL' ? '#646cff' : '#333',
              border: '1px solid #646cff',
              padding: '0.5rem',
              fontSize: '0.85rem',
              height: '80px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              lineHeight: '1.2'
            }}
          >
            <strong>{t('landing.customSet')}</strong>
            <span style={{ fontSize: '0.8rem', margin: '2px 0' }}>{t('landing.customList')}</span>
            <small style={{ color: '#aaa' }}>({getCustomFrequenciesCount()} {t('landing.freqs')})</small>
          </button>
        </div>

        <div style={{
          padding: '0.8rem',
          backgroundColor: '#222',
          borderRadius: '6px',
          fontSize: '0.85rem',
          minHeight: '140px',
          width: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column'
        }}>
             <div style={{ height: '1.5rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'nowrap' }}>
                <strong style={{ flexShrink: 0, width: '130px' }}>{t('landing.selectedFrequencies')}</strong>
                <span style={{ flexShrink: 0, width: '60px', fontWeight: 'bold' }}>({getCurrentFrequencies().length}):</span>
             </div>
             <div style={{ position: 'relative', flex: 1 }}>
               {selectedSet === 'FULL' ? (
                 <textarea
                   value={customFrequencies}
                   onChange={(e) => setCustomFrequencies(e.target.value)}
                   style={{
                     width: '100%',
                     padding: '0.5rem',
                     height: '80px',
                     fontFamily: 'monospace',
                     backgroundColor: '#1a1a1a',
                     color: '#fff',
                     border: '1px solid #444',
                     borderRadius: '4px',
                     fontSize: '0.85rem',
                     resize: 'none',
                     boxSizing: 'border-box'
                   }}
                   placeholder={t('landing.textareaPlaceholder')}
                 />
               ) : (
                 <div style={{
                    padding: '0.5rem',
                    height: '80px',
                    wordBreak: 'break-all',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#ccc',
                    overflowY: 'auto',
                    boxSizing: 'border-box',
                    fontFamily: 'monospace'
                  }}>
                    {FREQUENCIES[selectedSet].join(', ')} Hz
                 </div>
               )}
             </div>
        </div>

      </div>

      <div style={{ textAlign: 'center', marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', alignItems: 'center' }}>
        <button
            onClick={handleStart}
            style={{ width: '100%', maxWidth: '300px', fontSize: '1.1em', padding: '0.5em 2em', backgroundColor: '#646cff', color: 'white', border: 'none' }}
        >
          {t('landing.startAuto')}
        </button>

        <button
            onClick={onManualStart}
            style={{ width: '100%', maxWidth: '300px', fontSize: '1em', padding: '0.5em 2em', backgroundColor: '#333', border: '1px solid #666' }}
        >
          {t('landing.enterManual')}
        </button>

        <input
            type="file"
            accept=".json"
            ref={fileInputRef}
            onChange={handleFileUpload}
            style={{ display: 'none' }}
        />
        <button
            onClick={() => fileInputRef.current?.click()}
            style={{
                width: '100%',
                maxWidth: '300px',
                fontSize: '1em',
                padding: '0.5em 2em',
                backgroundColor: 'transparent',
                border: '1px solid #444',
                color: '#aaa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
            }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          {t('landing.importJson')}
        </button>
      </div>
    </div>
  );
};
