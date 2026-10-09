import { useEffect, useRef, useState } from "react";
import type { Position } from "./engine";
import { createFlatIslandRenderer, createIslandRenderer, type IslandRenderer, type IslandView } from "./islandScene";

export default function Island({ world, country, positions, uid, origin, selected, mining, firstPerson, onSelect, onAim, onLook, onRenderer, mini = false }: IslandView & {
  onSelect?: (p: Position) => void;
  onAim?: (p: Position | null) => void;
  onLook?: (dx: number, dy: number) => void;
  onRenderer?: (renderer: "webgl" | "2d") => void;
  mini?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<IslandRenderer | null>(null);
  const props = useRef<IslandView>({ world, country, positions, uid, origin, selected, mining, firstPerson });
  const callbacks = useRef({ onAim, onLook, onRenderer }); callbacks.current = { onAim, onLook, onRenderer };
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const [fallback, setFallback] = useState(false);
  props.current = { world, country, positions, uid, origin, selected, mining, firstPerson };
  useEffect(() => {
    const el = canvas.current!;
    let frame = 0, last = -Infinity, lastAim = -Infinity, aimKey: string | undefined, visible = true;
    try {
      renderer.current = fallback ? createFlatIslandRenderer(el) : createIslandRenderer(el, props.current, mini);
      callbacks.current.onRenderer?.(fallback ? "2d" : "webgl");
    } catch {
      setFallback(true);
      return;
    }
    const observer = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? true; }) : null;
    observer?.observe(el);
    const contextLost = (event: Event) => { event.preventDefault(); setFallback(true); };
    el.addEventListener("webglcontextlost", contextLost);
    function draw(time: number) {
      frame = requestAnimationFrame(draw);
      if (!visible || document.hidden || time - last < (mini ? 80 : 32)) return;
      last = time; renderer.current?.draw(props.current, time);
      if (time - lastAim >= 90) {
        lastAim = time;
        const p = props.current.firstPerson && !fallback ? renderer.current?.pick(.5, .5) || null : null;
        const nextKey = p ? `${p.x},${p.y}` : "";
        el.dataset.aim = nextKey;
        if (nextKey !== aimKey) { aimKey = nextKey; callbacks.current.onAim?.(p); }
      }
    }
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame); observer?.disconnect(); el.removeEventListener("webglcontextlost", contextLost);
      renderer.current?.dispose(); renderer.current = null;
    };
  }, [country, mini, fallback, world.config.map.width, world.config.map.height]);
  const immersive = !!firstPerson && !fallback;
  return <canvas
    key={fallback ? "flat" : "three"}
    ref={canvas}
    className="island-canvas"
    data-view={immersive ? "first-person" : "overview"}
    aria-label={`${world.config.countries.find((c: any) => c.id === country)?.name} ${fallback ? "2D 섬 지도" : immersive ? "1인칭 3D 세계 · 드래그하여 둘러보기" : "3D 섬 지도"}`}
    role="img"
    onPointerDown={e => {
      if (!immersive || drag.current || e.button !== 0) return;
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
    }}
    onPointerMove={e => {
      const previous = drag.current;
      if (!immersive || !previous || previous.id !== e.pointerId) return;
      callbacks.current.onLook?.(e.clientX - previous.x, e.clientY - previous.y);
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    }}
    onPointerCancel={() => { drag.current = null; }}
    onLostPointerCapture={() => { drag.current = null; }}
    onPointerUp={e => {
      if (drag.current?.id === e.pointerId) { drag.current = null; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }
      if (immersive || !onSelect || !renderer.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const p = renderer.current.pick((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
      if (p) onSelect(p);
    }}
    style={{ ...(immersive ? { width: "100%", height: "100%", aspectRatio: "auto" } : { aspectRatio: `${world.config.map.width}/${world.config.map.height}` }), imageRendering: "auto", cursor: immersive ? "grab" : onSelect ? "pointer" : "default", touchAction: "none" }}
  />;
}
