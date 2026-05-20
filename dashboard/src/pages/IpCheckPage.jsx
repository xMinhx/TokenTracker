import React, { useState } from "react";

export default function IpCheckPage() {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="h-full relative dark:bg-[#050505]">
      {!loaded && (
        <div className="absolute inset-0 p-6 space-y-5 animate-pulse">
          {/* Nav bar skeleton */}
          <div className="flex gap-4 justify-center">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-4 w-20 rounded bg-oai-gray-200 dark:bg-oai-gray-800" />
            ))}
          </div>
          {/* Title skeleton */}
          <div className="space-y-2 pt-2">
            <div className="h-7 w-72 rounded bg-oai-gray-200 dark:bg-oai-gray-800" />
            <div className="h-4 w-96 rounded bg-oai-gray-200 dark:bg-oai-gray-800" />
          </div>
          {/* IP cards row */}
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-oai-gray-200 dark:bg-oai-gray-800" />
            ))}
          </div>
          {/* Detail cards row */}
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 rounded-xl bg-oai-gray-200 dark:bg-oai-gray-800" />
            ))}
          </div>
          {/* Bottom cards row */}
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 rounded-xl bg-oai-gray-200 dark:bg-oai-gray-800" />
            ))}
          </div>
        </div>
      )}
      <iframe
        src="/proxy/ipcheck/claude/"
        title="Cloud AI IP Check"
        className={`w-full h-full dark:invert dark:hue-rotate-180 transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        style={{ border: "none" }}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
