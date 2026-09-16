import { setModViewOpen } from '@/features/app/actions';
import { useModViewOpen } from '@/features/app/hooks';
import { useAdminUserInfo } from '@/features/server/admin/hooks';
import { extractUrls } from '@bullshark/shared';
import { Sheet, SheetContent, SheetTitle } from '@bullshark/ui';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ModViewContext, ModViewScreen, type TModViewContext } from './context';
import { ModViewContent } from './mod-view-content';

type TContentWrapperProps = {
  userId: number;
};

const ContentWrapper = memo(({ userId }: TContentWrapperProps) => {
  const { t } = useTranslation('settings');
  const [currentView, setCurrentView] = useState<ModViewScreen | undefined>(
    undefined
  );
  const { user, loading, refetch, logins, files, messages, storage } =
    useAdminUserInfo(userId);

  const contextValue = useMemo<TModViewContext>(() => {
    const links: string[] = messages
      .map((msg) => extractUrls(msg.content ?? ''))
      .flat()
      .filter((value, index, self) => self.indexOf(value) === index);

    return {
      userId,
      user: user!,
      logins,
      files,
      storage,
      messages,
      links,
      refetch,
      view: currentView,
      setView: setCurrentView
    };
  }, [userId, refetch, files, storage, user, logins, messages, currentView]);

  if (loading || !user) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">{t('modViewLoading')}</p>
      </div>
    );
  }

  return (
    <ModViewContext.Provider value={contextValue}>
      <ModViewContent key={userId} />
    </ModViewContext.Provider>
  );
});

const ModViewSheet = memo(() => {
  const { t } = useTranslation('settings');
  const { isOpen, userId } = useModViewOpen();

  const handleClose = useCallback(() => {
    setModViewOpen(false);
  }, []);

  // onOpenChange cable la fermeture native de Radix : clic sur l'overlay,
  // touche Echap et bouton X passent tous par la (avant, rien n'etait cable
  // et seul un handler Echap manuel fermait la vue).
  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
    >
      <SheetContent close={handleClose}>
        <SheetTitle className="sr-only">{t('modViewTitle')}</SheetTitle>
        {userId && <ContentWrapper userId={userId} />}
      </SheetContent>
    </Sheet>
  );
});

export { ModViewSheet };
