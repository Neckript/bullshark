import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { memo, useState } from 'react';
import { ServerScreenLayout } from './server-screen-layout';

type TSettingsSection = {
  id: string;
  label: string;
  content: React.ReactNode;
};

type TSectionedSettingsProps = {
  close: () => void;
  title: string;
  // En-tete du groupe facon Discord : le nom du salon ou de la categorie.
  groupLabel: string;
  sections: TSettingsSection[];
};

// Nav laterale a un seul groupe pour les ecrans de salon et de categorie.
// Meme rendu et meme mecanique mobile que ServerSettings, sans le filtrage
// par permission : l'ecran entier est deja protege a l'ouverture.
const SectionedSettings = memo(
  ({ close, title, groupLabel, sections }: TSectionedSettingsProps) => {
    const [activeId, setActiveId] = useState(sections[0]?.id);
    // null = liste (mobile) ; une section = plein-ecran par-dessus la liste.
    const [mobileOpenId, setMobileOpenId] = useState<string | null>(null);

    const active = sections.find((s) => s.id === activeId) ?? sections[0];
    const mobileOpen = sections.find((s) => s.id === mobileOpenId);

    return (
      <ServerScreenLayout close={close} title={title}>
        <div className="flex h-full">
          <nav className="hidden w-48 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border p-3 md:flex">
            {groupLabel && (
              <div className="mb-0.5 truncate rounded-md bg-muted/50 px-2.5 py-1 text-[0.65rem] font-medium tracking-widest text-muted-foreground uppercase">
                {groupLabel}
              </div>
            )}
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveId(section.id)}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-left text-sm text-muted-foreground outline-none transition-colors duration-fast ease-out hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  active?.id === section.id &&
                    'bg-accent text-accent-foreground'
                )}
              >
                {section.label}
              </button>
            ))}
          </nav>

          <div className="hidden min-w-0 flex-1 overflow-y-auto px-4 py-6 md:block">
            <div className="mx-auto max-w-4xl space-y-6">{active?.content}</div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col divide-y divide-border overflow-y-auto md:hidden">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setMobileOpenId(section.id)}
                className="flex items-center justify-between px-4 py-3 text-left text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {section.label}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>

        {mobileOpen && (
          <div className="absolute inset-0 flex flex-col bg-background md:hidden">
            <div className="flex h-14 shrink-0 items-center gap-4 border-b border-border px-4">
              <button
                type="button"
                onClick={() => setMobileOpenId(null)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h2 className="text-base font-semibold">{mobileOpen.label}</h2>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
              {mobileOpen.content}
            </div>
          </div>
        )}
      </ServerScreenLayout>
    );
  }
);

export { SectionedSettings };
