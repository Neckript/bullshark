import { useEffect, useRef, useState, type RefObject } from 'react';

type TUseFileDragOptions = {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
};

// Un glisser de texte ou d'un message interne ne doit rien allumer.
const carriesFiles = (event: DragEvent) =>
  Array.from(event.dataTransfer?.types ?? []).includes('Files');

const useFileDrag = (
  targetRef: RefObject<HTMLElement | null>,
  { onFiles, disabled = false }: TUseFileDragOptions
) => {
  const [isDragging, setIsDragging] = useState(false);
  const depthRef = useRef(0);
  const onFilesRef = useRef(onFiles);

  onFilesRef.current = onFiles;

  useEffect(() => {
    const target = targetRef.current;

    if (!target || disabled) return;

    const reset = () => {
      depthRef.current = 0;
      setIsDragging(false);
    };

    // dragenter/dragleave se déclenchent aussi en passant d'un enfant à
    // l'autre : sans compteur, l'incrustation clignote au milieu du salon.
    const handleDragEnter = (event: DragEvent) => {
      if (!carriesFiles(event)) return;

      depthRef.current += 1;
      setIsDragging(true);
    };

    const handleDragLeave = (event: DragEvent) => {
      if (!carriesFiles(event)) return;

      depthRef.current -= 1;

      if (depthRef.current <= 0) {
        reset();
      }
    };

    // Sans preventDefault sur dragover, le navigateur ouvre le fichier.
    const handleDragOver = (event: DragEvent) => {
      if (!carriesFiles(event)) return;

      event.preventDefault();

      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDrop = (event: DragEvent) => {
      reset();

      if (!carriesFiles(event)) return;

      event.preventDefault();

      const items = Array.from(event.dataTransfer?.items ?? []);
      const fromItems = items
        .filter((item) => item.kind === 'file')
        .map((item) => item.getAsFile())
        .filter((file): file is File => !!file);

      const files = fromItems.length
        ? fromItems
        : Array.from(event.dataTransfer?.files ?? []);

      if (files.length) {
        onFilesRef.current(files);
      }
    };

    target.addEventListener('dragenter', handleDragEnter);
    target.addEventListener('dragleave', handleDragLeave);
    target.addEventListener('dragover', handleDragOver);
    target.addEventListener('drop', handleDrop);

    // Un glisser relâché hors de la fenêtre n'émet pas de dragleave
    // exploitable : sans ce filet, l'incrustation reste collée à l'écran.
    window.addEventListener('dragend', reset);
    window.addEventListener('drop', reset);

    return () => {
      target.removeEventListener('dragenter', handleDragEnter);
      target.removeEventListener('dragleave', handleDragLeave);
      target.removeEventListener('dragover', handleDragOver);
      target.removeEventListener('drop', handleDrop);
      window.removeEventListener('dragend', reset);
      window.removeEventListener('drop', reset);
    };
  }, [targetRef, disabled]);

  return isDragging;
};

export { useFileDrag };
