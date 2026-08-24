import { LanguageSwitcher } from '@/components/language-switcher';
import { connect } from '@/features/server/actions';
import { useInfo } from '@/features/server/hooks';
import { getFileUrl, getUrlFromServer } from '@/helpers/get-file-url';
import {
  getLocalStorageItemBool,
  LocalStorageKey,
  removeLocalStorageItem,
  SessionStorageKey,
  setLocalStorageItem,
  setLocalStorageItemBool,
  setSessionStorageItem
} from '@/helpers/storage';
import { useForm } from '@/hooks/use-form';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConnectForm } from './connect-form';
import { ConnectScene } from './connect-scene';

const Connect = memo(() => {
  const { t } = useTranslation('connect');
  const { values, r, setErrors, onChange } = useForm<{
    identity: string;
    password: string;
    autoLogin: boolean;
  }>({
    identity: '',
    password: '',
    autoLogin: getLocalStorageItemBool(LocalStorageKey.AUTO_LOGIN)
  });

  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const info = useInfo();

  const inviteCode = useMemo(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const invite = urlParams.get('invite');
    return invite || undefined;
  }, []);

  const finishLogin = useCallback(
    async (token: string) => {
      setSessionStorageItem(SessionStorageKey.TOKEN, token);
      setLocalStorageItemBool(LocalStorageKey.AUTO_LOGIN, values.autoLogin);

      if (values.autoLogin) {
        setLocalStorageItem(LocalStorageKey.AUTO_LOGIN_TOKEN, token);
      } else {
        removeLocalStorageItem(LocalStorageKey.AUTO_LOGIN_TOKEN);
      }

      await connect();
    },
    [values.autoLogin]
  );

  const onConnectClick = useCallback(async () => {
    setLoading(true);

    try {
      const url = getUrlFromServer();
      const response = await fetch(`${url}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          identity: values.identity,
          password: values.password,
          invite: inviteCode,
          autoLogin: values.autoLogin || undefined
        })
      });

      if (!response.ok) {
        const data = await response.json();

        setErrors(data.errors || {});
        return;
      }

      const data = (await response.json()) as
        | { token: string }
        | { twoFactorRequired: true; challenge: string };

      if ('twoFactorRequired' in data) {
        setChallenge(data.challenge);
        return;
      }

      await finishLogin(data.token);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      toast.error(t('connectError', { message: errorMessage }));
    } finally {
      setLoading(false);
    }
  }, [
    values.identity,
    values.password,
    values.autoLogin,
    setErrors,
    inviteCode,
    t,
    finishLogin
  ]);

  const submitTwoFactor = useCallback(async () => {
    if (!challenge) return;

    setLoading(true);

    try {
      const url = getUrlFromServer();
      const response = await fetch(`${url}/login/2fa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ challenge, code: twoFactorCode.trim() })
      });

      if (!response.ok) {
        toast.error(t('twoFactorInvalid'));
        return;
      }

      const data = (await response.json()) as { token: string };

      await finishLogin(data.token);
    } finally {
      setLoading(false);
    }
  }, [challenge, twoFactorCode, finishLogin, t]);

  const logoSrc = useMemo(() => {
    if (info?.logo) {
      return getFileUrl(info.logo);
    }

    return '/logo.webp';
  }, [info]);

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-2 overflow-hidden">
      <ConnectScene />

      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
        <LanguageSwitcher variant="icon" />
      </div>

      <div className="relative grid w-full max-w-4xl items-center gap-8 px-6 lg:grid-cols-2">
        <div className="flex flex-col items-center gap-3 text-center lg:items-start lg:text-left">
          <img
            src={logoSrc}
            alt="Bullshark"
            className="block max-h-24 max-w-full rounded-[var(--radius)] lg:max-h-40"
          />
          {info?.name && (
            <h1 className="font-display text-3xl font-semibold tracking-tight lg:text-4xl">
              {info.name}
            </h1>
          )}
          {info?.description && (
            <p className="max-w-sm text-sm text-muted-foreground">
              {info.description}
            </p>
          )}
        </div>

        <ConnectForm
          values={values}
          r={r}
          onChange={onChange}
          loading={loading}
          challenge={challenge}
          twoFactorCode={twoFactorCode}
          setTwoFactorCode={setTwoFactorCode}
          useRecovery={useRecovery}
          setUseRecovery={setUseRecovery}
          onConnectClick={onConnectClick}
          submitTwoFactor={submitTwoFactor}
          inviteCode={inviteCode}
          allowNewUsers={info?.allowNewUsers}
        />
      </div>

      <div className="relative flex justify-center items-center gap-2 text-xs text-muted-foreground select-none">
        <span>v{VITE_APP_VERSION}</span>
        <a
          href="https://codeberg.org/The_Neckript/bullshark"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>

        <a
          className="text-xs"
          href="https://github.com/Sharkord/sharkord"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('forkCredit')}
        </a>
      </div>
    </div>
  );
});

export { Connect };
