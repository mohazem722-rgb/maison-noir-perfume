import { useEffect, useRef } from "react";
/** Scroll-only film. Never autoplay; decoded frames cached at <=960px, canvas capped at DPR 2. */
export function ScrollFilm({ ar }: { ar: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    const cache = new Map<number, ImageBitmap>();
    let raf = 0,
      current = 0,
      requested = -1,
      rendered = -1,
      seeking = false,
      disposed = false,
      ready = false;
    const draw = (frame: CanvasImageSource) => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const w = Math.round(rect.width * dpr),
        h = Math.round(rect.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const fw = video.videoWidth || 960,
        fh = video.videoHeight || 536;
      const scale = Math.max(w / fw, h / fh);
      const align = innerWidth < 768 ? (ar ? 0.22 : 0.78) : 0.5;
      ctx.drawImage(
        frame,
        (w - fw * scale) * align,
        (h - fh * scale) / 2,
        fw * scale,
        fh * scale,
      );
      canvas.classList.add("loaded");
    };
    const onSeeked = async () => {
      const frameIndex = requested;
      try {
        const bitmap = await createImageBitmap(video, {
          resizeWidth: 960,
          resizeQuality: "medium",
        });
        if (disposed) {
          bitmap.close();
          return;
        }
        cache.get(frameIndex)?.close();
        cache.set(frameIndex, bitmap);
        if (frameIndex === Math.round(current * 89)) {
          draw(bitmap);
          rendered = frameIndex;
          canvas.dataset.frame = String(frameIndex);
        }
      } catch {
        /* Poster remains visible when decoding is unavailable. */
      } finally {
        seeking = false;
      }
    };
    const onLoaded = () => {
      ready = true;
      draw(video);
      canvas.dataset.frame = "0";
    };
    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("seeked", onSeeked);
    video.src =
      import.meta.env.VITE_HERO_VIDEO_URL ||
      (ar ? "/images/hero-scroll-ar.mp4" : "/images/hero-scroll.mp4");
    video.load();
    const tick = () => {
      const target = Math.min(
        1,
        Math.max(
          0,
          window.scrollY /
            (document.documentElement.scrollHeight - innerHeight || 1),
        ),
      );
      current += (target - current) * 0.12;
      const index = Math.round(current * 89);
      const frame = cache.get(index);
      if (frame && rendered !== index) {
        draw(frame);
        rendered = index;
        canvas.dataset.frame = String(index);
      } else if (
        ready &&
        !frame &&
        !seeking &&
        requested !== index &&
        video.duration > 0
      ) {
        seeking = true;
        requested = index;
        video.currentTime = Math.min(
          video.duration - 0.001,
          (index / 90) * video.duration,
        );
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const resize = () => {
      rendered = -1;
      const frame = cache.get(Math.round(current * 89));
      if (frame) draw(frame);
    };
    window.addEventListener("resize", resize);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("seeked", onSeeked);
      video.removeAttribute("src");
      video.load();
      cache.forEach((frame) => frame.close());
    };
  }, [ar]);
  return <canvas className="hero-film" ref={canvasRef} aria-hidden="true" />;
}
