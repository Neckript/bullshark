import { useSounds } from '@/features/server/soundboard/hooks';
import { useVoice } from '@/features/server/voice/hooks';
import { cn } from '@/lib/utils';
import { Button, Popover, PopoverContent, PopoverTrigger } from '@bullshark/ui';
import { Music } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

type TSoundboardButtonProps = {
  disabled: boolean;
};

const SoundboardButton = memo(({ disabled }: TSoundboardButtonProps) => {
  const { t } = useTranslation('common');
  const sounds = useSounds();
  const { playSoundboardClip, playingSoundId } = useVoice();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10"
          disabled={disabled}
          aria-label={t('soundboard')}
        >
          <Music size={20} />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-2">
        {sounds.length === 0 ? (
          <p className="text-muted-foreground p-4 text-center text-sm">
            {t('noSoundsAvailable')}
          </p>
        ) : (
          <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto">
            {sounds.map((sound) => (
              <Button
                key={sound.id}
                variant="secondary"
                className={cn(
                  'h-16 truncate text-xs',
                  playingSoundId === sound.id && 'ring-primary ring-2'
                )}
                onClick={() => playSoundboardClip(sound)}
              >
                {sound.name}
              </Button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
});

export { SoundboardButton };
