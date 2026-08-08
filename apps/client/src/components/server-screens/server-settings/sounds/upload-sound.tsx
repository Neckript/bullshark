import {
  MAX_SOUND_DURATION_SECONDS,
  MAX_SOUND_FILE_SIZE
} from '@sharkord/shared';
import { Button, Card, CardContent } from '@sharkord/ui';
import { filesize } from 'filesize';
import { Upload } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

type TUploadSoundProps = {
  uploadSound: () => void;
  isUploading: boolean;
};

const UploadSound = memo(({ uploadSound, isUploading }: TUploadSoundProps) => {
  const { t } = useTranslation('settings');

  return (
    <Card className="flex flex-1 items-center justify-center">
      <CardContent className="text-muted-foreground max-w-md py-12 text-center">
        <div className="mb-4 text-4xl">🎵</div>
        <h3 className="mb-2 font-medium">{t('uploadSoundTitle')}</h3>
        <p className="mb-4 text-sm">
          {t('uploadSoundDesc', {
            size: filesize(MAX_SOUND_FILE_SIZE),
            seconds: MAX_SOUND_DURATION_SECONDS
          })}
        </p>
        <Button onClick={uploadSound} disabled={isUploading}>
          <Upload className="mr-2 h-4 w-4" />
          {t('uploadSoundBtn')}
        </Button>
      </CardContent>
    </Card>
  );
});

export { UploadSound };
