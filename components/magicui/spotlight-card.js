import React, { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function SpotlightCard({ children, className, dark, spotlightColor, onClick }) {
  const divRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e) => {
    if (!divRef.current) return;

    const div = divRef.current;
    const rect = div.getBoundingClientRect();

    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseEnter = () => {
    setOpacity(1);
  };

  const handleMouseLeave = () => {
    setOpacity(0);
  };

  const defaultSpotlightColor = dark 
    ? "rgba(129, 140, 248, 0.12)" // indigo-400 / 12% opacity
    : "rgba(99, 102, 241, 0.12)";  // indigo-500 / 12% opacity

  const color = spotlightColor || defaultSpotlightColor;
  const borderGradient = dark
    ? `radial-gradient(180px circle at ${position.x}px ${position.y}px, rgba(255,255,255,0.18), transparent 80%)`
    : `radial-gradient(200px circle at ${position.x}px ${position.y}px, rgba(99, 102, 241, 0.35), transparent 80%)`;

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-3xl p-[1px] transition-all duration-500",
        dark ? "bg-white/[0.06] shadow-black/20" : "bg-slate-300/40 shadow-slate-100/30",
        onClick ? "cursor-pointer" : "",
        className
      )}
    >
      {/* Border Spotlight */}
      <div
        className="pointer-events-none absolute -inset-px rounded-3xl transition-opacity duration-300 z-0"
        style={{
          opacity,
          background: borderGradient,
        }}
      />
      
      {/* Content Wrapper */}
      <div className={cn(
        "relative rounded-[23px] h-full w-full z-10 overflow-hidden backdrop-blur-md",
        dark ? "bg-[#0b0c16]/85 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]" : "bg-white/60 text-slate-800 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.7)]"
      )}>
        {/* Background Spotlight */}
        <div
          className="pointer-events-none absolute -inset-px rounded-[23px] transition-opacity duration-300 z-0"
          style={{
            opacity,
            background: `radial-gradient(350px circle at ${position.x}px ${position.y}px, ${color}, transparent 80%)`,
          }}
        />
        <div className="relative z-10">{children}</div>
      </div>
    </div>
  );
}
