import React from "react";
import { cn } from "@/lib/utils";

interface GaugeProps {
  value: number;
  min?: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  colorClass?: string;
}

export function Gauge({
  value,
  min = 0,
  max = 100,
  size = 200,
  strokeWidth = 12,
  className,
  colorClass = "text-primary"
}: GaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percent = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className={cn("relative flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg
        className="transform -rotate-90 w-full h-full"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          className="text-card-border"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={cn("transition-all duration-1000 ease-out", colorClass)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className={cn("text-6xl font-mono font-bold tracking-tighter", colorClass)}>
          {Math.round(value)}
        </span>
        <span className="text-xs text-muted-foreground uppercase font-bold tracking-widest mt-1">
          Safety Score
        </span>
      </div>
    </div>
  );
}