import { PluginSlotRenderer } from '@/components/plugin-slot-renderer';
import type { TUseForm } from '@/hooks/use-form';
import { PluginSlot, TestId } from '@sharkord/shared';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardHeader,
  Group,
  Input,
  Label,
  Spinner,
  Switch
} from '@sharkord/ui';
import { memo, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';

type TConnectValues = {
  identity: string;
  password: string;
  autoLogin: boolean;
};

type TConnectFormProps = {
  values: TConnectValues;
  r: TUseForm<TConnectValues>['r'];
  onChange: TUseForm<TConnectValues>['onChange'];
  loading: boolean;
  challenge: string | null;
  twoFactorCode: string;
  setTwoFactorCode: (value: string) => void;
  useRecovery: boolean;
  setUseRecovery: Dispatch<SetStateAction<boolean>>;
  onConnectClick: () => void;
  submitTwoFactor: () => void;
  inviteCode?: string;
  allowNewUsers?: boolean;
};

const ConnectForm = memo(
  ({
    values,
    r,
    onChange,
    loading,
    challenge,
    twoFactorCode,
    setTwoFactorCode,
    useRecovery,
    setUseRecovery,
    onConnectClick,
    submitTwoFactor,
    inviteCode,
    allowNewUsers
  }: TConnectFormProps) => {
    const { t } = useTranslation('connect');

    return (
      <Card className="w-full bg-card/80 shadow-2xl backdrop-blur-xl">
        <CardHeader>
          <PluginSlotRenderer slotId={PluginSlot.CONNECT_SCREEN} />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!challenge && (
            <>
              <form
                className="flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  onConnectClick();
                }}
              >
                <Group label={t('identityLabel')} help={t('identityHelp')}>
                  <Input
                    {...r('identity')}
                    autoComplete="username"
                    data-testid={TestId.CONNECT_IDENTITY_INPUT}
                  />
                </Group>
                <Group label={t('passwordLabel')}>
                  <Input
                    {...r('password')}
                    type="password"
                    autoComplete="current-password"
                    onEnter={onConnectClick}
                    data-testid={TestId.CONNECT_PASSWORD_INPUT}
                  />
                </Group>
              </form>

              <div
                className="flex items-center gap-2 w-fit cursor-pointer"
                data-testid={TestId.CONNECT_AUTO_LOGIN_SWITCH}
                onClick={() => {
                  onChange('autoLogin', !values.autoLogin);
                }}
              >
                <Switch checked={values.autoLogin} />
                <Label className="text-sm cursor-pointer">
                  {t('autoLoginLabel')}
                </Label>
              </div>

              <div className="flex flex-col gap-2">
                {!window.isSecureContext && (
                  <Alert variant="destructive">
                    <AlertTitle>{t('insecureTitle')}</AlertTitle>
                    <AlertDescription>{t('insecureDesc')}</AlertDescription>
                  </Alert>
                )}

                <Button
                  className="w-full rounded-full"
                  onClick={onConnectClick}
                  disabled={loading || !values.identity || !values.password}
                  data-testid={TestId.CONNECT_BUTTON}
                >
                  {loading ? <Spinner size="xs" /> : t('connectBtn')}
                </Button>

                {!allowNewUsers && (
                  <>
                    {!inviteCode && (
                      <span className="text-xs text-muted-foreground text-center">
                        {t('registrationDisabled')}
                      </span>
                    )}
                  </>
                )}

                {inviteCode && (
                  <Alert variant="info">
                    <AlertTitle>{t('invitedTitle')}</AlertTitle>
                    <AlertDescription>
                      <span className="font-mono text-xs">
                        {t('inviteCode', { code: inviteCode })}
                      </span>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </>
          )}

          {challenge && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">
                  {t('twoFactorTitle')}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t('twoFactorHelp')}
                </span>
              </div>
              <Group label={t('twoFactorCodeLabel')}>
                <Input
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  autoComplete="one-time-code"
                  inputMode={useRecovery ? 'text' : 'numeric'}
                  onEnter={submitTwoFactor}
                />
              </Group>
              <button
                type="button"
                className="text-xs text-muted-foreground underline w-fit"
                onClick={() => setUseRecovery((v) => !v)}
              >
                {useRecovery
                  ? t('twoFactorUseCode')
                  : t('twoFactorUseRecovery')}
              </button>
              <Button
                className="w-full rounded-full"
                onClick={submitTwoFactor}
                disabled={loading || twoFactorCode.trim().length < 6}
              >
                {loading ? <Spinner size="xs" /> : t('twoFactorSubmit')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

export { ConnectForm };
