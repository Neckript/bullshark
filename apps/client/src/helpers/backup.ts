import { getUrlFromServer } from './get-file-url';
import { getSessionStorageItem, SessionStorageKey } from './storage';

const BACKUP_TOKEN_HEADER = 'x-backup-token';

const getToken = () => getSessionStorageItem(SessionStorageKey.TOKEN) ?? '';

// Fetch the backup zip with auth and trigger a browser download.
const downloadBackup = async (): Promise<void> => {
  const url = getUrlFromServer();
  const res = await fetch(`${url}/export`, {
    headers: { [BACKUP_TOKEN_HEADER]: getToken() }
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Export failed (${res.status})`);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? 'bullshark-backup.zip';

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
};

// Upload a backup zip. On success the server stages the restore and restarts.
const uploadBackup = async (file: File): Promise<void> => {
  const url = getUrlFromServer();
  const res = await fetch(`${url}/import`, {
    method: 'POST',
    headers: {
      [BACKUP_TOKEN_HEADER]: getToken(),
      'Content-Type': 'application/zip'
    },
    body: file
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Import failed (${res.status})`);
  }
};

export { downloadBackup, uploadBackup };
