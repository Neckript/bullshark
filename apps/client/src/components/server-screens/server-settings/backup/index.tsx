import { downloadBackup, uploadBackup } from '@/helpers/backup';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Group
} from '@sharkord/ui';
import { memo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

const Backup = memo(() => {
  const { t } = useTranslation('settings');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const onExport = async () => {
    setExporting(true);
    try {
      await downloadBackup();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setExporting(false);
    }
  };

  const onPickFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) setPendingFile(file);
  };

  const onConfirmImport = async () => {
    if (!pendingFile) return;
    setImporting(true);
    try {
      await uploadBackup(pendingFile);
      toast.success(t('backupImportStarted'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setImporting(false);
      setPendingFile(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('backupTitle')}</CardTitle>
        <CardDescription>{t('backupDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-destructive">{t('backupSecurityWarning')}</p>

        <Group label={t('backupExportLabel')} description={t('backupExportDesc')}>
          <Button onClick={onExport} disabled={exporting}>
            {exporting ? t('backupExporting') : t('backupExportButton')}
          </Button>
        </Group>

        <Group label={t('backupImportLabel')} description={t('backupImportDesc')}>
          <Button
            variant="destructive"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
          >
            {importing ? t('backupImporting') : t('backupImportButton')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={onPickFile}
          />
        </Group>
      </CardContent>

      <AlertDialog
        open={!!pendingFile}
        onOpenChange={(open) => !open && setPendingFile(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('backupImportConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('backupImportConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmImport} disabled={importing}>
              {t('backupImportConfirmAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
});

export { Backup };
