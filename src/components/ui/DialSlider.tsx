import React, { useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface DialSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  className?: string;
}

export const DialSlider: React.FC<DialSliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  className
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startValue = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    startX.current = e.pageX;
    startValue.current = value;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    startX.current = e.touches[0].pageX;
    startValue.current = value;
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging.current) return;
      
      const pageX = 'touches' in e ? e.touches[0].pageX : (e as MouseEvent).pageX;
      const diff = pageX - startX.current;
      const sensitivity = 0.5; // Adjustable
      const range = max - min;
      const newValue = Math.min(max, Math.max(min, startValue.current + (diff * sensitivity * (range / 200))));
      
      onChange(Math.round(newValue / step) * step);
    };

    const handleEnd = () => {
      isDragging.current = false;
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [min, max, step, onChange]);

  // Calculate percentage for tick marks
  const range = max - min;
  const currentPos = ((value - min) / range) * 100;

  return (
    <div className={cn("flex flex-col gap-2 w-full", className)}>
      <div className="flex items-center justify-between px-4">
        <span className="text-[11px] font-black uppercase text-white/40 tracking-wider font-sans">{label}</span>
        <span className="text-[13px] font-black text-white font-mono">{Math.round(value)}</span>
      </div>
      
      <div 
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className="relative h-12 w-full bg-white/[0.02] border-y border-white/5 cursor-ew-resize overflow-hidden flex items-center select-none"
      >
        {/* Ticks */}
        <div 
          className="absolute left-1/2 top-0 bottom-0 flex items-center transition-transform duration-200 ease-out"
          style={{ transform: `translateX(calc(-50% - ${(currentPos - 50) * 2}px))` }}
        >
          {Array.from({ length: 41 }).map((_, i) => {
            const tickValue = min + (i * (range / 40));
            const isMain = i % 10 === 0;
            return (
              <div 
                key={i} 
                className={cn(
                  "flex-shrink-0 transition-opacity",
                  isMain ? "w-[1.5px] h-4 bg-white/40 mx-[10px]" : "w-[1px] h-2 bg-white/10 mx-[10px]"
                )}
              />
            );
          })}
        </div>

        {/* Center Indicator */}
        <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-[#00c2cb] shadow-[0_0_10px_rgba(0,194,203,0.5)] z-10" />
        
        {/* Gradient overlays for depth */}
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-black/40 to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-black/40 to-transparent pointer-events-none" />
      </div>
    </div>
  );
};
