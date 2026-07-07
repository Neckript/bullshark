import { useCallback, useEffect, useRef } from 'react';

type TUseLongPressOpts = { delayMs?: number; moveTolerancePx?: number };

const useLongPress = (
  onLongPress: () => void,
  { delayMs = 450, moveTolerancePx = 10 }: TUseLongPressOpts = {}
) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    startRef.current = null;
  }, []);

  // cancel any pending timer on unmount (message deleted / row recycled)
  useEffect(() => clear, [clear]);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (!touch || e.touches.length > 1) return;
      clear();
      firedRef.current = false;
      startRef.current = { x: touch.clientX, y: touch.clientY };
      timerRef.current = setTimeout(() => {
        firedRef.current = true;
        onLongPress();
      }, delayMs);
    },
    [clear, delayMs, onLongPress]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (!touch || !startRef.current) return;
      const dx = Math.abs(touch.clientX - startRef.current.x);
      const dy = Math.abs(touch.clientY - startRef.current.y);
      if (dx > moveTolerancePx || dy > moveTolerancePx) clear(); // scroll → cancel
    },
    [clear, moveTolerancePx]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      // suppress the click/selection that follows a fired long-press
      if (firedRef.current) e.preventDefault();
      clear();
    },
    [clear]
  );

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    // iOS synthesizes contextmenu on long-press; we own that gesture
    if (firedRef.current) e.preventDefault();
  }, []);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel: clear,
    onContextMenu
  };
};

export { useLongPress };
