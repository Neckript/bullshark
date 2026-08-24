import { useEffect, useRef, useState, type RefCallback } from 'react';

type TUseFileDragOptions = {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
};

type TUseFileDragResult = {
  dropTargetRef: RefCallback<HTMLElement>;
  isDragging: boolean;
};

// Un glisser de texte ou d'un message interne ne doit rien allumer.
const carriesFiles = (event: DragEvent) =>
  Array.from(event.dataTransfer?.types ?? []).includes('Files');

const useFileDrag = ({
  onFiles,
  disabled = false
}: TUseFileDragOptions): TUseFileDragResult => {
  // Un simple useRef ne re-déclenche jamais l'effet quand l'élément
  // apparaît après le premier rendu (ex : squelette de chargement) : un
  // callback ref adossé à du state fait de l'élément une dépendance réelle.
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const depthRef = useRef(0);
  const onFilesRef = useRef(onFiles);

  onFilesRef.current = onFiles;

  useEffect(() => {
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
      reset();
    };
  }, [target, disabled]);

  return { dropTargetRef: setTarget, isDragging };
};

export { useFileDrag };
