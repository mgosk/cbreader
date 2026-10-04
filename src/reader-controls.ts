import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type MouseEvent,
} from "react";

export function useTabletLayout() {
  const query =
    "(pointer: coarse) and (min-width: 600px) and (min-height: 500px)";
  const [tablet, setTablet] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const changed = () => setTablet(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  return tablet;
}

export function useFullscreen() {
  const panel = useRef<HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const changed = () =>
      setFullscreen(document.fullscreenElement === panel.current);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  useEffect(() => {
    if (!fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function key(event: KeyboardEvent) {
      if (event.key === "Escape" && !document.fullscreenElement)
        setFullscreen(false);
      // Keep keyboard focus inside the reading surface in the viewport fallback.
      if (event.key === "Tab") {
        const controls = panel.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), select, input, [tabindex="0"]',
        );
        if (!controls?.length) return;
        const first = controls[0],
          last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", key);
    };
  }, [fullscreen]);
  async function toggle() {
    if (pending || !panel.current) return;
    setPending(true);
    try {
      if (fullscreen) {
        if (document.fullscreenElement === panel.current)
          await document.exitFullscreen();
        setFullscreen(false);
      } else {
        try {
          if (!document.fullscreenEnabled || !panel.current.requestFullscreen)
            throw new Error("Unavailable");
          await panel.current.requestFullscreen();
        } catch {
          // A viewport-sized reading mode still works when the browser denies fullscreen.
        }
        setFullscreen(true);
      }
    } finally {
      setPending(false);
    }
  }
  return { panel, fullscreen, pending, toggle };
}

export function usePageSwipe(
  enabled: boolean,
  turn: (direction: number) => void,
  page: number,
  pageCount: number,
) {
  const [motion, setMotion] = useState({
    offset: 0,
    width: 0,
    settling: false,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const contacts = useRef(new Set<number>());
  const start = useRef<{
    id: number;
    x: number;
    y: number;
    lastX: number;
    lastTime: number;
    velocity: number;
    axis: "pending" | "horizontal" | "vertical";
  } | null>(null);
  const suppressClickUntil = useRef(0);
  const busy = useRef(false);
  const pendingTurn = useRef(false);
  const turnRef = useRef(turn);
  turnRef.current = turn;
  function reset() {
    clearTimeout(timer.current);
    start.current = null;
    busy.current = false;
    pendingTurn.current = false;
    setMotion((m) => ({ ...m, offset: 0, settling: false }));
  }
  useLayoutEffect(reset, [page, enabled]);
  useEffect(() => () => clearTimeout(timer.current), []);
  function settle(offset: number, direction = 0) {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    busy.current = true;
    pendingTurn.current = direction !== 0;
    setMotion((m) => ({ ...m, offset: reduced ? 0 : offset, settling: true }));
    timer.current = setTimeout(
      () => {
        busy.current = false;
        if (direction) turnRef.current(direction);
        else setMotion((m) => ({ ...m, offset: 0, settling: false }));
      },
      reduced ? 0 : 180,
    );
  }
  return {
    motion,
    handlers: {
      onPointerDown(event: PointerEvent<HTMLDivElement>) {
        if (event.pointerType !== "touch") return;
        contacts.current.add(event.pointerId);
        if (contacts.current.size !== 1) {
          reset();
          suppressClickUntil.current = performance.now() + 500;
          return;
        }
        if (busy.current && !pendingTurn.current) reset();
        if (
          !enabled ||
          busy.current ||
          (window.visualViewport?.scale ?? 1) > 1.01
        )
          return;
        start.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          lastX: event.clientX,
          lastTime: performance.now(),
          velocity: 0,
          axis: "pending",
        };
        setMotion({
          offset: 0,
          width: event.currentTarget.clientWidth,
          settling: false,
        });
      },
      onPointerMove(event: PointerEvent<HTMLDivElement>) {
        const origin = start.current;
        if (!origin || origin.id !== event.pointerId) return;
        const dx = event.clientX - origin.x,
          dy = event.clientY - origin.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) > 10)
          suppressClickUntil.current = performance.now() + 500;
        if (
          origin.axis === "pending" &&
          Math.max(Math.abs(dx), Math.abs(dy)) > 10
        )
          origin.axis =
            Math.abs(dx) > Math.abs(dy) * 1.2 ? "horizontal" : "vertical";
        if (origin.axis !== "horizontal") return;
        event.currentTarget.setPointerCapture(event.pointerId);
        const now = performance.now();
        origin.velocity =
          (event.clientX - origin.lastX) / Math.max(1, now - origin.lastTime);
        origin.lastX = event.clientX;
        origin.lastTime = now;
        const atEdge =
          (dx > 0 && page === 0) || (dx < 0 && page === pageCount - 1);
        const width = event.currentTarget.clientWidth;
        setMotion({
          offset: atEdge ? dx * 0.18 : Math.max(-width, Math.min(width, dx)),
          width,
          settling: false,
        });
      },
      onPointerUp(event: PointerEvent<HTMLDivElement>) {
        contacts.current.delete(event.pointerId);
        const origin = start.current;
        start.current = null;
        if (
          !origin ||
          origin.id !== event.pointerId ||
          !enabled ||
          origin.axis !== "horizontal"
        )
          return;
        const dx = event.clientX - origin.x;
        const direction = dx < 0 ? 1 : -1;
        const width = event.currentTarget.clientWidth;
        const recentFlick =
          performance.now() - origin.lastTime < 100 &&
          Math.abs(origin.velocity) > 0.5 &&
          origin.velocity * dx > 0;
        const commit =
          (Math.abs(dx) >= Math.min(120, width * 0.25) ||
            (Math.abs(dx) >= 35 && recentFlick)) &&
          page + direction >= 0 &&
          page + direction < pageCount;
        suppressClickUntil.current = performance.now() + 500;
        settle(commit ? -direction * width : 0, commit ? direction : 0);
      },
      onPointerCancel(event: PointerEvent<HTMLDivElement>) {
        contacts.current.delete(event.pointerId);
        start.current = null;
        suppressClickUntil.current = performance.now() + 500;
        if (!busy.current) settle(0);
      },
      onClickCapture(event: MouseEvent<HTMLDivElement>) {
        if (
          event.detail !== 0 &&
          performance.now() < suppressClickUntil.current
        ) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
    },
  };
}
