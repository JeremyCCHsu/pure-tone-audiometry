import React from 'react';
import { useTranslation } from 'react-i18next';

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language.startsWith('en') ? 'zh-TW' : 'en';
    i18n.changeLanguage(newLang);
  };

  return (
    <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 1000 }}>
      <button
        onClick={toggleLanguage}
        style={{
          backgroundColor: 'rgba(51, 51, 51, 0.8)',
          color: '#fff',
          border: '1px solid #444',
          borderRadius: '20px',
          padding: '0.4rem 0.8rem',
          fontSize: '0.85rem',
          cursor: 'pointer',
          backdropFilter: 'blur(4px)',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem'
        }}
        onMouseOver={(e) => {
           e.currentTarget.style.backgroundColor = 'rgba(100, 108, 255, 0.8)';
           e.currentTarget.style.borderColor = '#646cff';
        }}
        onMouseOut={(e) => {
           e.currentTarget.style.backgroundColor = 'rgba(51, 51, 51, 0.8)';
           e.currentTarget.style.borderColor = '#444';
        }}
      >
        <span>🌐</span>
        <span>{i18n.language.startsWith('en') ? '中文' : 'English'}</span>
      </button>
    </div>
  );
};
