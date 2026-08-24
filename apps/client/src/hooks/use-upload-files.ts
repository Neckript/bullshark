import { usePublicServerSettings } from '@/features/server/hooks';
import { uploadFile, type TUploadProgress } from '@/helpers/upload-file';
import { useUploadPermission } from '@/hooks/use-upload-permission';
import { isPreviewable, type TTempFile } from '@sharkord/shared';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject
} from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type TDisplayItem = {
  id: string;
  name: string;
  size: number;
  extension: string;
  previewUrl?: string;
  progress?: number;
  file?: TTempFile;
};

const useUploadFiles = (
  channelId: number,
  containerRef: RefObject<HTMLElement | null>,
  disabled: boolean = false
) => {
  const [files, setFiles] = useState<TTempFile[]>([]);
  const filesRef = useRef<TTempFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadingSize, setUploadingSize] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const loadedPerFileRef = useRef<Record<string, number>>({});
  const totalLoadedRef = useRef(0);
  const speedSampleRef = useRef<{ time: number; loaded: number }>({
    time: 0,
    loaded: 0
  });
  const [pendingUploads, setPendingUploads] = useState<TDisplayItem[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const previewUrlsRef = useRef<Record<string, string>>({});
  const [displayOrder, setDisplayOrder] = useState<string[]>([]);
  const pendingToFileRef = useRef<Record<string, string>>({});
  const settings = usePublicServerSettings();
  const { t } = useTranslation();
  const uploadPermission = useUploadPermission(channelId, disabled);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // hackers gonna hack
  filesRef.current = files;
  previewUrlsRef.current = previewUrls;

  const takeAllowedFiles = useCallback(
    (filesToUpload: File[]) => {
      const maxFilesPerMessage =
        settings?.storageMaxFilesPerMessage ?? Number.MAX_SAFE_INTEGER;
      const remainingSlots = maxFilesPerMessage - filesRef.current.length;

      if (remainingSlots <= 0) {
        toast.warning(
          t('uploadMaxFilesReached', { count: maxFilesPerMessage })
        );
        return [];
      }

      if (filesToUpload.length > remainingSlots) {
        const discardedCount = filesToUpload.length - remainingSlots;

        toast.warning(t('uploadFileIgnored', { count: discardedCount }));
      }

      return filesToUpload.slice(0, remainingSlots);
    },
    [settings?.storageMaxFilesPerMessage, t]
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prevFiles) => prevFiles.filter((file) => file.id !== id));
    setDisplayOrder((prev) => prev.filter((orderId) => orderId !== id));

    const url = previewUrlsRef.current[id];

    if (url) {
      URL.revokeObjectURL(url);

      setPreviewUrls((prev) => {
        const next = { ...prev };

        delete next[id];

        return next;
      });
    }
  }, []);

  const clearFiles = useCallback(() => {
    for (const url of Object.values(previewUrlsRef.current)) {
      URL.revokeObjectURL(url);
    }

    setFiles([]);
    setPendingUploads([]);
    setPreviewUrls({});
    setDisplayOrder([]);
    setUploading(false);
    setUploadingSize(0);
    setUploadSpeed(0);
    loadedPerFileRef.current = {};
    totalLoadedRef.current = 0;
    pendingToFileRef.current = {};
  }, []);

  const checkUploadPermissions = useCallback(() => {
    if (uploadPermission.allowed) return true;

    switch (uploadPermission.reason) {
      case 'uploadsDisabled':
        toast.warning(t('uploadsDisabled'));
        break;
      case 'dmSharingDisabled':
        toast.warning(t('dmSharingDisabled'));
        break;
      case 'noUploadPermission':
        toast.error(t('noUploadPermission'));
        break;
    }

    return false;
  }, [uploadPermission, t]);

  const openFileDialog = useCallback(() => {
    if (!checkUploadPermissions()) return;

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }, [checkUploadPermissions]);

  const processFiles = useCallback(
    async (filesToUpload: File[]) => {
      const allowed = takeAllowedFiles(filesToUpload);

      if (!allowed.length) return;

      const maxFileSize =
        settings?.storageUploadMaxFileSize ?? Number.MAX_SAFE_INTEGER;
      const withinLimit: File[] = [];

      for (const file of allowed) {
        if (file.size > maxFileSize) {
          toast.error(t('uploadFileTooLarge', { name: file.name }));
        } else {
          withinLimit.push(file);
        }
      }

      if (!withinLimit.length) return;

      setUploading(true);
      setUploadSpeed(0);

      speedSampleRef.current = { time: Date.now(), loaded: 0 };
      loadedPerFileRef.current = {};
      totalLoadedRef.current = 0;

      const total = withinLimit.reduce((acc, file) => acc + file.size, 0);

      setUploadingSize((size) => size + total);

      // create pending entries with preview URLs for each file
      const pendingEntries: TDisplayItem[] = withinLimit.map((file, i) => {
        const parts = file.name.split('.');
        const ext = parts.length > 1 ? `.${parts.pop()}` : '';

        return {
          id: `pending-${Date.now()}-${i}`,
          name: file.name,
          size: file.size,
          extension: ext,
          previewUrl: isPreviewable(file)
            ? URL.createObjectURL(file)
            : undefined,
          progress: 0
        };
      });

      setPendingUploads((prev) => [...prev, ...pendingEntries]);
      setDisplayOrder((prev) => [...prev, ...pendingEntries.map((p) => p.id)]);

      // upload all files in parallel
      const uploadPromises = withinLimit.map(async (file, i) => {
        const pendingId = pendingEntries[i].id;

        const onProgress = (progress: TUploadProgress) => {
          setPendingUploads((prev) =>
            prev.map((p) =>
              p.id === pendingId ? { ...p, progress: progress.percent } : p
            )
          );

          const prevLoaded = loadedPerFileRef.current[pendingId] ?? 0;

          loadedPerFileRef.current[pendingId] = progress.loaded;
          totalLoadedRef.current += progress.loaded - prevLoaded;

          const now = Date.now();
          const sample = speedSampleRef.current;
          const elapsed = now - sample.time;

          if (elapsed >= 500) {
            const bytesPerSec =
              ((totalLoadedRef.current - sample.loaded) / elapsed) * 1000;

            setUploadSpeed(bytesPerSec);

            speedSampleRef.current = {
              time: now,
              loaded: totalLoadedRef.current
            };
          }
        };

        const result = await uploadFile(file, { onProgress });

        // remove this pending entry and immediately add completed file
        setPendingUploads((prev) => prev.filter((p) => p.id !== pendingId));

        if (!result) {
          const previewUrl = pendingEntries[i].previewUrl;

          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
          }

          // remove from display order on failure
          setDisplayOrder((prev) => prev.filter((id) => id !== pendingId));

          return;
        }

        // transfer preview URL to the completed file
        const previewUrl = pendingEntries[i].previewUrl;

        if (previewUrl) {
          setPreviewUrls((prev) => ({ ...prev, [result.id]: previewUrl }));
        }

        // swap pendingId with real fileId in display order
        pendingToFileRef.current[pendingId] = result.id;

        setDisplayOrder((prev) =>
          prev.map((id) => (id === pendingId ? result.id : id))
        );

        // add to files immediately so it appears right away
        setFiles((prev) => [...prev, result]);
      });

      await Promise.all(uploadPromises);

      setUploading(false);
      setUploadingSize((size) => size - total);
      setUploadSpeed(0);
      loadedPerFileRef.current = {};
      totalLoadedRef.current = 0;
    },
    [takeAllowedFiles, settings?.storageUploadMaxFileSize, t]
  );

  const onFileDialogChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const list = event.currentTarget.files;

      if (!list || list.length === 0) return;

      await processFiles(Array.from(list));
    },
    [processFiles]
  );

  useEffect(() => {
    const container = containerRef.current;

    if (!container || !settings?.storageUploadEnabled || disabled) return;

    const handlePaste = async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items ?? [];
      const hasFiles = Array.from(items).some((item) => item.kind === 'file');

      if (hasFiles && !checkUploadPermissions()) return;

      const filesToUpload: File[] = [];

      for (let i = 0; i < items.length; i++) {
        if (items[i].kind !== 'file') continue;

        const pastedFile = items[i].getAsFile();

        if (!pastedFile) continue;

        filesToUpload.push(pastedFile);
      }

      await processFiles(filesToUpload);
    };

    container.addEventListener('paste', handlePaste);

    return () => {
      container.removeEventListener('paste', handlePaste);
    };
  }, [
    checkUploadPermissions,
    settings?.storageUploadEnabled,
    disabled,
    containerRef,
    processFiles
  ]);

  const fileInputProps = useMemo(
    () => ({
      ref: fileInputRef,
      type: 'file' as const,
      multiple: true,
      onChange: onFileDialogChange,
      style: { display: 'none' }
    }),
    [onFileDialogChange]
  );

  const pendingMap = useMemo(() => {
    const map = new Map<string, TDisplayItem>();

    for (const p of pendingUploads) {
      map.set(p.id, p);
    }

    return map;
  }, [pendingUploads]);

  const filesMap = useMemo(() => {
    const map = new Map<string, TTempFile>();

    for (const f of files) {
      map.set(f.id, f);
    }

    return map;
  }, [files]);

  const displayItems: TDisplayItem[] = useMemo(() => {
    const items: TDisplayItem[] = [];

    for (const id of displayOrder) {
      const file = filesMap.get(id);

      if (file) {
        items.push({
          id: file.id,
          name: file.originalName,
          size: file.size,
          extension: file.extension,
          previewUrl: previewUrls[id],
          file
        });

        continue;
      }

      const pending = pendingMap.get(id);

      if (pending) {
        items.push(pending);
      }
    }

    return items;
  }, [displayOrder, filesMap, pendingMap, previewUrls]);

  return useMemo(
    () => ({
      files,
      displayItems,
      removeFile,
      clearFiles,
      uploading,
      uploadingSize,
      uploadSpeed,
      openFileDialog,
      fileInputProps,
      processFiles,
      checkUploadPermissions
    }),
    [
      files,
      displayItems,
      removeFile,
      clearFiles,
      uploading,
      uploadingSize,
      uploadSpeed,
      openFileDialog,
      fileInputProps,
      processFiles,
      checkUploadPermissions
    ]
  );
};

export { useUploadFiles, type TDisplayItem };
