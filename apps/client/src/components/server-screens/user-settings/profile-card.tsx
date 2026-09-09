import { UserAvatar } from '@/components/user-avatar';
import { useOwnPublicUser } from '@/features/server/users/hooks';
import { getFileUrl } from '@/helpers/get-file-url';
import { useDateLocale } from '@/hooks/use-date-locale';
import { Button } from '@bullshark/ui';
import { format } from 'date-fns';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

type TUserSettingsProfileCardProps = {
  onEditProfile: () => void;
};

const UserSettingsProfileCard = memo(
  ({ onEditProfile }: TUserSettingsProfileCardProps) => {
    // Namespace par defaut (common), pas 'settings' : c'est la meme cle que
    // celle deja utilisee par user-popover/index.tsx pour "Membre depuis",
    // pas une nouvelle traduction a dupliquer.
    const { t } = useTranslation();
    const { t: tSettings } = useTranslation('settings');
    const dateLocale = useDateLocale();
    const ownPublicUser = useOwnPublicUser();

    if (!ownPublicUser) return null;

    return (
      <div className="border-b border-border pb-4">
        <div className="h-24 w-full bg-muted">
          {ownPublicUser.banner && (
            <img
              src={getFileUrl(ownPublicUser.banner)}
              alt=""
              className="h-24 w-full object-cover"
            />
          )}
        </div>

        <div className="-mt-8 flex flex-col gap-3 px-4">
          <UserAvatar
            userId={ownPublicUser.id}
            className="h-16 w-16 rounded-full border-4 border-background bg-muted"
            showStatusBadge
            showUserPopover={false}
          />

          <div>
            <p className="text-lg font-semibold text-foreground">
              {ownPublicUser.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('memberSince', {
                date: format(new Date(ownPublicUser.createdAt), 'PP', {
                  locale: dateLocale
                })
              })}
            </p>
          </div>

          <Button onClick={onEditProfile} className="w-full">
            {tSettings('editProfileButton')}
          </Button>

          {ownPublicUser.bio && (
            <p className="text-sm text-foreground">{ownPublicUser.bio}</p>
          )}
        </div>
      </div>
    );
  }
);

export { UserSettingsProfileCard };
