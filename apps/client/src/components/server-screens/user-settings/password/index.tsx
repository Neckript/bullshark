import { closeServerScreens } from '@/features/server-screens/actions';
import { useForm } from '@/hooks/use-form';
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
} from '@bullshark/ui';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

const Password = memo(() => {
  const { t } = useTranslation('settings');
  const { setTrpcErrors, r, values } = useForm({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  });

  const updatePassword = useCallback(async () => {
    const trpc = getTRPCClient();

    try {
      await trpc.users.updatePassword.mutate(values);
      toast.success(t('passwordUpdated'));
    } catch (error) {
      setTrpcErrors(error);
    }
  }, [values, setTrpcErrors, t]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('passwordTitle')}</CardTitle>
        <CardDescription>{t('passwordDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Group label={t('currentPasswordLabel')}>
          <Input {...r('currentPassword', 'password')} />
        </Group>

        <Group label={t('newPasswordLabel')}>
          <Input {...r('newPassword', 'password')} />
        </Group>

        <Group label={t('confirmNewPasswordLabel')}>
          <Input {...r('confirmNewPassword', 'password')} />
        </Group>

        <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={closeServerScreens}
            className="w-full sm:w-auto"
          >
            {t('cancel')}
          </Button>
          <Button onClick={updatePassword} className="w-full sm:w-auto">
            {t('saveChanges')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

export { Password };
