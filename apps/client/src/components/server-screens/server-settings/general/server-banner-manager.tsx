import { GifPickerDialog } from '@/components/gif-picker/gif-picker-dialog';
import { usePublicServerSettings } from '@/features/server/hooks';
import { getFileUrl } from '@/helpers/get-file-url';
import { uploadImage } from '@/helpers/upload-file';
import { useFilePicker } from '@/hooks/use-file-picker';
import { getTRPCClient } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import type { TFile, TGifSearchResult } from '@bullshark/shared';
import { Button, buttonVariants, Group } from '@bullshark/ui';
import { Upload } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type TServerBannerManagerProps = {
  banner: TFile | null;
  refetch: () => Promise<void>;
};

const ServerBannerManager = memo(
  ({ banner, refetch }: TServerBannerManagerProps) => {
    const { t } = useTranslation('settings');
    const openFilePicker = useFilePicker();
    const settings = usePublicServerSettings();
    const [gifOpen, setGifOpen] = useState(false);

    const removeBanner = useCallback(async () => {
      const trpc = getTRPCClient();

      try {
        await trpc.others.changeServerBanner.mutate({ fileId: undefined });
        await refetch();

        toast.success(t('serverBannerRemoved'));
      } catch {
        toast.error(t('serverBannerError'));
      }
    }, [refetch, t]);

    const onBannerClick = useCallback(async () => {
      const trpc = getTRPCClient();

      try {
        const [file] = await openFilePicker('.gif,.jpg,.jpeg,.png,.webp');

        const temporaryFile = await uploadImage(file);

        if (!temporaryFile) {
          return;
        }

        await trpc.others.changeServerBanner.mutate({
          fileId: temporaryFile.id
        });
        await refetch();

        toast.success(t('serverBannerUpdated'));
      } catch {
        toast.error(t('serverBannerError'));
      }
    }, [openFilePicker, refetch, t]);

    const onSelectGif = useCallback(
      async (gif: TGifSearchResult) => {
        const trpc = getTRPCClient();

        try {
          await trpc.gifs.importToServerBanner.mutate({ gifId: gif.id });
          await refetch();

          toast.success(t('serverBannerUpdated'));
        } catch {
          toast.error(t('serverBannerError'));
        }
      },
      [refetch, t]
    );

    return (
      <Group label={t('serverBannerLabel')} description={t('serverBannerDesc')}>
        <div
          className="group relative w-80 cursor-pointer aspect-[16/9]"
          onClick={onBannerClick}
        >
          {banner ? (
            <img
              src={getFileUrl(banner)}
              alt={t('serverBannerLabel')}
              className="h-full w-full rounded-md object-cover transition-opacity group-hover:opacity-70"
            />
          ) : (
            <div
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'h-full w-full cursor-pointer transition-opacity group-hover:opacity-70'
              )}
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center rounded-md opacity-0 transition-opacity group-hover:opacity-100">
            <div className="rounded-full bg-black/50 p-3">
              <Upload className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        {banner && (
          <div>
            <Button size="sm" variant="outline" onClick={removeBanner}>
              {t('removeServerBanner')}
            </Button>
          </div>
        )}

        {settings?.klipyEnabled && (
          <div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setGifOpen(true)}
            >
              GIF
            </Button>
          </div>
        )}

        <GifPickerDialog
          open={gifOpen}
          onOpenChange={setGifOpen}
          onSelect={onSelectGif}
        />
      </Group>
    );
  }
);

export { ServerBannerManager };
