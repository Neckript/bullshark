import { cn } from '@/lib/utils';
import { Play, Square } from 'lucide-react';
import { memo } from 'react';

type TSoundItemProps = {
  name: string;
  isPlaying: boolean;
  className?: string;
  onClick?: () => void;
  onTogglePreview: () => void;
};

const SoundItem = memo(
  ({
    name,
    isPlaying,
    onClick,
    onTogglePreview,
    className
  }: TSoundItemProps) => {
    return (
      <div
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md p-2',
          className
        )}
        onClick={onClick}
      >
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePreview();
          }}
          aria-label={name}
        >
          {isPlaying ? (
            <Square className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5" />
          )}
        </button>
        <span className="w-full truncate text-center text-xs">{name}</span>
      </div>
    );
  }
);

export { SoundItem };
