import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError, setToken, USE_MOCK } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { Button, Field } from '../components/ui';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

const PHONE_PLACEHOLDER = '+55 11 98888-0000';

export function Login({ onLogin }: { onLogin: (token: string, name: string) => void }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('+5511988880000');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'identifier' | 'code'>('identifier');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await api.requestOtp(identifier.trim());
      setDevCode(result.devCode ?? null);
      setStep('code');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('login.errorSend'));
    } finally {
      setLoading(false);
    }
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await api.login(identifier.trim(), code.trim());
      setToken(result.token);
      localStorage.setItem('wano.admin.name', result.name);
      onLogin(result.token, result.name);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('login.errorCode'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login__brand">
        <img src="/wano-logo-light.png" alt="WANO" />
        <div>
          <div className="eyebrow" style={{ color: 'rgba(246,243,234,0.5)' }}>
            {t('login.brandEyebrow')}
          </div>
          <h1 className="login__headline">
            {t('login.headlineBefore')}
            <br />
            <span>{t('login.headlineAccent')}</span>
            {t('login.headlineAfter')}
          </h1>
          <p className="login__sub">{t('login.brandSub')}</p>
        </div>
        <div className="login__footer">WANO Intelligent Technology · Shenzhen · São Paulo</div>
      </div>

      <div className="login__panel">
        <div className="login__box">
          <div className="login__box-top">
            <div className="eyebrow">{t('login.eyebrow')}</div>
            <LanguageSwitcher />
          </div>
          <h2>{t('login.title')}</h2>
          <p>{t('login.sub')}</p>

          {step === 'identifier' ? (
            <form onSubmit={requestCode} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label={t('login.phoneLabel')}>
                <input
                  className="input"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder={PHONE_PLACEHOLDER}
                  autoFocus
                />
              </Field>
              <Button type="submit" block disabled={loading || identifier.trim().length < 8}>
                {loading ? t('login.sending') : t('login.requestCode')}
              </Button>
            </form>
          ) : (
            <form onSubmit={verify} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label={t('login.codeLabel')}>
                <input
                  className="input"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  inputMode="numeric"
                  autoFocus
                />
              </Field>
              <Button type="submit" block disabled={loading || code.length !== 6}>
                {loading ? t('login.verifying') : t('login.enter')}
              </Button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStep('identifier')}>
                {t('login.otherNumber')}
              </button>
            </form>
          )}

          {error ? <div className="login__error">{error}</div> : null}

          {USE_MOCK || devCode ? (
            <div className="login__hint">
              <strong>{t('login.demoTitle')}</strong>
              <br />
              {t('login.demoPhone', { phone: identifier })} <strong>{devCode ?? '123456'}</strong>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
