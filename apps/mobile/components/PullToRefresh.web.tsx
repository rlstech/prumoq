import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  calculatePullDistance,
  PULL_TRIGGER_DISTANCE,
  shouldTriggerRefresh,
} from '../lib/pull-to-refresh';
import { Colors } from '../lib/constants';

const MIN_REFRESH_INDICATOR_MS = 350;
const MAX_REFRESH_DURATION_MS = 5000;

interface PullToRefreshProps {
  children: React.ReactNode;
  enabled: boolean;
  onRefresh: () => void | Promise<void>;
}

function getTouchedScrollTop(target: EventTarget | null): number {
  let element = target instanceof Element ? target : null;

  while (element && element !== document.documentElement) {
    if (element instanceof HTMLElement) {
      const { overflowY } = window.getComputedStyle(element);
      const scrollable = /(auto|scroll)/.test(overflowY)
        && element.scrollHeight > element.clientHeight + 1;
      if (scrollable) return element.scrollTop;
    }
    element = element.parentElement;
  }

  return document.scrollingElement?.scrollTop ?? window.scrollY;
}

function isFormTarget(target: EventTarget | null): boolean {
  return target instanceof Element
    && target.closest('input, textarea, select, [contenteditable="true"]') !== null;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, milliseconds));
}

export function PullToRefresh({
  children,
  enabled,
  onRefresh,
}: PullToRefreshProps) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const pullingRef = useRef(false);
  const pullYRef = useRef(0);
  const refreshingRef = useRef(false);
  const refreshIdRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      refreshIdRef.current += 1;
      startYRef.current = null;
      pullingRef.current = false;
      pullYRef.current = 0;
      refreshingRef.current = false;
      setPullY(0);
      setRefreshing(false);
      return;
    }

    function resetGesture() {
      startYRef.current = null;
      pullingRef.current = false;
      pullYRef.current = 0;
      setPullY(0);
    }

    function cancelCurrentInteraction() {
      refreshIdRef.current += 1;
      refreshingRef.current = false;
      setRefreshing(false);
      resetGesture();
    }

    async function startRefresh() {
      if (refreshingRef.current) return;

      const refreshId = ++refreshIdRef.current;
      refreshingRef.current = true;
      setPullY(0);
      setRefreshing(true);

      try {
        const refreshOperation = Promise.resolve().then(onRefresh);
        await Promise.allSettled([
          Promise.race([refreshOperation, wait(MAX_REFRESH_DURATION_MS)]),
          wait(MIN_REFRESH_INDICATOR_MS),
        ]);
      } finally {
        if (refreshIdRef.current === refreshId) {
          refreshingRef.current = false;
          setRefreshing(false);
          setPullY(0);
        }
      }
    }

    function onTouchStart(event: TouchEvent) {
      if (refreshingRef.current || event.touches.length !== 1) return;
      if (isFormTarget(event.target)) return;
      if (getTouchedScrollTop(event.target) > 4) return;

      startYRef.current = event.touches[0].clientY;
      pullingRef.current = false;
      pullYRef.current = 0;
    }

    function onTouchMove(event: TouchEvent) {
      if (startYRef.current === null || event.touches.length !== 1) return;

      const delta = event.touches[0].clientY - startYRef.current;
      const distance = calculatePullDistance(delta);
      if (distance <= 0) {
        resetGesture();
        return;
      }

      pullingRef.current = true;
      pullYRef.current = distance;
      setPullY(distance);
    }

    function onTouchEnd() {
      if (!pullingRef.current) {
        resetGesture();
        return;
      }

      const capturedDistance = pullYRef.current;
      resetGesture();
      if (shouldTriggerRefresh(capturedDistance)) {
        void startRefresh();
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') cancelCurrentInteraction();
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('touchcancel', cancelCurrentInteraction);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      refreshIdRef.current += 1;
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', cancelCurrentInteraction);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [enabled, onRefresh]);

  const progress = Math.min(pullY / PULL_TRIGGER_DISTANCE, 1);
  const showing = enabled && (pullY > 2 || refreshing);
  const indicatorTop = refreshing ? 12 : pullY - 40;
  const contentShift = refreshing ? 8 : pullY * 0.3;

  return (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      {showing && (
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={refreshing ? 'Atualizando conteúdo' : 'Puxe para atualizar'}
          style={{
            position: 'absolute',
            top: indicatorTop,
            left: 0,
            right: 0,
            zIndex: 9999,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: Colors.brand,
              alignItems: 'center',
              justifyContent: 'center',
              // @ts-ignore web-only shadow
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              opacity: refreshing ? 1 : progress,
              transform: [{ scale: refreshing ? 1 : 0.6 + progress * 0.4 }],
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                animation: refreshing ? 'prumoq-spin 0.7s linear infinite' : 'none',
                transform: refreshing ? undefined : `rotate(${progress * 270}deg)`,
              }}
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              <style>{`@keyframes prumoq-spin { to { transform: rotate(360deg); } }`}</style>
            </svg>
          </View>
        </View>
      )}
      <View
        style={{
          flex: 1,
          transform: [{ translateY: contentShift }],
        }}
      >
        {children}
      </View>
    </View>
  );
}
