import type { TDialogBaseProps } from '@/components/dialogs/types';
import { setSelectedDmChannelId } from '@/features/app/actions';
import { closeDialogs, openDialog } from '@/features/dialogs/actions';
import { setDmsOpen } from '@/features/server/actions';
import { selectChannel } from '@/features/server/channels/actions';
import { useOnEsc } from '@/hooks/use-on-esc';
import { getTRPCClient } from '@/lib/trpc';
import { Dialog, DialogContent, DialogTitle } from '@sharkord/ui';
import { Search } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Dialog as DialogName } from '../dialogs';
import { useQuickSwitcherGroups } from './hooks';
import { rememberRecentTarget } from './recents';
import { QuickSwitcherRow } from './row';
import type { TQuickSwitcherGroup, TQuickSwitcherItem } from './types';

const GROUP_LABEL_KEYS: Record<TQuickSwitcherGroup['key'], string> = {
  recents: 'quickSwitcherRecents',
  channels: 'quickSwitcherChannels',
  voice: 'quickSwitcherVoice',
  users: 'quickSwitcherUsers'
};

const QuickSwitcherDialog = memo(({ isOpen, close }: TDialogBaseProps) => {
  const { t } = useTranslation('dialogs');
  useOnEsc(close);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const groups = useQuickSwitcherGroups(query, isOpen);

  const items = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  const hasEscapeHatch = query.trim() !== '';
  // La porte de sortie est une ligne de plus, en fin de liste : elle est
  // atteignable aux flèches, et c'est elle qui est active quand rien d'autre
  // ne correspond.
  const totalRows = items.length + (hasEscapeHatch ? 1 : 0);
  const boundedIndex = Math.min(activeIndex, Math.max(0, totalRows - 1));

  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [boundedIndex, groups]);

  const openContentSearch = useCallback(() => {
    openDialog(DialogName.SEARCH, { initialQuery: query.trim() });
  }, [query]);

  const openItem = useCallback(
    async (item: TQuickSwitcherItem) => {
      if (item.kind === 'user') {
        const trpc = getTRPCClient();

        try {
          const result = await trpc.dms.open.mutate({ userId: item.id });

          setDmsOpen(true);
          setSelectedDmChannelId(result.channelId);
        } catch {
          // Seule action du chantier qui touche le réseau : sur échec la
          // palette reste ouverte, l'utilisateur peut réessayer ou choisir
          // autre chose.
          toast.error(t('quickSwitcherCouldNotOpenDm'));

          return;
        }

        rememberRecentTarget({ kind: 'user', id: item.id });
        closeDialogs();

        return;
      }

      setDmsOpen(false);
      setSelectedDmChannelId(undefined);
      rememberRecentTarget({ kind: 'channel', id: item.id });
      closeDialogs();

      await selectChannel(item.id);
    },
    [t]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (totalRows === 0) return;

        event.preventDefault();

        setActiveIndex((current) => {
          const bounded = Math.min(current, totalRows - 1);

          return event.key === 'ArrowDown'
            ? (bounded + 1) % totalRows
            : (bounded - 1 + totalRows) % totalRows;
        });

        return;
      }

      if (event.key !== 'Enter') return;

      event.preventDefault();

      const item = items[boundedIndex];

      if (item) {
        openItem(item);

        return;
      }

      if (hasEscapeHatch) {
        openContentSearch();
      }
    },
    [
      boundedIndex,
      hasEscapeHatch,
      items,
      openContentSearch,
      openItem,
      totalRows
    ]
  );

  let rowIndex = -1;

  return (
    <Dialog open={isOpen}>
      <DialogContent
        aria-describedby={undefined}
        className="top-[14vh] block max-w-xl translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
        onInteractOutside={close}
      >
        <DialogTitle className="sr-only">{t('quickSwitcherTitle')}</DialogTitle>

        <div className="flex h-13 items-center gap-2.5 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded
            aria-controls="quick-switcher-list"
            aria-activedescendant={
              items[boundedIndex]
                ? `quick-switcher-${items[boundedIndex]!.key}`
                : hasEscapeHatch && boundedIndex === items.length
                  ? 'quick-switcher-escape-hatch'
                  : undefined
            }
            placeholder={t('quickSwitcherPlaceholder')}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div
          ref={listRef}
          id="quick-switcher-list"
          role="listbox"
          aria-label={t('quickSwitcherTitle')}
          className="flex max-h-85 flex-col gap-0.5 overflow-y-auto p-2"
        >
          {groups.map((group) => (
            <div
              key={group.key}
              role="group"
              aria-label={t(GROUP_LABEL_KEYS[group.key])}
              className="flex flex-col gap-0.5"
            >
              <div className="px-2.5 pt-2 pb-1 text-[0.65rem] font-medium tracking-widest text-muted-foreground uppercase">
                {t(GROUP_LABEL_KEYS[group.key])}
              </div>
              {group.items.map((item) => {
                rowIndex += 1;

                const index = rowIndex;

                return (
                  <QuickSwitcherRow
                    key={item.key}
                    item={item}
                    isActive={index === boundedIndex}
                    onSelect={() => openItem(item)}
                    onHover={() => setActiveIndex(index)}
                  />
                );
              })}
            </div>
          ))}

          {hasEscapeHatch && (
            <div
              role="option"
              id="quick-switcher-escape-hatch"
              aria-selected={boundedIndex === items.length}
              data-active={boundedIndex === items.length}
              onClick={openContentSearch}
              onMouseMove={() => setActiveIndex(items.length)}
              className={
                boundedIndex === items.length
                  ? 'mt-1 flex cursor-default items-center gap-2.5 rounded-pill border-t border-border px-2.5 py-1.5 text-sm bg-accent text-accent-foreground'
                  : 'mt-1 flex cursor-default items-center gap-2.5 border-t border-border px-2.5 py-1.5 text-sm text-muted-foreground'
              }
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate">
                {t('quickSwitcherSearchMessages', { query: query.trim() })}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <span>{t('quickSwitcherHintNavigate')}</span>
          <span>{t('quickSwitcherHintOpen')}</span>
          <span className="ml-auto">{t('quickSwitcherHintSearch')}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
});

export { QuickSwitcherDialog };
