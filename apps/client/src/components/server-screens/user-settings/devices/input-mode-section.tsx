import {
  clampMicrophoneDecibels,
  MICROPHONE_GATE_DEFAULT_THRESHOLD_DB,
  microphoneDecibelsToPercent
} from '@/helpers/audio-gate';
import { DEFAULT_PTT_KEY, InputMode } from '@/types';
import {
  Button,
  Group,
  Label,
  RadioGroup,
  RadioGroupItem,
  Slider
} from '@sharkord/ui';
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

    return (
      <Group label={t('inputModeLabel')} description={t('inputModeDesc')}>
        <RadioGroup
          value={inputMode}
          onValueChange={(v) => onInputModeChange(v as InputMode)}
          className="flex flex-col gap-3"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value={InputMode.NORMAL} id="im-normal" />
            <Label htmlFor="im-normal" className="cursor-pointer font-normal">
              {t('inputModeNormal')}
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <RadioGroupItem value={InputMode.PTT} id="im-ptt" />
            <Label htmlFor="im-ptt" className="cursor-pointer font-normal">
              {t('inputModePtt')}
            </Label>
          </div>

          {inputMode === InputMode.PTT && (
            <div className="ml-6 flex items-center gap-3">
              <Label className="text-muted-foreground text-sm">
                {t('pttKeyLabel')}
              </Label>
              <Button
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

          <div className="flex items-center gap-2">
            <RadioGroupItem value={InputMode.VAD} id="im-vad" />
            <Label htmlFor="im-vad" className="cursor-pointer font-normal">
              {t('inputModeVad')}
            </Label>
          </div>

          {inputMode === InputMode.VAD && (
            <div className="ml-6 flex flex-col gap-2">
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
                  // Convert percent back to dB (inverted: higher % = more sensitive = lower threshold).
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
        </RadioGroup>
      </Group>
    );
  }
);

export { InputModeSection };
