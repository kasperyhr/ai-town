import type { ReactElement } from 'react';
import type { Translator } from '../i18n';
import type { Bootstrap, Language } from '../types';

type Props = {
  bootstrap: Bootstrap;
  language: Language;
  showStatusPage: boolean;
  t: Translator;
  onLanguageChange: (language: Language) => void;
};

export function Topbar({ bootstrap, language, showStatusPage, t, onLanguageChange }: Props): ReactElement {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Cloudflare Workers + D1 + DeepSeek</p>
        <h1>{t('appName')}</h1>
        <p className="subtitle">{t('subtitle')}</p>
      </div>
      <div className="topbar-actions">
        <a className="small-button nav-link" href={showStatusPage ? '#' : '#status'}>
          {showStatusPage ? t('backToTown') : t('projectStatus')}
        </a>
        <label className="language-picker">
          <span>{t('language')}</span>
          <select
            aria-label={t('language')}
            value={language}
            onChange={(event) => onLanguageChange(event.target.value === 'zh' ? 'zh' : 'en')}
          >
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>
        </label>
        {!bootstrap.authenticated ? (
          <>
            <a className="auth-button auth-link" href="/api/auth/github/start">
              {t('signInGithub')}
            </a>
            <a className="auth-button secondary auth-link" href="/api/auth/google/start">
              {t('signInGoogle')}
            </a>
          </>
        ) : null}
      </div>
    </header>
  );
}
