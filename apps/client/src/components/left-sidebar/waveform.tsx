import { cn } from '@/lib/utils';
import { memo } from 'react';

type TIndicatorProps = {
  className?: string;
  isScreenSharing?: boolean;
};

const Waveform = memo(({ className, isScreenSharing }: TIndicatorProps) => {
  if (isScreenSharing) {
    return (
      <div
        className={cn(
          'flex items-center justify-center h-4 w-4 animate-in zoom-in-75 duration-300',
          className
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full"
        >
          <path
            d="M2 12C2 12 5 5 12 5C19 5 22 12 22 12C22 12 19 19 12 19C5 19 2 12 2 12Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            className="animate-eye-blink"
            cx="12"
            cy="12"
            r="3"
            fill="currentColor"
          />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center h-4 w-4 animate-in fade-in duration-700',
        className
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
        style={{ shapeRendering: 'geometricPrecision' }}
      >
        <rect
          className="animate-wf-loop"
          rx="1"
          fill="currentColor"
          width="2"
          x="3"
        />
        <rect
          className="animate-wf-loop"
          rx="1"
          fill="currentColor"
          width="2"
          x="7"
        />
        <rect
          className="animate-wf-loop"
          rx="1"
          fill="currentColor"
          width="2"
          x="11"
        />
        <rect
          className="animate-wf-loop"
          rx="1"
          fill="currentColor"
          width="2"
          x="15"
        />
        <rect
          className="animate-wf-loop"
          rx="1"
          fill="currentColor"
          width="2"
          x="19"
        />
      </svg>
    </div>
  );
});

export { Waveform };
