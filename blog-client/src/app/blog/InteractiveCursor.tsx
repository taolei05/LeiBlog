import { useEffect, useRef } from "react";

const interactiveSelector = [
  "a",
  "button",
  "summary",
  "[role='button']",
  ".article-card",
  ".admin-data-card",
  ".admin-metric-card",
  ".admin-status-card",
  ".data-table-card",
  ".front-category-card",
  ".site-story-card",
  ".front-action-link",
  ".mdx-read-next",
  ".media-grid-card",
  ".setup-steps__item",
].join(",");

const textSelector = ["input", "textarea", "select", "[contenteditable='true']"].join(",");
const shellSelector = ".blog-shell, .admin-shell, .setup-page";
const minimumCursorWidth = 768;

function clampPull(value: number) {
  return Math.max(-12, Math.min(12, value));
}

export function InteractiveCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    const dot = dotRef.current;
    const ring = ringRef.current;

    if (!cursor || !dot || !ring) {
      return;
    }

    const cursorElement = cursor;
    const dotElement = dot;
    const ringElement = ring;

    const hoverQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (!hoverQuery.matches || motionQuery.matches || window.innerWidth < minimumCursorWidth) {
      return;
    }

    const shell = cursorElement.closest<HTMLElement>(shellSelector);

    if (!shell) {
      return;
    }

    const shellElement = shell;

    shellElement.classList.add("interactive-shell--cursor-active");

    const trails = Array.from(
      cursorElement.querySelectorAll<HTMLElement>(".interactive-cursor__trail"),
    );
    const trailPositions = trails.map(() => ({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    }));
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let ringX = x;
    let ringY = y;
    let animationFrame = 0;
    let magneticTarget: HTMLElement | null = null;

    function setTransform(element: HTMLElement, nextX: number, nextY: number) {
      element.style.transform = `translate3d(${nextX}px, ${nextY}px, 0) translate(-50%, -50%)`;
    }

    function clearMagneticTarget() {
      if (!magneticTarget) {
        return;
      }

      magneticTarget.style.removeProperty("--cursor-pull-x");
      magneticTarget.style.removeProperty("--cursor-pull-y");
      magneticTarget = null;
    }

    function updateMagneticTarget(target: EventTarget | null) {
      const element =
        target instanceof Element ? target.closest<HTMLElement>(interactiveSelector) : null;
      const textElement =
        target instanceof Element ? target.closest<HTMLElement>(textSelector) : null;

      cursorElement.classList.toggle("is-hovering", Boolean(element));
      cursorElement.classList.toggle("is-text", Boolean(textElement));

      if (magneticTarget && magneticTarget !== element) {
        clearMagneticTarget();
      }

      if (!element || textElement) {
        return;
      }

      const rect = element.getBoundingClientRect();
      const pullX = clampPull((x - (rect.left + rect.width / 2)) * 0.08);
      const pullY = clampPull((y - (rect.top + rect.height / 2)) * 0.08);
      element.style.setProperty("--cursor-pull-x", `${pullX}px`);
      element.style.setProperty("--cursor-pull-y", `${pullY}px`);
      magneticTarget = element;
    }

    function animate() {
      ringX += (x - ringX) * 0.22;
      ringY += (y - ringY) * 0.22;
      setTransform(ringElement, ringX, ringY);

      trailPositions.forEach((position, index) => {
        position.x += (x - position.x) * (0.16 - index * 0.02);
        position.y += (y - position.y) * (0.16 - index * 0.02);
        setTransform(trails[index], position.x, position.y);
      });

      animationFrame = window.requestAnimationFrame(animate);
    }

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerType !== "mouse") {
        return;
      }

      x = event.clientX;
      y = event.clientY;
      shellElement.style.setProperty("--cursor-x", `${x}px`);
      shellElement.style.setProperty("--cursor-y", `${y}px`);
      setTransform(dotElement, x, y);
      updateMagneticTarget(event.target);
      cursorElement.classList.add("is-visible");
    }

    function handlePointerLeave() {
      cursorElement.classList.remove("is-visible", "is-hovering", "is-text", "is-clicking");
      clearMagneticTarget();
    }

    function handlePointerDown() {
      cursorElement.classList.add("is-clicking");
    }

    function handlePointerUp() {
      cursorElement.classList.remove("is-clicking");
    }

    animationFrame = window.requestAnimationFrame(animate);
    shellElement.addEventListener("pointermove", handlePointerMove);
    shellElement.addEventListener("pointerleave", handlePointerLeave);
    shellElement.addEventListener("pointerdown", handlePointerDown);
    shellElement.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      shellElement.classList.remove("interactive-shell--cursor-active");
      shellElement.style.removeProperty("--cursor-x");
      shellElement.style.removeProperty("--cursor-y");
      clearMagneticTarget();
      shellElement.removeEventListener("pointermove", handlePointerMove);
      shellElement.removeEventListener("pointerleave", handlePointerLeave);
      shellElement.removeEventListener("pointerdown", handlePointerDown);
      shellElement.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  return (
    <div aria-hidden="true" className="interactive-cursor" ref={cursorRef}>
      <span className="interactive-cursor__trail interactive-cursor__trail--one" />
      <span className="interactive-cursor__trail interactive-cursor__trail--two" />
      <span className="interactive-cursor__trail interactive-cursor__trail--three" />
      <span className="interactive-cursor__ring" ref={ringRef} />
      <span className="interactive-cursor__dot" ref={dotRef} />
    </div>
  );
}
