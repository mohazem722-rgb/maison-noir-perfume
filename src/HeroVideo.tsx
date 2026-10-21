import { useEffect, useRef, useState } from "react";

/**
 * Optional decorative hero video.
 *
 * It is intentionally OFF by default: the previous build streamed a third-party
 * (Pinterest CDN) clip that we do not own, which is both a copyright risk and an
 * unnecessary external dependency. Set VITE_HERO_VIDEO_URL to a clip you own or
 * have licensed (for example a file under /videos) to enable it again.
 */
export const HERO_VIDEO_URL = (
  import.meta.env.VITE_HERO_VIDEO_URL || ""
).trim();

/** Decorative, full-hero spark backdrop. The bottle and studio lighting stay above it. */
export function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!HERO_VIDEO_URL) return;
    const resume = () => {
      const video = videoRef.current;
      if (!ready || !video || document.visibilityState !== "visible") return;
      video.muted = true;
      // Browser/OS playback restrictions can still reject autoplay; the studio stays visible.
      void video.play().catch(() => {});
    };
    resume();
    window.addEventListener("pageshow", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.removeEventListener("pageshow", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [ready]);

  if (!HERO_VIDEO_URL) return null;

  return (
    <div
      className={`hero-video-player${ready ? " is-ready" : ""}`}
      aria-hidden="true"
    >
      <video
        ref={videoRef}
        className="hero-video"
        src={HERO_VIDEO_URL}
        autoPlay
        muted
        loop
        playsInline
        controls={false}
        disablePictureInPicture
        disableRemotePlayback
        preload="auto"
        tabIndex={-1}
        onLoadedData={() => setReady(true)}
        onError={() => {
          videoRef.current?.pause();
          setReady(false);
        }}
      />
    </div>
  );
}
