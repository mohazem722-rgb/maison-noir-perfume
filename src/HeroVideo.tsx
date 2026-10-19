import { useEffect, useRef, useState } from "react";

export const HERO_VIDEO_URL =
  import.meta.env.VITE_HERO_VIDEO_URL?.trim() ||
  "https://v1.pinimg.com/videos/iht/720p/f9/ea/c2/f9eac2df7c642573229dd098ba61d13f.mp4";

/** Decorative, full-hero spark backdrop. The bottle and studio lighting stay above it. */
export function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
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
