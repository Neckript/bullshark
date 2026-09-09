import { cn } from '@/lib/utils';
import { Button } from '@bullshark/ui';
import { X } from 'lucide-react';
import { memo } from 'react';

type TServerScreenLayoutProps = {
  close: () => void;
  title: string;
  children: React.ReactNode;
};

const ServerScreenLayout = memo(
  ({ close, title, children }: TServerScreenLayoutProps) => {
    // Ces écrans sont rendus dans un portail, donc PAR-DESSUS la barre du haut,
    // qui reste dans le DOM avec sa zone de glissement. Or une zone de
    // glissement est remise au système d'exploitation : ce qui est peint
    // au-dessus ne perce pas le trou, seul un `no-drag` explicite soustrait.
    // Sans les deux classes ci-dessous, le bouton de fermeture se retrouve
    // sous la bande de 48 px et cesse de répondre, sans la moindre erreur.
    const isDesktopShell = Boolean(window.bullshark?.isDesktop);

    return (
      <div
        className={cn(
          'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4',
          isDesktopShell && 'app-drag'
        )}
      >
        <div
          className={cn(
            'flex h-full max-h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-lg md:h-[85dvh]',
            isDesktopShell && 'app-no-drag'
          )}
        >
          <div className="flex h-14 shrink-0 items-center gap-4 border-b border-border px-6">
            <h1 className="flex-1 text-lg font-semibold">{title}</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={close}
              className={cn(isDesktopShell && 'app-no-drag')}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
            {children}
          </div>
        </div>
      </div>
    );
  }
);

export { ServerScreenLayout };
