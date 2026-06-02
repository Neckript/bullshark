import { getTRPCClient } from '@/lib/trpc';
import type { TGifSearchResult } from '@sharkord/shared';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input
} from '@sharkord/ui';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type TGifPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (gifId: string) => void;
};

const GifPickerDialog = memo(
  ({ open, onOpenChange, onSelect }: TGifPickerDialogProps) => {
    const { t } = useTranslation();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<TGifSearchResult[]>([]);
    const [loading, setLoading] = useState(false);

    const runSearch = useCallback(
      async (q: string) => {
        if (!q.trim()) {
          setResults([]);
          return;
        }
        setLoading(true);
        try {
          const trpc = getTRPCClient();
          const page = await trpc.gifs.search.query({
            query: q,
            page: 1,
            perPage: 24
          });
          setResults(page.results);
        } catch {
          toast.error(t('gifSearchFailed'));
        } finally {
          setLoading(false);
        }
      },
      [t]
    );

    useEffect(() => {
      const id = setTimeout(() => void runSearch(query), 350);
      return () => clearTimeout(id);
    }, [query, runSearch]);

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('gifPickerTitle')}</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder={t('gifSearchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto mt-3">
            {results.map((gif) => (
              <button
                key={gif.id}
                type="button"
                className="overflow-hidden rounded-md hover:opacity-80 focus:ring-2 focus:ring-ring"
                onClick={() => {
                  onSelect(gif.id);
                  onOpenChange(false);
                }}
              >
                <img
                  src={gif.previewUrl}
                  alt={gif.title}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
          {loading && (
            <p className="text-xs text-muted-foreground mt-2">{t('loading')}</p>
          )}
        </DialogContent>
      </Dialog>
    );
  }
);

GifPickerDialog.displayName = 'GifPickerDialog';

export { GifPickerDialog };
