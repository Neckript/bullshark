import {
  useCurrentVoiceChannelId,
  useIsCurrentVoiceChannelSelected
} from '@/features/server/channels/hooks';
import { usePublicServerSettings } from '@/features/server/hooks';
import { cn } from '@/lib/utils';
import { PluginSlot } from '@bullshark/shared';
import { Button, Tooltip } from '@bullshark/ui';
import { PanelRight, PanelRightClose } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { PluginSlotRenderer } from '../plugin-slot-renderer';
import { ServerSearch } from './server-search';
import { VoiceButtons } from './voice-buttons';

type TTopBarProps = {
  onToggleRightSidebar: () => void;
  isOpen: boolean;
};

const TopBar = memo(({ onToggleRightSidebar, isOpen }: TTopBarProps) => {
  const { t } = useTranslation('topbar');
  const isCurrentVoiceChannelSelected = useIsCurrentVoiceChannelSelected();
  const currentVoiceChannelId = useCurrentVoiceChannelId();
  const settings = usePublicServerSettings();

  // Dans le shell desktop cette bande EST la barre de titre : elle porte la
  // zone de glissement, et chaque colonne cliquable doit s'en exclure.
  const isDesktopShell = Boolean(window.bullshark?.isDesktop);

  return (
    <div
      className={cn(
        'hidden lg:grid h-12 w-full grid-cols-[1fr_minmax(320px,1.4fr)_1fr] items-center border-b border-border bg-card px-4 transition-all duration-300 ease-in-out gap-2 shadow-[inset_0_1px_0_var(--edge-hi)]',
        isDesktopShell && 'app-drag'
      )}
      // Les boutons systeme sont peints PAR-DESSUS la page : sans ce
      // remplissage ils recouvriraient la colonne de droite. Les variables
      // titlebar-area-* suivent l'echelle d'affichage de Windows, ce qu'une
      // constante ne saurait pas faire.
      style={
        isDesktopShell
          ? {
              paddingLeft: 'env(titlebar-area-x, 0px)',
              paddingRight:
                'calc(100vw - env(titlebar-area-width, 100vw) - env(titlebar-area-x, 0px))'
            }
          : undefined
      }
    >
      <div className="flex min-w-0 items-center gap-2" />

      <div
        className={cn(
          'flex items-center justify-center',
          isDesktopShell && 'app-no-drag'
        )}
      >
        {settings?.enableSearch && <ServerSearch />}
      </div>

      <div
        className={cn(
          'flex min-w-0 items-center justify-end gap-2',
          isDesktopShell && 'app-no-drag'
        )}
      >
        <PluginSlotRenderer slotId={PluginSlot.TOPBAR_RIGHT} />
        {isCurrentVoiceChannelSelected && currentVoiceChannelId && (
          <VoiceButtons currentVoiceChannelId={currentVoiceChannelId} />
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleRightSidebar}
          className="h-7 px-2 transition-all duration-200 ease-in-out"
        >
          {isOpen ? (
            <Tooltip content={t('closeMembersSidebar')}>
              <div>
                <PanelRightClose className="w-4 h-4 transition-transform duration-200 ease-in-out" />
              </div>
            </Tooltip>
          ) : (
            <Tooltip content={t('openMembersSidebar')}>
              <div>
                <PanelRight className="w-4 h-4 transition-transform duration-200 ease-in-out" />
              </div>
            </Tooltip>
          )}
        </Button>
      </div>
    </div>
  );
});

export { TopBar };
