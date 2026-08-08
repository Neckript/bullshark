import { useAdminSounds } from '@/features/server/admin/hooks';
import { getAudioDuration } from '@/helpers/get-audio-duration';
import { uploadFiles } from '@/helpers/upload-file';
import { useFilePicker } from '@/hooks/use-file-picker';
import { getTRPCClient } from '@/lib/trpc';
import {
  MAX_SOUND_DURATION_SECONDS,
  MAX_SOUND_FILE_SIZE,
  MAX_SOUND_NAME_LENGTH
} from '@sharkord/shared';
import { LoadingCard } from '@sharkord/ui';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { SoundList } from './sound-list';
import { UpdateSound } from './update-sound';
import { UploadSound } from './upload-sound';

const Sounds = memo(() => {
  const { t } = useTranslation('settings');
  const { sounds, refetch, loading } = useAdminSounds();
  const openFilePicker = useFilePicker();

  const [selectedSoundId, setSelectedSoundId] = useState<number | undefined>(
    undefined
  );
  const [isUploading, setIsUploading] = useState(false);

  const uploadSound = useCallback(async () => {
    const files = await openFilePicker('audio/*', true);

    if (!files || files.length === 0) return;

    setIsUploading(true);

    const trpc = getTRPCClient();

    try {
      for (const file of files) {
        if (file.size > MAX_SOUND_FILE_SIZE) {
          toast.error(t('soundTooLarge'));
          return;
        }

        const duration = await getAudioDuration(file);

        if (duration > MAX_SOUND_DURATION_SECONDS) {
          toast.error(t('soundTooLong'));
          return;
        }
      }

      const temporaryFiles = await uploadFiles(files);

      await trpc.sounds.add.mutate(
        temporaryFiles.map((f) => ({
          name: f.originalName
            .replace(/\.[^/.]+$/, '')
            .slice(0, MAX_SOUND_NAME_LENGTH),
          fileId: f.id
        }))
      );

      refetch();
      toast.success(t('soundCreated'));
    } catch (error) {
      console.error('Error uploading sound:', error);
      toast.error(t('failedUploadSound'));
    } finally {
      setIsUploading(false);
    }
  }, [openFilePicker, refetch, t]);

  const selectedSound = useMemo(
    () => sounds.find((s) => s.id === selectedSoundId),
    [sounds, selectedSoundId]
  );

  if (loading) {
    return <LoadingCard className="h-[600px]" />;
  }

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <SoundList
        sounds={sounds}
        setSelectedSoundId={(id) => setSelectedSoundId(id)}
        selectedSoundId={selectedSoundId ?? -1}
        uploadSound={uploadSound}
        isUploading={isUploading}
      />

      {selectedSound ? (
        <UpdateSound
          key={selectedSound.id}
          selectedSound={selectedSound}
          setSelectedSoundId={setSelectedSoundId}
          refetch={refetch}
        />
      ) : (
        <UploadSound uploadSound={uploadSound} isUploading={isUploading} />
      )}
    </div>
  );
});

export { Sounds };
