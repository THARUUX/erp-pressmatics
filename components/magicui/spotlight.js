import React from "react";
import { cn } from "@/lib/utils";

export function Spotlight({ className, fill, style, id = "filter-spotlight", fillOpacity = 0.5 }) {
  return (
    <svg
      className={cn(
        "pointer-events-none absolute z-0 h-[169%] w-[138%] lg:w-[84%]",
        className
      )}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 3787 2842"
      fill="none"
      style={style}
    >
      <g filter={`url(#${id})`}>
        <ellipse
          cx="1924.57"
          cy="273.89"
          rx="1924.57"
          ry="273.89"
          transform="matrix(-0.822377 -0.568943 0.568943 -0.822377 3631.88 2291.09)"
          fill={fill || "white"}
          fillOpacity={fillOpacity}
        ></ellipse>
      </g>
      <defs>
        <filter
          id={id}
          x="0.860352"
          y="-0.838379"
          width="3785.16"
          height="2840.26"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix"></feFlood>
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="BackgroundImageFix"
            result="shape"
          ></feBlend>
          <feGaussianBlur
            stdDeviation="151"
            result="effect1_foregroundBlur_1065_8"
          ></feGaussianBlur>
        </filter>
      </defs>
    </svg>
  );
}
