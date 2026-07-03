import { useCustomThemeAccent, useCustomThemeBg } from '@/features/app/hooks';
import {
  clearCustomTheme,
  saveCustomTheme
} from '@/features/server/user-settings/actions';
import { applyCustomThemeVars } from '@/helpers/custom-theme';
import { Button } from '@sharkord/ui';
import { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme-provider';

const DEFAULT_BG = '#12161d';
const DEFAULT_ACCENT = '#7ba7cc';

type TCustomThemeEditorProps = {
  onClose: () => void;
};

const CustomThemeEditor = memo(({ onClose }: TCustomThemeEditorProps) => {
  const { t } = useTranslation('settings');
  const { theme, setTheme } = useTheme();
  const savedBg = useCustomThemeBg();
  const savedAccent = useCustomThemeAccent();
  const previousThemeRef = useRef(theme);
  const [bg, setBg] = useState(savedBg ?? DEFAULT_BG);
  const [accent, setAccent] = useState(savedAccent ?? DEFAULT_ACCENT);
  const [saving, setSaving] = useState(false);

  // Live preview: activate the custom theme with the edited colours.
  useEffect(() => {
    setTheme('custom');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyCustomThemeVars(bg, accent);
  }, [bg, accent]);

  const cancel = () => {
    applyCustomThemeVars(savedBg, savedAccent);
    setTheme(savedBg && savedAccent ? previousThemeRef.current : 'bullshark');
    onClose();
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveCustomTheme(bg, accent);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      await clearCustomTheme();
      applyCustomThemeVars(null, null);
      setTheme('bullshark');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          {t('themeCustomBg')}
          <input
            type="color"
            value={bg}
            onChange={(e) => setBg(e.target.value)}
            className="h-8 w-12 cursor-pointer rounded border border-border bg-transparent"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          {t('themeCustomAccent')}
          <input
            type="color"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            className="h-8 w-12 cursor-pointer rounded border border-border bg-transparent"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={saving}>
          {t('themeCustomSave')}
        </Button>
        <Button size="sm" variant="outline" onClick={cancel} disabled={saving}>
          {t('themeCustomCancel')}
        </Button>
        {savedBg && savedAccent && (
          <Button
            size="sm"
            variant="destructive"
            onClick={reset}
            disabled={saving}
          >
            {t('themeCustomReset')}
          </Button>
        )}
      </div>
    </div>
  );
});

export { CustomThemeEditor };
