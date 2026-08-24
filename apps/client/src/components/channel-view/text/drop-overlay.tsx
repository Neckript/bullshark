import type { TUploadRefusal } from '@/hooks/use-upload-permission';
import { TestId } from '@sharkord/shared';
import { filesize } from 'filesize';
import { CircleSlash, Upload } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

type TDropOverlayProps = {
  channelName?: string;
  refusal?: TUploadRefusal;
  maxFiles?: number;
  maxFileSize?: number;
};

const DropOverlay = memo(
  ({ channelName, refusal, maxFiles, maxFileSize }: TDropOverlayProps) => {
    const { t } = useTranslation();

    const limits = useMemo(() => {
      if (!maxFiles || !maxFileSize) return undefined;

      return t('dropLimits', {
        count: maxFiles,
        size: filesize(maxFileSize)
      });
    }, [maxFiles, maxFileSize, t]);

    const title = refusal
      ? t('dropRefusedTitle')
      : channelName
        ? t('dropToSendInChannel', { name: channelName })
        : t('dropToSendHere');

    const subtitle = refusal ? t(refusal) : limits;

    return (
      <div
        data-testid={TestId.DROP_OVERLAY}
        className={`pointer-events-none absolute inset-2 z-20 flex flex-col items-center justify-center gap-2 rounded-[var(--radius)] border-2 border-dashed bg-background/70 backdrop-blur-sm animate-in fade-in duration-150 ${
          refusal ? 'border-destructive/60' : 'border-primary/60'
        }`}
      >
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full ${
            refusal
              ? 'bg-destructive/15 text-destructive'
              : 'bg-primary/15 text-primary'
          }`}
        >
          {refusal ? (
            <CircleSlash className="h-6 w-6" />
          ) : (
            <Upload className="h-6 w-6" />
          )}
        </div>

        <span className="font-display text-base font-semibold">{title}</span>
        {subtitle && (
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        )}
      </div>
    );
  }
);

export { DropOverlay };
