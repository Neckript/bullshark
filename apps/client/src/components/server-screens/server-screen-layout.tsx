import { cn } from '@/lib/utils';
import { Button } from '@bullshark/ui';
import { ChevronLeft } from 'lucide-react';
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
    // Sans les deux classes ci-dessous, le bouton retour se retrouve sous la
    // bande de 48 px et cesse de répondre, sans la moindre erreur.
    const isDesktopShell = Boolean(window.bullshark?.isDesktop);

    return (
      <div className="flex h-screen flex-col bg-background text-foreground">
        <div
          className={cn(
            'flex h-14 items-center gap-4 border-b border-border px-6',
            // La bande reste déplaçable : cet écran occupe toute la fenêtre, et
            // la marquer entièrement `no-drag` rendrait la fenêtre impossible à
            // déplacer tant que les réglages sont ouverts.
            isDesktopShell && 'app-drag'
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={close}
            className={cn(isDesktopShell && 'app-no-drag')}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">{title}</h1>
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-6">
          {children}
        </div>
      </div>
    );
  }
);

export { ServerScreenLayout };
