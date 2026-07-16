import { getTRPCClient } from '@/lib/trpc';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Group,
  Input
} from '@sharkord/ui';
import { QRCodeSVG } from 'qrcode.react';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type Status = { enabled: boolean; recoveryCodesRemaining: number };

const Security = memo(() => {
  const { t } = useTranslation('settings');
  const [status, setStatus] = useState<Status | null>(null);
  const [phase, setPhase] = useState<'idle' | 'enrolling' | 'recovery'>('idle');
  const [otpauthUri, setOtpauthUri] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    setStatus(await getTRPCClient().security.totp.status.query());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const startSetup = useCallback(async () => {
    const res = await getTRPCClient().security.totp.setup.mutate();
    setOtpauthUri(res.otpauthUri);
    setSecret(res.secret);
    setCode('');
    setPhase('enrolling');
  }, []);

  const confirmEnable = useCallback(async () => {
    try {
      const res = await getTRPCClient().security.totp.enable.mutate({
        code: code.trim()
      });
      setRecoveryCodes(res.recoveryCodes);
      setPhase('recovery');
    } catch {
      toast.error(t('securityInvalidCode'));
    }
  }, [code, t]);

  const finishRecovery = useCallback(async () => {
    setRecoveryCodes([]);
    setPhase('idle');
    await refresh();
  }, [refresh]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('securityTitle')}</CardTitle>
        <CardDescription>{t('securityDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {phase === 'idle' && status && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {status.enabled
                ? t('security2faEnabled')
                : t('security2faDisabled')}
            </p>
            {status.enabled ? (
              <p className="text-xs text-muted-foreground">
                {t('securityRecoveryRemaining', {
                  count: status.recoveryCodesRemaining
                })}
              </p>
            ) : (
              <Button onClick={startSetup}>{t('securityEnable')}</Button>
            )}
          </div>
        )}

        {phase === 'enrolling' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('securityScanHelp')}
            </p>
            <div className="bg-white p-3 w-fit rounded">
              <QRCodeSVG value={otpauthUri} size={160} />
            </div>
            <p className="text-xs text-muted-foreground">
              {t('securityManualKey')}{' '}
              <code className="font-mono">{secret}</code>
            </p>
            <Group label={t('securityCodeLabel')}>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
              />
            </Group>
            <Button onClick={confirmEnable} disabled={code.trim().length < 6}>
              {t('securityConfirm')}
            </Button>
          </div>
        )}

        {phase === 'recovery' && (
          <div className="space-y-3">
            <p className="text-sm font-medium">{t('securityRecoveryTitle')}</p>
            <p className="text-xs text-muted-foreground">
              {t('securityRecoveryHelp')}
            </p>
            <div className="grid grid-cols-2 gap-2 font-mono text-sm">
              {recoveryCodes.map((rc) => (
                <span key={rc}>{rc}</span>
              ))}
            </div>
            <Button onClick={finishRecovery}>
              {t('securityRecoveryDone')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

export { Security };
