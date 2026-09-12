"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

const CLIP_SRC = "/video/bilyo-demo.mp4";
const POSTER_SRC = "/video/bilyo-demo-poster.jpg";

/**
 * Marketing artwork: a short, silent loop of a quotation going out and coming
 * back accepted.
 *
 * Three things this component is careful about, because the landing page is the
 * one screen a PH freelancer opens on mobile data:
 *
 *  1. The <video> is not in the DOM until the band is near the viewport, so the
 *     clip never competes with the hero for bandwidth or LCP. `preload="none"`
 *     alone would not do it — browsers ignore it once `autoplay` is set.
 *  2. `prefers-reduced-motion: reduce` gets the poster and nothing else. No
 *     video element is ever created for those visitors.
 *  3. The loop can be stopped. An autoplaying clip the visitor cannot pause is
 *     an annoyance halfway down a long page.
 */
export function DemoVideo() {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [showVideo, setShowVideo] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    // Reduced motion wins outright — never mount the clip.
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionQuery.matches) return;

    if (!("IntersectionObserver" in window)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowVideo(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShowVideo(true);
          observer.disconnect();
        }
      },
      // Start the download just before the band scrolls into view.
      { rootMargin: "300px 0px" },
    );

    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  // Autoplay can still be refused (data saver, low power mode). Reflect what
  // actually happened so the control is not lying about the state.
  const handleMounted = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (!node) return;
    node.muted = true;
    void node.play().then(
      () => setIsPlaying(true),
      () => setIsPlaying(false),
    );
  }, []);

  const toggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().then(
        () => setIsPlaying(true),
        () => setIsPlaying(false),
      );
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  return (
    <figure className="mx-auto flex w-full max-w-140 flex-col gap-3">
      <div
        ref={frameRef}
        className="border-line bg-ink relative aspect-video w-full overflow-hidden rounded-xl border"
      >
        <Image
          src={POSTER_SRC}
          alt=""
          fill
          sizes="(min-width: 1024px) 560px, 100vw"
          className="object-cover"
        />

        {showVideo && (
          <video
            ref={handleMounted}
            className="absolute inset-0 size-full object-cover"
            poster={POSTER_SRC}
            preload="none"
            autoPlay
            muted
            loop
            playsInline
            aria-label="A quotation being built, sent as a link, and accepted by a client."
          >
            <source src={CLIP_SRC} type="video/mp4" />
            Your browser cannot play this clip. The three steps below describe
            the same flow.
          </video>
        )}

        {showVideo && (
          <button
            type="button"
            onClick={toggle}
            aria-label={isPlaying ? "Pause the demo" : "Play the demo"}
            className="border-paper/20 bg-ink/65 text-paper hover:bg-ink/85 absolute right-3 bottom-3 flex size-9 items-center justify-center rounded-full border backdrop-blur-sm transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
              aria-hidden="true"
            >
              {isPlaying ? (
                <>
                  <path d="M10 5v14" />
                  <path d="M15 5v14" />
                </>
              ) : (
                <path d="M8 5l11 7-11 7z" />
              )}
            </svg>
          </button>
        )}
      </div>

      <figcaption className="text-muted text-center text-sm leading-relaxed">
        Building a quotation, sending the link, and watching it come back
        accepted.
      </figcaption>
    </figure>
  );
}
