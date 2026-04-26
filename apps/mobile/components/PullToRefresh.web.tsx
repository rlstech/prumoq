import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

const THRESHOLD = 150;
const MAX_PULL = 120;

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const pullingRef = useRef(false);
  const pullYRef = useRef(0);

  useEffect(() => {
    function getScrollTop(): number {
      const divs = document.querySelectorAll('div');
      for (const el of divs) {
        if ((el as HTMLElement).scrollTop > 4) return (el as HTMLElement).scrollTop;
      }
      return window.scrollY;
    }

    function onTouchStart(e: TouchEvent) {
      const active = document.activeElement;
      const isFormInput = active instanceof HTMLInputElement
        || active instanceof HTMLTextAreaElement
        || active instanceof HTMLSelectElement;
      if (isFormInput) return;
      if (getScrollTop() > 4) return;
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = false;
    }

    function onTouchMove(e: TouchEvent) {
      if (startYRef.current === null) return;
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta <= 0) {
        startYRef.current = null;
        return;
      }
      pullingRef.current = true;
      const clamped = Math.min(delta * 0.5, MAX_PULL);
      pullYRef.current = clamped;
      setPullY(clamped);
    }

    function onTouchEnd() {
      if (!pullingRef.current) {
        startYRef.current = null;
        return;
      }
      const captured = pullYRef.current;
      startYRef.current = null;
      pullingRef.current = false;
      pullYRef.current = 0;
      if (captured >= THRESHOLD / 2) {
        setRefreshing(true);
        setTimeout(() => router.replace(window.location.pathname as any), 400);
      } else {
        setPullY(0);
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd);
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  const progress = Math.min(pullY / (THRESHOLD / 2), 1);
  const showing = pullY > 2 || refreshing;
  const indicatorTop = refreshing ? 12 : pullY - 40;
  const contentShift = refreshing ? 8 : pullY * 0.3;

  return (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      {showing && (
        <View
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
              backgroundColor: '#E84A1A',
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
