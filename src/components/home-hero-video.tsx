"use client";

import {useEffect, useRef, useState} from "react";
import {Pause, Play} from "lucide-react";

/** A local, silent illustration. Pause offscreen and in hidden tabs to save resources.
 * Reduced-motion users see the poster unless they explicitly choose to play. */
export function HomeHeroVideo() {
  const video = useRef<HTMLVideoElement>(null);
  const [choice, setChoice] = useState<boolean | null>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = video.current;
    if (!element || failed) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    let disposed = false;
    const sync = () => {
      const enabled = choice ?? !preference.matches;
      if (enabled && visible && !document.hidden) {
        void element.play().catch(() => { if (!disposed) setPlaying(false); });
      } else element.pause();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    }, {threshold: 0.05});
    observer.observe(element);
    preference.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      disposed = true;
      observer.disconnect();
      preference.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      element.pause();
    };
  }, [choice, failed]);

  return <>
    <div className="home-hero-media" aria-hidden="true">
      <video ref={video} width={1280} height={640} muted loop playsInline preload="metadata"
        poster="/media/home-coast-poster.png" src="/media/home-coast.webm"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onError={() => {setFailed(true); setPlaying(false);}} />
    </div>
    {!failed && <button type="button" className="home-hero-motion"
      aria-label={playing ? "หยุดภาพพื้นหลัง" : "เล่นภาพพื้นหลัง"}
      title={playing ? "หยุดภาพพื้นหลัง" : "เล่นภาพพื้นหลัง"}
      onClick={() => setChoice(!playing)}>
      {playing ? <Pause size={15}/> : <Play size={15}/>}
      <span>ภาพพื้นหลัง</span>
    </button>}
  </>;
}
