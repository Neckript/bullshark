import {
  clampMicrophoneDecibels,
  MICROPHONE_GATE_DEFAULT_THRESHOLD_DB,
  microphoneDecibelsToPercent
} from '@/helpers/audio-gate';
import { cn } from '@/lib/utils';
import { DEFAULT_PTT_KEY, InputMode } from '@/types';
import { Button, Group, Label, Slider } from '@sharkord/ui';
import { Keyboard } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

/** Convert a KeyboardEvent.code to a human-readable label. */
const formatPttKey = (code: string): string => {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  // Insert space before each uppercase letter run, then trim.
  return code.replace(/([A-Z])/g, ' $1').trim().replace(/\s+/g, ' ');
};

type TInputModeSectionProps = {
  inputMode: InputMode;
  pttKey: string;
  vadThreshold: number;
  onInputModeChange: (mode: InputMode) => void;
  onPttKeyChange: (key: string) => void;
  onVadThresholdChange: (threshold: number) => void;
};

const InputModeSection = memo(
  ({
    inputMode,
    pttKey,
    vadThreshold,
    onInputModeChange,
    onPttKeyChange,
    onVadThresholdChange
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
        // Ignore bare modifier-only presses — they can't be held alone reliably.
        if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
        e.preventDefault();
        capturingRef.current = false;
        setIsCapturing(false);
        onPttKeyChange(e.code);
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isCapturing, onPttKeyChange]);

    const vadPercent = microphoneDecibelsToPercent(vadThreshold);

    const modes = [
      { value: InputMode.NORMAL, label: t('inputModeNormal') },
      { value: InputMode.PTT, label: t('inputModePtt') },
      { value: InputMode.VAD, label: t('inputModeVad') }
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

          {inputMode === InputMode.VAD && (
            <div className="flex flex-col gap-2 pl-1">
              <Label className="text-muted-foreground text-sm">
                {t('vadSensitivityLabel')}
              </Label>
              <Slider
                className="max-w-80"
                min={0}
                max={100}
                step={1}
                value={[vadPercent]}
                onValueChange={([value]) => {
                  const pct = value / 100;
                  const db = clampMicrophoneDecibels(
                    MICROPHONE_GATE_DEFAULT_THRESHOLD_DB +
                      pct *
                        (clampMicrophoneDecibels(0) -
                          MICROPHONE_GATE_DEFAULT_THRESHOLD_DB)
                  );
                  onVadThresholdChange(db);
                }}
                rightSlot={
                  <span className="text-sm text-muted-foreground w-16 text-right">
                    {Math.round(vadPercent)}%
                  </span>
                }
              />
              <p className="text-xs text-muted-foreground">
                {t('vadSensitivityHint')}
              </p>
            </div>
          )}
        </div>
      </Group>
    );
  }
);

export { InputModeSection };
