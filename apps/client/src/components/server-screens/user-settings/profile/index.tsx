import { NicknameBadge } from '@/components/nickname-badge';
import { closeServerScreens } from '@/features/server-screens/actions';
import { useCan } from '@/features/server/hooks';
import { useOwnPublicUser } from '@/features/server/users/hooks';
import {
  getNicknameFontFamily,
  NICKNAME_FONT_OPTIONS
} from '@/helpers/nickname-fonts';
import { useForm } from '@/hooks/use-form';
import { getTRPCClient } from '@/lib/trpc';
import { Permission } from '@sharkord/shared';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Color,
  Group,
  Input,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea
} from '@sharkord/ui';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AvatarManager } from './avatar-manager';
import { BannerManager } from './banner-manager';

const Profile = memo(() => {
  const { t } = useTranslation('settings');
  const ownPublicUser = useOwnPublicUser();
  const can = useCan();

  const canCustomizeColor = can(Permission.CUSTOMIZE_NICKNAME_COLOR);
  const canCustomizeFont = can(Permission.CUSTOMIZE_NICKNAME_FONT);
  const canCustomizeBadge = can(Permission.CUSTOMIZE_NICKNAME_BADGE);

  const { setTrpcErrors, r, rr, values, onChange } = useForm({
    name: ownPublicUser?.name ?? '',
    bannerColor: ownPublicUser?.bannerColor ?? '#FFFFFF',
    bio: ownPublicUser?.bio ?? '',
    nicknameColor: (ownPublicUser?.nicknameColor ?? null) as string | null,
    nicknameFont: (ownPublicUser?.nicknameFont ?? null) as string | null,
    showRoleBadge: ownPublicUser?.showRoleBadge ?? true
  });

  const onUpdateUser = useCallback(async () => {
    const trpc = getTRPCClient();
    try {
      await trpc.users.update.mutate({
        name: values.name,
        bannerColor: values.bannerColor,
        bio: values.bio,
        ...(canCustomizeColor && { nicknameColor: values.nicknameColor }),
        ...(canCustomizeFont && {
          nicknameFont: values.nicknameFont as
            | 'inter'
            | 'rajdhani'
            | 'orbitron'
            | 'exo-2'
            | 'bebas-neue'
            | 'press-start-2p'
            | 'share-tech-mono'
            | null
        }),
        ...(canCustomizeBadge && { showRoleBadge: values.showRoleBadge })
      });
      toast.success(t('profileUpdated'));
    } catch (error) {
      setTrpcErrors(error);
    }
  }, [
    values,
    canCustomizeColor,
    canCustomizeFont,
    canCustomizeBadge,
    setTrpcErrors,
    t
  ]);

  if (!ownPublicUser) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profileTitle')}</CardTitle>
        <CardDescription>{t('profileDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <AvatarManager user={ownPublicUser} />

        <Group label={t('usernameLabel')}>
          <Input placeholder={t('usernamePlaceholder')} {...r('name')} />
        </Group>

        <Group label={t('bioLabel')}>
          <Textarea placeholder={t('bioPlaceholder')} {...r('bio')} />
        </Group>

        <Group label={t('bannerColorLabel')}>
          <Color {...rr('bannerColor')} defaultValue="#FFFFFF" />
        </Group>

        {(canCustomizeColor || canCustomizeFont || canCustomizeBadge) && (
          <Group
            label={t('nicknameStyleLabel')}
            description={t('nicknameStyleDesc')}
          >
            <div className="space-y-3">
              {canCustomizeColor && (
                <div className="flex items-center gap-3">
                  <Label className="w-24 text-sm text-muted-foreground">
                    {t('nicknameColorLabel')}
                  </Label>
                  <Color
                    value={values.nicknameColor ?? '#ffffff'}
                    onChange={(v) => onChange('nicknameColor', v)}
                    defaultValue="#ffffff"
                  />
                  {values.nicknameColor !== null && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onChange('nicknameColor', null)}
                    >
                      {t('nicknameColorClear')}
                    </Button>
                  )}
                </div>
              )}

              {canCustomizeFont && (
                <div className="flex items-center gap-3">
                  <Label className="w-24 text-sm text-muted-foreground">
                    {t('nicknameFontLabel')}
                  </Label>
                  <Select
                    value={values.nicknameFont ?? 'inter'}
                    onValueChange={(v) =>
                      onChange('nicknameFont', v === 'inter' ? null : v)
                    }
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {NICKNAME_FONT_OPTIONS.map(({ key, label, family }) => (
                          <SelectItem
                            key={key}
                            value={key}
                            style={{ fontFamily: family }}
                          >
                            {label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {canCustomizeBadge && (
                <div className="flex items-center gap-3">
                  <Label className="w-24 text-sm text-muted-foreground">
                    {t('nicknameBadgeLabel')}
                  </Label>
                  <Switch
                    checked={values.showRoleBadge}
                    onCheckedChange={(checked) =>
                      onChange('showRoleBadge', checked)
                    }
                  />
                </div>
              )}

              <div className="flex items-center gap-2 mt-2 p-3 rounded-md bg-muted/30">
                <span className="text-xs text-muted-foreground">
                  {t('nicknamePreviewLabel')}
                </span>
                <span
                  style={{
                    color: values.nicknameColor ?? undefined,
                    fontFamily: getNicknameFontFamily(values.nicknameFont)
                  }}
                  className="font-medium"
                >
                  {values.name || ownPublicUser.name}
                </span>
                {values.showRoleBadge && (
                  <NicknameBadge userId={ownPublicUser.id} size="md" />
                )}
              </div>
            </div>
          </Group>
        )}

        <BannerManager user={ownPublicUser} />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={closeServerScreens}>
            {t('cancel')}
          </Button>
          <Button onClick={() => void onUpdateUser()}>{t('saveChanges')}</Button>
        </div>
      </CardContent>
    </Card>
  );
});

export { Profile };
