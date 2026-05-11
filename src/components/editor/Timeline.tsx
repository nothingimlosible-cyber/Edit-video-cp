import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clip } from '../../types/editor';
import { cn, formatTime } from '../../lib/utils';
import { Plus, Volume2, Scissors, Type, Play, Music, Maximize2, Diamond, Layers, Lock, Eye, EyeOff, Image as ImageIcon, Trash2 } from 'lucide-react';

interface TimelineProps {
  clips: Clip[];
  currentTime: number;
  duration: number;
  onTimeChange: (time: number) => void;
  selectedClipId: string | null;
  onClipSelect: (id: string | null) => void;
  onAddMedia: () => void;
  onAddAudio: () => void;
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
  onAddAudio,
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
    const snapThresholdPx = 28; // Massive radius in pixels for snapping
    const stickyRadiusPx = 15;  // Deadzone where it "sticks" hard
    
    // Prioritize selected clip's boundaries and its keyframes
    const selectedClip = clips.find(c => c.id === selectedClipId);
    const selectedClipBoundaries = selectedClip ? [selectedClip.start, selectedClip.start + selectedClip.duration] : [];
    
    // Add inner boundaries for selected clip (snapping inside the white handles)
    const HANDLE_WIDTH_PX = 12; // Precise w-3 width
    const selectedClipInnerBoundaries = selectedClip ? [
      selectedClip.start + (HANDLE_WIDTH_PX / pixelsPerSecond),
      selectedClip.start + selectedClip.duration - (HANDLE_WIDTH_PX / pixelsPerSecond)
    ] : [];

    const clipBoundaries = clips.flatMap(c => [c.start, c.start + c.duration]);
    const selectedClipKeyframes = selectedClip?.keyframes?.map(kf => selectedClip.start + kf.time) || [];
    
    // Prioritize inner boundaries VERY highly by putting them first
    const snapPoints = [
      ...selectedClipInnerBoundaries,
      ...selectedClipKeyframes,
      ...clipBoundaries
    ];
    
    // Find closest snap point
    const closestSnap = snapPoints.find(p => Math.abs(p * pixelsPerSecond - scrollLeft) < snapThresholdPx);
    
