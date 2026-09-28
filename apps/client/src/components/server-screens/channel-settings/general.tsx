import { closeServerScreens } from '@/features/server-screens/actions';
import { useAdminChannelGeneral } from '@/features/server/admin/hooks';
import { ChannelType } from '@bullshark/shared';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Group,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea
} from '@bullshark/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

type TGeneralProps = {
  channelId: number;
};

// Compact labels avoid needing a translated unit for every preset.
const SLOW_MODE_OPTIONS: { seconds: number; label: string }[] = [
  { seconds: 0, label: 'off' },
  { seconds: 5, label: '5s' },
  { seconds: 10, label: '10s' },
  { seconds: 30, label: '30s' },
  { seconds: 60, label: '1m' },
  { seconds: 300, label: '5m' },
  { seconds: 900, label: '15m' },
  { seconds: 3600, label: '1h' },
  { seconds: 21600, label: '6h' }
];

const General = memo(({ channelId }: TGeneralProps) => {
  const { t } = useTranslation('settings');
  const { channel, loading, onChange, submit, errors } =
    useAdminChannelGeneral(channelId);

  if (!channel) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('channelInfoTitle')}</CardTitle>
        <CardDescription>{t('channelInfoDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Group label={t('channelNameLabel')}>
          <Input
            value={channel.name}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder={t('channelNamePlaceholder')}
            error={errors.name}
          />
        </Group>

        <Group label={t('channelTopicLabel')}>
          <Textarea
            value={channel.topic ?? ''}
            onChange={(e) => onChange('topic', e.target.value || null)}
            placeholder={t('channelTopicPlaceholder')}
          />
        </Group>

        <Group label={t('privateLabel')} description={t('privateDesc')}>
          <Switch
            checked={channel.private}
            onCheckedChange={(value) => onChange('private', value)}
          />
        </Group>

        {channel.type === ChannelType.TEXT && (
          <Group label={t('slowModeLabel')} description={t('slowModeDesc')}>
            <Select
              value={String(channel.slowModeSeconds ?? 0)}
              onValueChange={(value) =>
                onChange('slowModeSeconds', Number(value))
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SLOW_MODE_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.seconds}
                    value={String(option.seconds)}
                  >
                    {option.label === 'off' ? t('slowModeOff') : option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Group>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={closeServerScreens}>
            {t('cancel')}
          </Button>
          <Button onClick={submit} disabled={loading}>
            {t('saveChanges')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

export { General };
