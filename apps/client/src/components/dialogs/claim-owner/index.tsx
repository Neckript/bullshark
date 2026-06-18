import { getTRPCClient } from '@/lib/trpc';
import { useForm } from '@/hooks/use-form';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AutoFocus,
  Input
} from '@sharkord/ui';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { TDialogBaseProps } from '../types';

const ClaimOwnerDialog = memo(({ isOpen, close }: TDialogBaseProps) => {
  const { t } = useTranslation('dialogs');
  const { r, values, setTrpcErrors, errors } = useForm({ token: '' });
  const [loading, setLoading] = useState(false);

  const onSubmit = useCallback(async () => {
    try {
      setLoading(true);
      const trpc = getTRPCClient();
      await trpc.others.useSecretToken.mutate({ token: values.token });
      toast.success(t('claimOwnerSuccess'));
      close();
    } catch (error) {
      setTrpcErrors(error);
    } finally {
      setLoading(false);
    }
  }, [values.token, close, setTrpcErrors, t]);

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('claimOwnerTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('claimOwnerDesc')}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <AutoFocus>
            <Input
              {...r('token')}
              className="mt-2 font-mono"
              placeholder={t('claimOwnerTokenPlaceholder')}
              error={errors._general ?? (errors.token ? t('claimOwnerInvalidToken') : undefined)}
            />
          </AutoFocus>
        </div>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel onClick={close}>{t('cancel')}</AlertDialogCancel>
          <AutoFocus>
            <AlertDialogAction
              onClick={onSubmit}
              disabled={!values.token || loading}
            >
              {t('claimOwnerBtn')}
            </AlertDialogAction>
          </AutoFocus>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
});

export { ClaimOwnerDialog };
