import { useInfo } from '@/features/server/hooks';
import { getFileUrl } from '@/helpers/get-file-url';
import { memo, useMemo, type ReactNode } from 'react';

type TEmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  variant?: 'full' | 'compact';
  children?: ReactNode;
};

// Le masque et l'échelle du filigrane passent par `style` et non par des
// classes arbitraires Tailwind : c'est la seule façon d'être certain que la
// règle sort dans le bundle construit (leçon C1/C2 du chantier 1).
const WATERMARK_STYLE = {
  WebkitMaskImage: 'radial-gradient(closest-side, #000 40%, transparent 100%)',
  maskImage: 'radial-gradient(closest-side, #000 40%, transparent 100%)'
} as const;

const EmptyState = memo(
  ({
    title,
    description,
    action,
    icon,
    variant = 'full',
    children
  }: TEmptyStateProps) => {
    const info = useInfo();

    const watermarkSrc = useMemo(() => {
      if (info?.logo) {
        return getFileUrl(info.logo);
      }

      return '/logo.webp';
    }, [info]);

    if (variant === 'compact') {
      return (
        <div className="flex flex-col items-center gap-1 px-4 py-6 text-center">
          {icon && <div className="text-muted-foreground/70">{icon}</div>}
          <span className="text-sm font-medium">{title}</span>
          {description && (
            <span className="text-xs text-muted-foreground">{description}</span>
          )}
          {children}
        </div>
      );
    }

    return (
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden px-8 text-center">
        <img
          src={watermarkSrc}
          alt=""
          aria-hidden="true"
          style={WATERMARK_STYLE}
          className="pointer-events-none absolute h-[min(60%,22rem)] w-auto max-w-[70%] select-none opacity-[0.07] grayscale dark:opacity-[0.05]"
        />

        <div className="relative flex flex-col items-center gap-2">
          {icon && <div className="mb-1 text-muted-foreground/70">{icon}</div>}
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            {title}
          </h2>
          {description && (
            <p className="max-w-sm text-sm text-muted-foreground">
              {description}
            </p>
          )}
          {action && <div className="mt-2">{action}</div>}
          {children}
        </div>
      </div>
    );
  }
);

export { EmptyState };