    if (closestSnap !== undefined) {
      const snapPosPx = closestSnap * pixelsPerSecond;
      const distance = Math.abs(snapPosPx - scrollLeft);
      
      // EXTRA STICKY for selected clip inner points AND keyframes
      const isSelectedPoint = 
        selectedClipInnerBoundaries.includes(closestSnap) || 
        selectedClipKeyframes.includes(closestSnap);

      const isInnerPoint = selectedClipInnerBoundaries.includes(closestSnap);
      // Even stronger sticking for the inner handle edge
      const effectiveStickyRadius = isInnerPoint ? stickyRadiusPx * 4 : isSelectedPoint ? stickyRadiusPx * 2.5 : stickyRadiusPx;

      // STICKY LOGIC: If very close, force the time to stick even if user scrolls slightly
      if (distance < effectiveStickyRadius) {
        newTime = closestSnap;
      } else {
        // Linear interpolation to make the snap "pull" you in
        const pullFactor = 1 - (distance / snapThresholdPx);
        newTime = (closestSnap * pullFactor) + (newTime * (1 - pullFactor));
      }

      if (!isSnapped && window.navigator.vibrate) {
        window.navigator.vibrate(isInnerPoint ? [50, 40, 50] : [20, 10, 20]); // Heavy pulse for inner edge
      }
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

  // Group clips by layer - Put primary track (0) at top, then overlays (1,2,3), then audio tracks (-1,-2,-3)
  const layers = Array.from(new Set(clips.map(c => c.layer))).sort((a, b) => {
    if (a === 0) return -1;
    if (b === 0) return 1;
    if (a > 0 && b > 0) return a - b; // Overlays: 1, 2, 3...
    if (a < 0 && b < 0) return b - a; // Audio: -1, -2, -3...
    if (a > 0 && b < 0) return -1;   // Overlays above Audio
    return 1;
  });
  const [lockedLayers, setLockedLayers] = useState<Set<number>>(new Set());
  const [hiddenLayers, setHiddenLayers] = useState<Set<number>>(new Set());

  const toggleLock = (l: number) => {
    const next = new Set(lockedLayers);
    if (next.has(l)) next.delete(l); else next.add(l);
    setLockedLayers(next);
  };

  const toggleVisibility = (l: number) => {
    const next = new Set(hiddenLayers);
    if (next.has(l)) next.delete(l); else next.add(l);
    setHiddenLayers(next);
  };

  return (
    <div 
      className="h-full flex relative overflow-hidden bg-[#0a0a0a]"
      onTouchStart={() => { if (!draggingClipId) setIsScrolling(true); }}
      onTouchEnd={() => setIsScrolling(false)}
      onMouseDown={() => { if (!draggingClipId) setIsScrolling(true); }}
      onMouseUp={() => setIsScrolling(false)}
    >
      {/* Track Sidebar (Legend) - CapCut Android Style */}
      <div className="w-14 md:w-16 h-full flex flex-col bg-[#121212] border-r border-white/5 z-[210] overflow-hidden">
         {/* Sidebar Buttons (Mute, AI Clip, Cover) */}
         <div className="flex flex-col items-center py-1 md:py-1.5 gap-1 md:gap-1.5">
            <button 
              onClick={onToggleMute}
              className={cn(
                "w-10 h-10 md:w-11 md:h-11 flex flex-col items-center justify-center gap-1 rounded-xl transition-all",
                isMuted ? "bg-[#00c2cb]/10 text-[#00c2cb]" : "bg-white/5 text-white/40 hover:text-white/60"
              )}
            >
              <Volume2 className={cn("w-2.5 h-2.5 md:w-3 md:h-3", isMuted && "fill-current")} />
              <span className="text-[5.5px] md:text-[6px] font-black uppercase text-center leading-[1] tracking-tighter">Bisukan<br/>audio</span>
            </button>

            <button className="w-10 h-10 md:w-11 md:h-11 flex flex-col items-center justify-center gap-1 rounded-xl bg-white/5 text-white/40 hover:text-white/60 transition-all">
              <Scissors className="w-2.5 h-2.5 md:w-3 md:h-3" />
              <span className="text-[5.5px] md:text-[6px] font-black uppercase text-center leading-[1] tracking-tighter">Pemotong<br/>klip AI</span>
            </button>

            <button className="w-10 h-10 md:w-11 md:h-11 flex flex-col items-center justify-center gap-1 rounded-xl bg-white/5 text-white/40 hover:text-white/60 transition-all">
              <ImageIcon className="w-2.5 h-2.5 md:w-3 md:h-3" />
              <span className="text-[5.5px] md:text-[6px] font-black uppercase text-center leading-[1] tracking-tighter">Sampul</span>
            </button>
         </div>

         {/* Track Status Indicators (Lock/Eye) */}
         <div className="flex-1 flex flex-col pt-0 opacity-20 pointer-events-none">
            {layers.filter(l => l !== 0).map(layer => (
              <div key={layer} className="h-10 border-b border-white/[0.02]" />
            ))}
         </div>
      </div>

      <div className="flex-1 relative flex flex-col overflow-hidden">
      {/* Playhead - exactly at the center of the container (GLOWING) */}
      <div className="absolute top-0 bottom-0 left-1/2 w-[2px] -ml-[1px] z-[150] pointer-events-none transition-transform"
        style={{ 
          backgroundColor: isSnapped ? '#00c2cb' : 'rgba(255, 255, 255, 0.9)',
          boxShadow: isSnapped ? '0 0 25px #00c2cb, 0 0 50px rgba(0,194,203,0.5)' : 'none'
        }}
      >
        {/* SNAP GUIDE LINE: A very thin cyan line through the whole timeline when snapped */}
        {isSnapped && (
          <div className="absolute top-[-100vh] bottom-[-100vh] left-1/2 -ml-[0.5px] w-[1px] bg-[#00c2cb]/40 shadow-[0_0_12px_rgba(0,194,203,0.6)]" />
        )}

        {/* Glow effect */}
        <div className={cn(
          "absolute top-0 left-1/2 -translate-x-1/2 w-6 h-full transition-all duration-300",
          isSnapped ? "bg-[#00c2cb]/30 blur-[12px]" : "bg-white/10 blur-[6px]"
        )} />
        
        {/* Main white line with secondary glow */}
        <div className={cn(
          "absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-full transition-all",
          isSnapped ? "bg-[#00c2cb] scale-x-150" : "bg-white"
        )} />
        
        {/* Playhead Head (Rounded) */}
        <div className={cn(
          "absolute -top-1 -left-[5px] w-[12px] h-[12px] rounded-full shadow-lg border transition-all",
          isSnapped ? "bg-[#00c2cb] border-white scale-125" : "bg-white border-white/20"
        )} />
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
            {/* Time Rulers - CapCut Style High Contrast */}
            <div className="absolute top-0 left-0 right-0 h-8 md:h-10 flex items-end pointer-events-none border-b border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent">
              {/* Highlight for selected clip range in ruler */}
              {selectedClipId && clips.find(c => c.id === selectedClipId) && (
                <div 
                  className="absolute top-0 bottom-0 bg-[#00c2cb]/5 z-[10]"
                  style={{ 
                    left: `${clips.find(c => c.id === selectedClipId)!.start * pixelsPerSecond}px`, 
                    width: `${clips.find(c => c.id === selectedClipId)!.duration * pixelsPerSecond}px` 
                  }}
                >
                  {/* Inner Boundary (Handle) Indicators - THE ONLY LOCKING LINES */}
                  <div className="absolute left-[12px] top-0 bottom-0 w-[2.5px] bg-[#00c2cb] shadow-[0_0_15px_#00c2cb] z-20" />
                  <div className="absolute right-[12px] top-0 bottom-0 w-[2.5px] bg-[#00c2cb] shadow-[0_0_15px_#00c2cb] z-20" />
                  
                  {/* Range text */}
                  <div className="absolute -top-1 left-[18px] text-[7px] font-black text-[#00c2cb] uppercase tracking-widest translate-y-[2px]">START</div>
                  <div className="absolute -top-1 right-[18px] text-[7px] font-black text-[#00c2cb] uppercase tracking-widest translate-y-[2px]">END</div>
                </div>
              )}

              {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
                <div 
                  key={i} 
                  className="absolute flex flex-col items-center" 
                  style={{ left: `${i * pixelsPerSecond}px` }}
                >
                  <div className="w-[1px] md:w-[1.5px] h-2 md:h-3 bg-white/30" />
                  <span className="absolute bottom-1.5 md:bottom-2 text-[7px] md:text-[8px] font-black font-mono text-white/40 tracking-tighter translate-y-6">
                    {formatTime(i)}
                  </span>
                </div>
              ))}
            </div>

