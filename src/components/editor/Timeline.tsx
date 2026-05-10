import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clip } from '../../types/editor';
import { cn } from '../../lib/utils';
import { Plus, Volume2, Scissors, Type, Play, Music, Maximize2, Diamond } from 'lucide-react';

interface TimelineProps {
  clips: Clip[];
  currentTime: number;
  duration: number;
  onTimeChange: (time: number) => void;
  selectedClipId: string | null;
  onClipSelect: (id: string | null) => void;
  onAddMedia: () => void;
  onAddText: () => void;
  onSplit: () => void;
  onUpdateClip: (id: string, updates: Partial<Clip>) => void;
  onUpdateEnd: () => void;
  onTabChange?: (tab: string) => void;
  onReorderClips?: (draggedId: string, overId: string) => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
}

const PIXELS_PER_SECOND = 60;

export default function Timeline({ 
  clips, 
  currentTime, 
  duration, 
  onTimeChange, 
  selectedClipId, 
  onClipSelect,
  onAddMedia,
  onAddText,
  onSplit,
  onUpdateClip,
  onUpdateEnd,
  onTabChange,
  onReorderClips,
  isMuted,
  onToggleMute
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [zoom, setZoom] = useState(60); // Pixels per second
  const pixelsPerSecond = zoom;
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null);

  // Sync scroll to current time
  useEffect(() => {
    if (scrollRef.current && !isScrolling && !draggingClipId) {
      const scrollPos = currentTime * pixelsPerSecond;
      scrollRef.current.scrollLeft = scrollPos;
    }
  }, [currentTime, isScrolling, pixelsPerSecond, draggingClipId]);

  const [isSnapped, setIsSnapped] = useState(false);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!isScrolling) return; // Only update via user scroll
    const scrollLeft = e.currentTarget.scrollLeft;
    const maxScroll = duration * pixelsPerSecond;

    // Hard Stop: prevent scrolling past duration if "mentok" effect is desired
    if (scrollLeft > maxScroll) {
      e.currentTarget.scrollLeft = maxScroll;
      setIsSnapped(false);
      return;
    }

    let newTime = scrollLeft / pixelsPerSecond;
    
    // Magnetic Snap Logic - Increased threshold for "=|" feeling
    const snapThresholdPx = 18; // radius in pixels
    const snapPoints = Array.from(new Set(clips.flatMap(c => [c.start, c.start + c.duration])));
    
    const closestSnap = snapPoints.find(p => Math.abs(p * pixelsPerSecond - scrollLeft) < snapThresholdPx);
    
    if (closestSnap !== undefined) {
      // If we weren't snapped yet, vibrate
      if (!isSnapped && window.navigator.vibrate) {
        window.navigator.vibrate(12);
      }
      newTime = closestSnap;
      setIsSnapped(true);
    } else {
      setIsSnapped(false);
    }

    // Strict Clamp: Don't allow playhead to pass the final end of project
    const clampedTime = Math.max(0, Math.min(newTime, duration));
    onTimeChange(clampedTime);
  };

  const handleClipReorder = (draggedId: string, overId: string) => {
    if (!onReorderClips) return;
    onReorderClips(draggedId, overId);
  };

  // Group clips by layer
  const layers = Array.from(new Set(clips.map(c => c.layer))).sort((a, b) => b - a); // Higher layers on top

  return (
    <div 
      className="h-full flex flex-col relative"
      onTouchStart={() => { if (!draggingClipId) setIsScrolling(true); }}
      onTouchEnd={() => setIsScrolling(false)}
      onMouseDown={() => { if (!draggingClipId) setIsScrolling(true); }}
      onMouseUp={() => setIsScrolling(false)}
    >
      {/* Playhead - exactly at the center of the container */}
      <div className="absolute top-0 bottom-0 left-1/2 w-[1px] z-[150] pointer-events-none transition-colors duration-150"
        style={{ backgroundColor: isSnapped ? '#ffffff' : 'rgba(255, 255, 255, 0.8)' }}
      >
        {/* Glow effect when snapped */}
        {isSnapped && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-full bg-white/10 blur-sm" />
        )}
        {/* Main white line */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1.5px] h-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
      </div>

      {/* Zoom Controls */}
      <div className="absolute bottom-4 right-4 z-[200] hidden md:flex items-center gap-3 bg-black/60 backdrop-blur-xl border border-white/10 p-2 rounded-xl">
         <button onClick={() => setZoom(z => Math.max(20, z - 10))} className="text-white/40 hover:text-white"><Maximize2 className="w-4 h-4 rotate-45" /></button>
         <div className="w-24 h-1 bg-white/10 rounded-full relative">
            <div className="absolute h-full bg-[#00c2cb] rounded-full" style={{ width: `${(zoom - 20) / 180 * 100}%` }} />
         </div>
         <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="text-white/40 hover:text-white"><Maximize2 className="w-4 h-4" /></button>
      </div>

      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-x-auto no-scrollbar relative"
      >
        <div className="flex h-full">
          {/* Start Spacer */}
          <div className="flex-shrink-0 w-1/2 h-full" />
          
          {/* Main Timeline Strip */}
          <div 
            className="h-full relative flex flex-col pt-8 flex-shrink-0"
            style={{ width: `${duration * pixelsPerSecond}px` }}
          >
            {/* End project vertical line */}
            <div 
              className="absolute top-0 bottom-0 w-[2px] bg-white/30 z-[60]"
              style={{ left: `${duration * pixelsPerSecond}px` }}
            />
            {/* Time Rulers - CapCut Style dots and lines */}
            <div className="absolute top-0 left-0 right-0 h-10 flex items-end pointer-events-none border-b border-white/5 bg-black/20">
              {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
                <div 
                  key={i} 
                  className="absolute flex flex-col items-center" 
                  style={{ left: `${i * pixelsPerSecond}px` }}
                >
                  <div className="w-[1.5px] h-2 bg-white/20" />
                  
                  {/* Fine Ruler Ticks */}
                  {Array.from({ length: 4 }).map((_, j) => (
                     <div 
                      key={j} 
                      className="absolute w-[1px] h-1 bg-white/10"
                      style={{ left: `${(j + 1) * (pixelsPerSecond / 5)}px`, bottom: 0 }} 
                    />
                  ))}
                </div>
              ))}
            </div>

          <div className="flex-1 flex flex-col py-2 gap-1 min-h-0">
            {/* Render all layers */}
            {layers.map(layer => (
              <div key={layer} className={cn(
                "relative flex items-center bg-white/[0.01] border-y border-white/5",
                layer === 0 ? "h-10 bg-white/[0.03]" : "h-8"
              )}>
                {/* Track label for overlays */}
                {layer !== 0 && (
                  <div className="absolute left-0 top-0 bottom-0 px-2 flex items-center z-10">
                    <div className="w-[3px] h-[40%] bg-white/10 rounded-full" />
                  </div>
                )}
                {clips.filter(c => c.layer === layer).sort((a, b) => a.start - b.start).map((clip, index, filteredClips) => {
                  const nextClip = filteredClips[index + 1];
                  const hasContiguousNext = nextClip && Math.abs(nextClip.start - (clip.start + clip.duration)) < 0.1;

                  return (
                    <React.Fragment key={clip.id}>
                      <ClipItem 
                        clip={clip}
                        isSelected={selectedClipId === clip.id}
                        onClick={() => onClipSelect(clip.id)}
                        pixelsPerSecond={pixelsPerSecond}
                        isSmaller={layer !== 0}
                        onUpdateClip={onUpdateClip}
                        onUpdateEnd={onUpdateEnd}
                        currentTime={currentTime}
                        onDragStateChange={(isDragging) => setDraggingClipId(isDragging ? clip.id : null)}
                        onSwapWith={(targetId) => handleClipReorder(clip.id, targetId)}
                        otherClipsInLayer={filteredClips}
                      />
                      {layer === 0 && hasContiguousNext && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onClipSelect(nextClip.id);
                            if (onTabChange) onTabChange('transition');
                          }}
                          className={cn(
                            "absolute z-[40] w-3.5 h-3.5 rounded-sm flex items-center justify-center transition-all -translate-x-1/2 shadow-lg",
                            nextClip.transitionType && nextClip.transitionType !== 'none'
                              ? "bg-white border border-neutral-400"
                              : "bg-white/90 border border-neutral-300"
                          )}
                          style={{
                            left: `${(clip.start + clip.duration) * pixelsPerSecond}px`
                          }}
                          title="Transition"
                        >
                          {nextClip.transitionType && nextClip.transitionType !== 'none' ? (
                            <div className="flex gap-0.5">
                              <div className="w-0.5 h-2.5 bg-[#4f46e5] rounded-full" />
                              <div className="w-0.5 h-2.5 bg-[#4f46e5] rounded-full" />
                            </div>
                          ) : (
                            <div className="w-0.5 h-3 bg-neutral-600 rounded-full" />
                          )}
                        </button>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

          {/* End Spacer */}
          <div className="flex-shrink-0 w-1/2 h-full" />
        </div>
      </div>
    </div>
  );
}

interface ClipItemProps {
  clip: Clip;
  isSelected: boolean;
  onClick: () => void;
  pixelsPerSecond: number;
  isSmaller?: boolean;
  onUpdateClip: (id: string, updates: Partial<Clip>) => void;
  onUpdateEnd: () => void;
  currentTime: number;
  onDragStateChange: (isDragging: boolean) => void;
  onSwapWith: (targetId: string) => void;
  otherClipsInLayer: Clip[];
}

function ClipItem({ 
  clip, isSelected, onClick, pixelsPerSecond, isSmaller, 
  onUpdateClip, onUpdateEnd, currentTime, onDragStateChange, 
  onSwapWith, otherClipsInLayer 
}: ClipItemProps) {
  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [hasDragged, setHasDragged] = useState(false);
  
  const startPos = useRef(0);
  const startDuration = useRef(0);
  const startStartTime = useRef(0);
  const startTrimStart = useRef(0);

  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [isLongPressed, setIsLongPressed] = useState(false);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    onClick();
    
    setHasDragged(false);
    setIsLongPressed(false);
    
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    startPos.current = clientX;
    startStartTime.current = clip.start;

    // For Layer 0, require a short hold (long press) to start reordering
    if (clip.layer === 0) {
      longPressTimer.current = setTimeout(() => {
        setIsLongPressed(true);
        if (window.navigator.vibrate) window.navigator.vibrate(15);
      }, 350); // 350ms hold to unlock
    } else {
      setIsLongPressed(true); // Free layers can drag immediately
    }

    let dragStarted = false;
    let lastSwapTime = 0;

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : (moveEvent as MouseEvent).clientX;
      const deltaX = currentX - startPos.current;

      // If we move too much before the hold timer finishes, cancel reorder intent
      if (!isLongPressed && Math.abs(deltaX) > 10) {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }

      // Drag only starts if long-pressed AND moved past a threshold
      if (!isLongPressed) return;
      if (!dragStarted && Math.abs(deltaX) < 20) return;
      
      if (!dragStarted) {
        dragStarted = true;
        setHasDragged(true);
        setIsDragging(true);
        onDragStateChange(true);
      }

      const deltaTime = deltaX / pixelsPerSecond;
      setDragOffset(deltaX);

      if (clip.layer === 0) {
        // Prevent rapid swapping
        const now = Date.now();
        if (now - lastSwapTime < 300) return;

        // Find neighbor we are overlapping significantly
        const neighbor = otherClipsInLayer.find(other => {
          if (other.id === clip.id) return false;
          
          const otherMid = other.start + other.duration / 2;
          const draggedStart = clip.start + deltaTime;
          const draggedEnd = draggedStart + clip.duration;
          
          // FIRM DIRECTIONAL SWAP: Must pass the neighbor's midpoint by 40% cushion
          const cushion = (other.duration * 0.4);
          
          if (deltaX > 0 && clip.start < other.start && draggedEnd > (otherMid + cushion)) return true;
          if (deltaX < 0 && clip.start > other.start && draggedStart < (otherMid - cushion)) return true;
          return false;
        });

        if (neighbor) {
          lastSwapTime = now;
          onSwapWith(neighbor.id);
          // Precise coordinate adjustment to keep the clip under the finger
          const shift = neighbor.duration * pixelsPerSecond;
          const direction = deltaX > 0 ? 1 : -1;
          startPos.current += direction * shift;
          setDragOffset(prev => prev - (direction * shift));
        }
      } else {
        const newStart = Math.max(0, startStartTime.current + deltaTime);
        onUpdateClip(clip.id, { start: newStart });
      }
    };

    const onEnd = () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      setIsLongPressed(false);
      setIsDragging(false);
      onDragStateChange(false);
      setDragOffset(0);
      setHasDragged(false);
      onUpdateEnd();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onEnd);
  };

  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent, direction: 'left' | 'right') => {
    e.stopPropagation();
    setIsResizing(direction);
    setHasDragged(false);
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    startPos.current = clientX;
    startDuration.current = clip.duration;
    startStartTime.current = clip.start;
    startTrimStart.current = clip.trimStart;

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : (moveEvent as MouseEvent).clientX;
      const deltaX = currentX - startPos.current;

      // Sensitivity filter: Don't move until user has dragged at least 5px
      if (!hasDragged && Math.abs(deltaX) < 5) return;
      setHasDragged(true);
      
      const deltaTime = deltaX / pixelsPerSecond;
      
      let targetTime = (direction === 'right') 
        ? (startStartTime.current + startDuration.current + deltaTime)
        : (startStartTime.current + deltaTime);

      // Snap to playhead (currentTime) if close (5px threshold for precision)
      const snapThreshold = 5 / pixelsPerSecond;
      if (Math.abs(targetTime - currentTime) < snapThreshold) {
        targetTime = currentTime;
      }

      if (direction === 'right') {
        const newDuration = Math.max(0.1, targetTime - clip.start);
        onUpdateClip(clip.id, { duration: newDuration });
      } else {
        const newShift = targetTime - startStartTime.current;
        const newStart = targetTime;
        const newDuration = Math.max(0.1, startDuration.current - newShift);
        const newTrimStart = startTrimStart.current + newShift;
        onUpdateClip(clip.id, { 
          start: newStart, 
          duration: newDuration, 
          trimStart: newTrimStart 
        });
      }
    };

    const onEnd = () => {
      setIsResizing(null);
      setHasDragged(false);
      onUpdateEnd();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onEnd);
  };

  return (
    <motion.div
      layoutId={clip.id}
      onMouseDown={handleDragStart}
      onTouchStart={handleDragStart}
      initial={false}
      animate={{
        left: clip.start * pixelsPerSecond,
        width: clip.duration * pixelsPerSecond,
        x: dragOffset,
        scale: isDragging ? 1.05 : isLongPressed ? 1.02 : isSelected ? 1.01 : 1,
        zIndex: isDragging ? 300 : isLongPressed ? 250 : isSelected ? 100 : 10,
        boxShadow: isDragging ? "0 20px 40px rgba(0,0,0,0.6)" : "0 0 0 rgba(0,0,0,0)",
      }}
      transition={isDragging ? 
        { type: "just" } : 
        {
          type: "spring",
          stiffness: 500,
          damping: 50,
        }
      }
      className={cn(
        "absolute cursor-pointer border flex items-center group overflow-hidden",
        isSmaller ? "h-6 rounded-sm" : "h-8 rounded-md",
        isSelected 
          ? "border-white ring-[4px] ring-white/20" 
          : "border-white/5 opacity-80 hover:opacity-100",
        isDragging && "opacity-60 shadow-2xl skew-x-1"
      )}
      style={{
        backgroundColor: clip.type === 'text' ? '#3b82f6' : '#1a1a1a',
      }}
    >
      {/* Background thumbnails for video/photo */}
      {(clip.type === 'video' || clip.type === 'photo') && (
        <div 
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage: `url(${clip.src})`,
            backgroundSize: `${isSmaller ? '30px' : '50px'} auto`,
            backgroundRepeat: 'repeat-x',
            backgroundPosition: `${-clip.trimStart * pixelsPerSecond}px center`,
          }}
        />
      )}

      {/* Frame Dividers */}
      <div className="absolute inset-0 flex pointer-events-none opacity-10">
        {Array.from({ length: Math.floor(clip.duration * 2) }).map((_, i) => (
          <div key={i} className="h-full w-[1px] bg-white ml-2 first:ml-0" />
        ))}
      </div>

      {/* Keyframe Indicators */}
      {clip.keyframes && clip.keyframes.map((kf, i) => (
        <div 
          key={i}
          className="absolute top-0 bottom-0 flex items-center pointer-events-none z-30"
          style={{ left: `${kf.time * pixelsPerSecond}px` }}
        >
          <div className="relative -translate-x-1/2">
             <Diamond className="w-2.5 h-2.5 fill-white text-white drop-shadow-[0_0_2px_black]" />
             {/* Highlight effect for active keyframe */}
             {Math.abs(kf.time - (currentTime - clip.start)) < 0.1 && (
               <div className="absolute inset-0 scale-150 bg-white/20 blur-[2px] rounded-full" />
             )}
          </div>
        </div>
      ))}

      {/* Ripple/Haptic Visual Feedback */}
      {isSelected && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-white/5 pointer-events-none"
        />
      )}

      {/* Resizing handles - Thick White Handles like CapCut */}
      {isSelected && (
        <>
          <div 
            className="absolute left-0 top-0 bottom-0 w-3 bg-white z-[150] cursor-ew-resize flex items-center justify-center shadow-[2px_0_10px_rgba(0,0,0,0.5)] active:w-5 transition-all"
            onMouseDown={(e) => handleResizeStart(e, 'left')}
            onTouchStart={(e) => handleResizeStart(e, 'left')}
          >
            <div className="w-[1.5px] h-[40%] bg-neutral-400 rounded-full" />
          </div>
          <div 
            className="absolute right-0 top-0 bottom-0 w-3 bg-white z-[150] cursor-ew-resize flex items-center justify-center shadow-[-2px_0_10px_rgba(0,0,0,0.5)] active:w-5 transition-all"
            onMouseDown={(e) => handleResizeStart(e, 'right')}
            onTouchStart={(e) => handleResizeStart(e, 'right')}
          >
            <div className="w-[1.5px] h-[40%] bg-neutral-400 rounded-full" />
          </div>
        </>
      )}

      <div className="w-full h-full relative flex items-center px-3 overflow-hidden z-20">
        {clip.type === 'audio' && <Music className="w-3.5 h-3.5 text-white mr-1.5 flex-shrink-0" />}
        {clip.type === 'text' && <Type className="w-3.5 h-3.5 text-white mr-1.5 flex-shrink-0" />}
        <span className="text-[9px] font-bold uppercase text-white truncate max-w-full drop-shadow-lg pointer-events-none bg-black/30 px-1.5 py-0.5 rounded-sm">
           {clip.type === 'text' ? (clip.text || 'TEKS') : clip.type.toUpperCase()}
        </span>
      </div>
    </motion.div>
  );
}
