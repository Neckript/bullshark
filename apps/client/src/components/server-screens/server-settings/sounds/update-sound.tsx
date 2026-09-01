import { requestConfirmation } from '@/features/dialogs/actions';
import { getFileUrl } from '@/helpers/get-file-url';
import { getTRPCClient } from '@/lib/trpc';
import {
  parseTrpcErrors,
  type TJoinedSound,
  type TTrpcErrors
} from '@bullshark/shared';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label
} from '@bullshark/ui';
import { filesize } from 'filesize';
import { Trash2 } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type TUpdateSoundProps = {
  selectedSound: TJoinedSound;
  setSelectedSoundId: (id: number | undefined) => void;
  refetch: () => void;
};

const UpdateSound = memo(
  ({ selectedSound, setSelectedSoundId, refetch }: TUpdateSoundProps) => {
    const { t } = useTranslation('settings');
    const [name, setName] = useState(selectedSound.name);
    const [errors, setErrors] = useState<TTrpcErrors>({});

    const onDeleteSound = useCallback(async () => {
      const choice = await requestConfirmation({
        title: t('deleteSoundTitle'),
        message: t('deleteSoundMsg'),
        confirmLabel: t('deleteSoundBtn')
      });

      if (!choice) return;

      const trpc = getTRPCClient();

      try {
        await trpc.sounds.delete.mutate({ soundId: selectedSound.id });
        toast.success(t('soundDeleted'));
        refetch();
        setSelectedSoundId(undefined);
      } catch {
        toast.error(t('failedDeleteSound'));
      }
    }, [selectedSound.id, refetch, setSelectedSoundId, t]);

    const onUpdateSound = useCallback(async () => {
      const trpc = getTRPCClient();

      try {
        await trpc.sounds.update.mutate({ soundId: selectedSound.id, name });
        toast.success(t('soundUpdated'));
        refetch();
      } catch (error) {
        setErrors(parseTrpcErrors(error));
      }
    }, [name, selectedSound.id, refetch, t]);

    const onNameChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setName(e.target.value);
        setErrors((prev) => ({ ...prev, name: undefined }));
      },
      []
    );

    return (
      <Card className="flex-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('editSoundTitle')}</CardTitle>
            <Button size="icon" variant="ghost" onClick={onDeleteSound}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted flex items-center gap-4 rounded-lg p-4">
            <audio
              controls
              src={getFileUrl(selectedSound.file)}
              className="w-full"
            />
          </div>

          <div className="text-muted-foreground text-sm">
            {filesize(selectedSound.file.size)} • {t('soundUploadedBy')}{' '}
            {selectedSound.user.name}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sound-name">{t('soundNameLabel')}</Label>
              <Input
                id="sound-name"
                value={name}
                onChange={onNameChange}
                placeholder={t('soundNamePlaceholder')}
                error={errors.name}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setSelectedSoundId(undefined)}
            >
              {t('close')}
            </Button>
            <Button
              onClick={onUpdateSound}
              disabled={selectedSound.name === name}
            >
              {t('saveChanges')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
);

export { UpdateSound };
