import { cn } from '@/lib/utils';
import { DEFAULT_PTT_KEY, InputMode } from '@/types';
import { Button, Group, Label } from '@sharkord/ui';
import { Keyboard } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

/** Convert a KeyboardEvent.code to a human-readable label. */
const formatPttKey = (code: string): string => {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/\s+/g, ' ');
};

type TInputModeSectionProps = {
  inputMode: InputMode;
  pttKey: string;
  onInputModeChange: (mode: InputMode) => void;
  onPttKeyChange: (key: string) => void;
};

const InputModeSection = memo(
  ({
    inputMode,
    pttKey,
    onInputModeChange,
    onPttKeyChange
  }: TInputModeSectionProps) => {
    const { t } = useTranslation('settings');
    const [isCapturing, setIsCapturing] = useState(false);
    const capturingRef = useRef(false);

    const startCapture = useCallback(() => {
      setIsCapturing(true);
      capturingRef.current = true;
    }, []);

    useEffect(() => {
      if (!isCapturing) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (!capturingRef.current) return;
        if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
        e.preventDefault();
        capturingRef.current = false;
        setIsCapturing(false);
        onPttKeyChange(e.code);
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isCapturing, onPttKeyChange]);

    const modes = [
      { value: InputMode.NORMAL, label: t('inputModeNormal') },
      { value: InputMode.PTT, label: t('inputModePtt') }
    ] as const;

    return (
      <Group label={t('inputModeLabel')} description={t('inputModeDesc')}>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 flex-wrap">
            {modes.map(({ value, label }) => (
              <Button
                key={value}
                type="button"
                variant={inputMode === value ? 'default' : 'outline'}
                size="sm"
                onClick={() => onInputModeChange(value)}
                className={cn(
                  'min-w-24',
                  inputMode === value && 'pointer-events-none'
                )}
              >
                {label}
              </Button>
            ))}
          </div>

          {inputMode === InputMode.PTT && (
            <div className="flex items-center gap-3 pl-1">
              <Label className="text-muted-foreground text-sm">
                {t('pttKeyLabel')}
              </Label>
              <Button
                type="button"
                variant={isCapturing ? 'default' : 'outline'}
                size="sm"
                onClick={startCapture}
                className="min-w-28 gap-2"
              >
                <Keyboard className="h-3.5 w-3.5" />
                {isCapturing
                  ? t('pttKeyCapturing')
                  : formatPttKey(pttKey || DEFAULT_PTT_KEY)}
              </Button>
            </div>
          )}
        </div>
      </Group>
    );
  }
);

export { InputModeSection };
