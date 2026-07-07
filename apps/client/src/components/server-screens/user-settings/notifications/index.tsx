import {
  setBrowserNotifications,
  setBrowserNotificationsForDms,
  setBrowserNotificationsForMentions,
  setBrowserNotificationsForReplies,
  setRoleMentionMuted
} from '@/features/app/actions';
import {
  useBrowserNotifications,
  useBrowserNotificationsForDms,
  useBrowserNotificationsForMentions,
  useBrowserNotificationsForReplies,
  useMutedRoleMentionIds
} from '@/features/app/hooks';
import { useRoles } from '@/features/server/roles/hooks';
import { getFileUrl } from '@/helpers/get-file-url';
import {
  getPushState,
  subscribeToPush,
  unsubscribeFromPush
} from '@/helpers/push-subscription';
import { isNoColor } from '@/helpers/resolve-name-color';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Group,
  Switch
} from '@sharkord/ui';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

const PushDeviceSection = () => {
  const { t } = useTranslation('settings');
  const [state, setState] = useState<
    | 'loading'
    | 'unsupported'
    | 'needs-pwa'
    | 'denied'
    | 'subscribed'
    | 'not-subscribed'
  >('loading');

  const refresh = useCallback(async () => {
    setState(await getPushState());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onToggle = useCallback(async () => {
    if (state === 'subscribed') await unsubscribeFromPush();
    else if (state === 'not-subscribed') {
      const ok = await subscribeToPush();
      if (!ok) toast.error(t('pushSubscribeFailed'));
    }
    await refresh();
  }, [state, refresh, t]);

  if (state === 'loading') return null;
  if (state === 'unsupported')
    return (
      <p className="text-sm text-muted-foreground">{t('pushUnsupported')}</p>
    );
  if (state === 'needs-pwa')
    return (
      <p className="text-sm text-muted-foreground">{t('pushNeedsPwa')}</p>
    );
  if (state === 'denied')
    return <p className="text-sm text-muted-foreground">{t('pushDenied')}</p>;

  return (
    <Group label={t('pushDeviceLabel')} description={t('pushDeviceDesc')}>
      <Switch checked={state === 'subscribed'} onCheckedChange={onToggle} />
    </Group>
  );
};

const Notifications = memo(() => {
  const { t } = useTranslation('settings');
  const browserNotifications = useBrowserNotifications();
  const browserNotificationsForMentions = useBrowserNotificationsForMentions();
  const browserNotificationsForDms = useBrowserNotificationsForDms();
  const browserNotificationsForReplies = useBrowserNotificationsForReplies();
  const roles = useRoles();
  const mutedRoleMentionIds = useMutedRoleMentionIds();
  const mutedSet = useMemo(
    () => new Set(mutedRoleMentionIds),
    [mutedRoleMentionIds]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('notificationsTitle')}</CardTitle>
        <CardDescription>{t('notificationsDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Group label={t('allMessagesLabel')} description={t('allMessagesDesc')}>
          <Switch
            checked={browserNotifications}
            onCheckedChange={(value) => setBrowserNotifications(value)}
          />
        </Group>
        <Group
          label={t('mentionsOnlyLabel')}
          description={t('mentionsOnlyDesc')}
        >
          <Switch
            checked={browserNotificationsForMentions}
            onCheckedChange={(value) =>
              setBrowserNotificationsForMentions(value)
            }
          />
        </Group>
        <Group
          label={t('dmNotificationsLabel')}
          description={t('dmNotificationsDesc')}
        >
          <Switch
            checked={browserNotificationsForDms}
            onCheckedChange={(value) => setBrowserNotificationsForDms(value)}
          />
        </Group>
        <Group
          label={t('repliesNotificationsLabel')}
          description={t('repliesNotificationsDesc')}
        >
          <Switch
            checked={browserNotificationsForReplies}
            onCheckedChange={(value) =>
              setBrowserNotificationsForReplies(value)
            }
          />
        </Group>

        {roles.length > 0 && (
          <Group
            label={t('mutedRoleMentionsLabel')}
            description={t('mutedRoleMentionsHint')}
          >
            <div className="space-y-2">
              {roles.map((role) => {
                const colored = !isNoColor(role.color);
                return (
                  <div
                    key={role.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {role.icon && (
                        <img
                          src={getFileUrl(role.icon)}
                          alt=""
                          className="h-4 w-4 shrink-0 rounded-sm object-cover"
                        />
                      )}
                      <span
                        className="text-sm truncate"
                        style={colored ? { color: role.color } : undefined}
                      >
                        {role.name}
                      </span>
                    </span>
                    <Switch
                      checked={mutedSet.has(role.id)}
                      onCheckedChange={(value) =>
                        setRoleMentionMuted(role.id, value)
                      }
                    />
                  </div>
                );
              })}
            </div>
          </Group>
        )}

        <PushDeviceSection />
      </CardContent>
    </Card>
  );
});

export { Notifications };
