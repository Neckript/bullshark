import { getFileUrl } from '@/helpers/get-file-url';
import type { TJoinedSound } from '@sharkord/shared';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Spinner
} from '@sharkord/ui';
import { Plus, Search } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SoundItem } from './sound-item';

type TSoundListProps = {
  sounds: TJoinedSound[];
  setSelectedSoundId: (id: number) => void;
  selectedSoundId: number;
  uploadSound: () => void;
  isUploading: boolean;
};

const SoundList = memo(
  ({
    sounds,
    setSelectedSoundId,
    selectedSoundId,
    uploadSound,
    isUploading
  }: TSoundListProps) => {
    const { t } = useTranslation('settings');
    const [search, setSearch] = useState('');
    const [previewingId, setPreviewingId] = useState<number | undefined>(
      undefined
    );
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const stopPreview = useCallback(() => {
      audioRef.current?.pause();
      audioRef.current = null;
      setPreviewingId(undefined);
    }, []);

    useEffect(() => stopPreview, [stopPreview]);

    const togglePreview = useCallback(
      (sound: TJoinedSound) => {
        if (previewingId === sound.id) {
          stopPreview();
          return;
        }

        stopPreview();

        const audio = new Audio(getFileUrl(sound.file));
        audio.onended = () => setPreviewingId(undefined);
        audioRef.current = audio;
        setPreviewingId(sound.id);
        audio.play().catch(() => stopPreview());
      },
      [previewingId, stopPreview]
    );

    const filteredSounds = useMemo(() => {
      const sorted = [...sounds].sort((a, b) => b.createdAt - a.createdAt);

      if (!search) return sorted;

      return sorted.filter((sound) =>
        sound.name.toLowerCase().includes(search.toLowerCase())
      );
    }, [sounds, search]);

    return (
      <Card className="w-full md:w-80 md:flex-shrink-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t('soundTitle')}</CardTitle>
            <Button
              size="icon"
              variant="ghost"
              onClick={uploadSound}
              disabled={isUploading}
            >
              {isUploading ? (
                <Spinner size="xs" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="relative">
            <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder={t('searchSoundsPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="max-h-96 overflow-y-auto">
            {filteredSounds.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center text-sm">
                {search ? t('noSoundsFound') : t('noCustomSoundsYet')}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {filteredSounds.map((sound) => (
                  <SoundItem
                    key={sound.id}
                    name={sound.name}
                    isPlaying={previewingId === sound.id}
                    onClick={() => setSelectedSoundId(sound.id)}
                    onTogglePreview={() => togglePreview(sound)}
                    className={
                      selectedSoundId === sound.id
                        ? 'bg-accent ring-primary ring-2'
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
);

export { SoundList };
