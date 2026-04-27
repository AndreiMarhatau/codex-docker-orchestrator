import { useEffect, useRef, useState } from 'react';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';

const HIDE_DELAY_MS = 3000;
const SCROLL_EDGE_THRESHOLD = 8;

function getWindowScroller() {
  if (typeof document === 'undefined') {
    return null;
  }
  return document.scrollingElement || document.documentElement;
}

function getScrollTarget(eventTarget) {
  if (eventTarget === document || eventTarget === window) {
    return getWindowScroller();
  }
  return eventTarget;
}

function getScrollMetrics(target) {
  if (!target) {
    return null;
  }
  if (target === getWindowScroller()) {
    const scrollTop = window.scrollY || target.scrollTop || 0;
    const scrollHeight = target.scrollHeight || document.body.scrollHeight;
    const clientHeight = window.innerHeight || target.clientHeight;
    return { clientHeight, maxScrollTop: Math.max(0, scrollHeight - clientHeight), scrollTop };
  }
  return {
    clientHeight: target.clientHeight,
    maxScrollTop: Math.max(0, target.scrollHeight - target.clientHeight),
    scrollTop: target.scrollTop
  };
}

function canScrollInDirection(metrics, direction) {
  if (!metrics || metrics.maxScrollTop <= SCROLL_EDGE_THRESHOLD) {
    return false;
  }
  if (direction === 'up') {
    return metrics.scrollTop > SCROLL_EDGE_THRESHOLD;
  }
  return metrics.scrollTop < metrics.maxScrollTop - SCROLL_EDGE_THRESHOLD;
}

function FloatingScrollButton() {
  const [scrollState, setScrollState] = useState({
    direction: '',
    rendered: false,
    visible: false
  });
  const hideTimerRef = useRef(null);
  const lastPositionsRef = useRef(new WeakMap());
  const targetRef = useRef(null);

  useEffect(() => {
    function clearHideTimer() {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    }

    function scheduleHide() {
      clearHideTimer();
      hideTimerRef.current = window.setTimeout(() => {
        setScrollState((current) => ({ ...current, visible: false }));
      }, HIDE_DELAY_MS);
    }

    function handleScroll(event) {
      const target = getScrollTarget(event.target);
      const metrics = getScrollMetrics(target);
      if (!target || !metrics || metrics.maxScrollTop <= SCROLL_EDGE_THRESHOLD) {
        return;
      }

      const lastPositions = lastPositionsRef.current;
      const previousTop = lastPositions.has(target)
        ? lastPositions.get(target)
        : metrics.scrollTop;
      lastPositions.set(target, metrics.scrollTop);

      const delta = metrics.scrollTop - previousTop;
      if (delta === 0) {
        return;
      }

      const direction = delta < 0 ? 'up' : 'down';
      if (!canScrollInDirection(metrics, direction)) {
        setScrollState((current) => ({ ...current, visible: false }));
        return;
      }

      targetRef.current = target;
      setScrollState({ direction, rendered: true, visible: true });
      scheduleHide();
    }

    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener('scroll', handleScroll, { capture: true });
      clearHideTimer();
    };
  }, []);

  function handleJump() {
    const target = targetRef.current || getWindowScroller();
    const metrics = getScrollMetrics(target);
    if (!target || !metrics) {
      return;
    }
    const top = scrollState.direction === 'up' ? 0 : metrics.maxScrollTop;
    target.scrollTo({ behavior: 'smooth', top });
  }

  if (!scrollState.rendered) {
    return null;
  }

  const label = scrollState.direction === 'up' ? 'Scroll to top' : 'Scroll to bottom';

  return (
    <button
      type="button"
      className={`floating-scroll-button${scrollState.visible ? ' is-visible' : ''}`}
      onClick={handleJump}
      onTransitionEnd={() => {
        if (!scrollState.visible) {
          setScrollState((current) => ({ ...current, rendered: false }));
        }
      }}
      aria-label={label}
      tabIndex={scrollState.visible ? 0 : -1}
    >
      {scrollState.direction === 'up'
        ? <KeyboardArrowUpRoundedIcon fontSize="small" />
        : <KeyboardArrowDownRoundedIcon fontSize="small" />}
    </button>
  );
}

export default FloatingScrollButton;
