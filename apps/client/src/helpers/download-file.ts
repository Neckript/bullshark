import type { TFile } from '@bullshark/shared';
import { getFileUrl } from './get-file-url';

const downloadFile = async (file: TFile) => {
  const fileUrl = getFileUrl(file);

  if (!fileUrl) {
    console.error('Failed to get file URL.');
    return;
  }

  const response = await fetch(fileUrl);

  if (!response.ok) {
    console.error(`Failed to download file: ${response.statusText}`);
    return;
  }

  const link = document.createElement('a');

  link.href = URL.createObjectURL(await response.blob());
  link.download = file.originalName;

  link.click();
};

export { downloadFile };
