import { useEffect, useRef, type RefObject } from "react";

type Options = { mode: "day" | "week"; disabled: boolean; onNavigate: (direction: -1 | 1) => void };
type Gesture = {
  id: number; x: number; y: number; time: number; header: boolean;
  scrollLeft: number; scrollMax: number; axis: "pending" | "vertical" | "horizontal" | "scroll";
};

// Native non-passive touch listeners let horizontal navigation take ownership
// only after direction is clear. Vertical scrolling and pinch zoom stay native.
export function useCalendarSwipe(surface: RefObject<HTMLElement>, scroller: RefObject<HTMLElement>, { mode, disabled, onNavigate }: Options) {
  const suppressClickUntil = useRef(0);
  useEffect(() => {
    const node = surface.current;
    if (!node || disabled) return;
    let gesture: Gesture | null = null;
    const start = (event: TouchEvent) => {
      suppressClickUntil.current = 0;
      gesture = null;
      if (event.touches.length !== 1 || !(event.target instanceof Element)) return;
      const target = event.target, button = target.closest("button");
      if (target.closest('input,select,textarea,a,[contenteditable="true"]')) return;
      const header = !!target.closest("[data-calendar-swipe-navigation]");
      if (!header && !target.closest("[data-calendar-swipe-grid]")) return;
      if (button && !button.hasAttribute("data-calendar-swipe-navigation") && !button.hasAttribute("data-calendar-event")) return;
      const touch = event.touches[0], scroll = scroller.current;
      // Leave screen-edge gestures to the browser/OS.
      if (touch.clientX < 24 || touch.clientX > window.innerWidth - 24) return;
      gesture = { id: touch.identifier, x: touch.clientX, y: touch.clientY, time: performance.now(), header,
        scrollLeft: scroll?.scrollLeft ?? 0, scrollMax: Math.max(0, (scroll?.scrollWidth ?? 0) - (scroll?.clientWidth ?? 0)), axis: "pending" };
    };
    const move = (event: TouchEvent) => {
      if (!gesture) return;
      if (event.touches.length !== 1) { gesture = null; return; }
      const touch = Array.from(event.touches).find(item => item.identifier === gesture!.id);
      if (!touch) { gesture = null; return; }
      const dx = touch.clientX - gesture.x, dy = touch.clientY - gesture.y;
      if (gesture.axis === "pending") {
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx) * 1.2) gesture.axis = "vertical";
        else if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.35) {
          const atEdge = dx > 0 ? gesture.scrollLeft <= 1 : gesture.scrollLeft >= gesture.scrollMax - 1;
          gesture.axis = mode === "day" || gesture.header || atEdge ? "horizontal" : "scroll";
        }
      }
      if (gesture.axis === "horizontal" && event.cancelable) event.preventDefault();
    };
    const end = (event: TouchEvent) => {
      const completed = gesture; gesture = null;
      if (!completed || event.touches.length || completed.axis !== "horizontal") return;
      const touch = Array.from(event.changedTouches).find(item => item.identifier === completed.id);
      if (!touch) return;
      if (event.cancelable) event.preventDefault();
      // A drag beginning on an appointment/header must not also activate it.
      suppressClickUntil.current = performance.now() + 500;
      const dx = touch.clientX - completed.x, dy = touch.clientY - completed.y;
      if (performance.now() - completed.time <= 1200 && Math.abs(dx) >= 64 && Math.abs(dx) > Math.abs(dy) * 1.5) onNavigate(dx < 0 ? 1 : -1);
    };
    const cancel = () => { gesture = null; };
    const click = (event: MouseEvent) => {
      if (event.detail === 0 || performance.now() >= suppressClickUntil.current) return;
      if (typeof PointerEvent !== "undefined" && event instanceof PointerEvent && event.pointerType !== "touch") return;
      suppressClickUntil.current = 0; event.preventDefault(); event.stopPropagation();
    };
    node.addEventListener("touchstart", start, { passive: true });
    node.addEventListener("touchmove", move, { passive: false });
    node.addEventListener("touchend", end, { passive: false });
    node.addEventListener("touchcancel", cancel, { passive: true });
    node.addEventListener("click", click, true);
    return () => {
      node.removeEventListener("touchstart", start); node.removeEventListener("touchmove", move);
      node.removeEventListener("touchend", end); node.removeEventListener("touchcancel", cancel);
      node.removeEventListener("click", click, true);
    };
  }, [surface, scroller, mode, disabled, onNavigate]);
}