          <div className="flex-1 flex flex-col py-1 md:py-2 gap-0.5 md:gap-1 min-h-0">
              {/* Render all layers with better visual separation */}
              {layers.map(layer => (
                <div key={layer} className={cn(
                  "relative flex items-center border-y border-white/[0.02] transition-colors",
                  layer === 0 ? "h-10 md:h-12 bg-white/[0.04]" : "h-8 md:h-10 bg-white/[0.01]",
                  lockedLayers.has(layer) && "pointer-events-none select-none",
                  hiddenLayers.has(layer) && "opacity-20 saturate-0"
                )}>
                  {/* Track ID / Indicator like CapCut */}
                  <div className="absolute left-[-40px] w-8 h-full flex items-center justify-center opacity-20 pointer-events-none">
                    {layer === 0 ? <Scissors className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
                  </div>
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
                            "absolute z-[160] w-6 h-6 rounded-full flex items-center justify-center transition-all -translate-x-1/2 shadow-[0_4px_12px_rgba(0,0,0,0.5)] active:scale-95 group",
                            nextClip.transitionType && nextClip.transitionType !== 'none'
                              ? "bg-white border-2 border-[#00c2cb] scale-110"
                              : "bg-white/90 border border-neutral-300 hover:bg-white hover:scale-110"
                          )}
                          style={{
                            left: `${(clip.start + clip.duration) * pixelsPerSecond}px`
                          }}
                          title="Transition"
                        >
                          {nextClip.transitionType && nextClip.transitionType !== 'none' ? (
                            <div className="flex gap-[2px]">
                               <div className="w-[3px] h-[3px] rounded-full bg-[#00c2cb]" />
                               <div className="w-[3px] h-[3px] rounded-full bg-[#00c2cb]" />
                               <div className="w-[3px] h-[3px] rounded-full bg-[#00c2cb]" />
                            </div>
                          ) : (
                            <Plus className="w-3.5 h-3.5 text-neutral-800" />
                          )}
                        </button>
                      )}
                      {layer === 0 && hasContiguousNext && (
                        <div 
                          className="absolute h-[60%] w-[1.5px] bg-white/20 z-[30] pointer-events-none rounded-full translate-y-1/2"
                          style={{ 
                            left: `${(clip.start + clip.duration) * pixelsPerSecond}px`,
                            top: '20%'
                          }}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
                {layer === 0 && (
                  <button 
                    onClick={onAddMedia}
                    className="flex-shrink-0 w-12 h-8 bg-white/5 border border-white/10 rounded-md flex items-center justify-center hover:bg-white/10 transition-all ml-1 group"
                  >
                    <Plus className="w-4 h-4 text-white/40 group-hover:text-white" />
                  </button>
                )}
              </div>
              ))}

              {/* Add Audio Placeholder - only if no audio clips yet or always? CapCut usually has it. */}
              {!clips.some(c => c.type === 'audio') && (
                <div 
                  className="relative h-10 border-y border-white/[0.02] bg-white/[0.01] flex items-center cursor-pointer hover:bg-white/[0.03] group transition-colors overflow-hidden"
                  onClick={onAddAudio}
                >
                   <div className="absolute inset-0 flex items-center px-4 gap-3">
                      <Plus className="w-3 h-3 text-white/30 group-hover:text-white" />
                      <span className="text-[9px] font-bold text-white/20 group-hover:text-white/40 uppercase tracking-tighter">Tambahkan audio</span>
                   </div>
                </div>
              )}
              {/* Add Text Placeholder - only if no text clips yet? Actually CapCut has it as a separate track often. */}
              {!clips.some(c => c.type === 'text') && (
                <div 
                  className="relative h-10 border-y border-white/[0.02] bg-white/[0.01] flex items-center cursor-pointer hover:bg-white/[0.03] group transition-colors overflow-hidden"
                  onClick={onAddText}
                >
                   <div className="absolute inset-0 flex items-center px-4 gap-3">
                      <Plus className="w-3 h-3 text-white/30 group-hover:text-white" />
                      <span className="text-[9px] font-bold text-white/20 group-hover:text-white/40 uppercase tracking-tighter">Tambahkan teks</span>
                   </div>
                </div>
              )}
          </div>
        </div>

          {/* End Spacer */}
          <div className="flex-shrink-0 w-1/2 h-full" />
        </div>
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
        isSmaller ? "h-5 md:h-6 rounded-sm" : "h-7 md:h-8 rounded-md",
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
          className="absolute inset-0 opacity-30 pointer-events-none overflow-hidden"
        >
          <div 
            className="h-full flex gap-1"
            style={{ 
              width: clip.duration * pixelsPerSecond,
              marginLeft: -clip.trimStart * pixelsPerSecond 
            }}
          >
            {Array.from({ length: Math.ceil(clip.duration / (isSmaller ? 0.5 : 1)) }).map((_, i) => (
              <img 
                key={i}
                src={clip.thumbnail || clip.src} 
                className="h-full object-cover rounded-[1px] flex-shrink-0"
                style={{ width: isSmaller ? 30 : 50 }}
              />
            ))}
          </div>
        </div>
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
