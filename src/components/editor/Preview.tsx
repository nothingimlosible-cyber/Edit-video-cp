import { Clip, AspectRatio } from '../../types/editor';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCw, RotateCcw } from 'lucide-react';
import { useRef, useEffect, useState } from 'react';
import { cn, formatTime } from '../../lib/utils';
import { getClipPropertiesAtTime } from '../../lib/editorUtils';

interface VideoClipProps {
  clip: Clip;
  currentTime: number;
  isPlaying?: boolean;
  isMuted?: boolean;
}

function VideoClip({ clip, currentTime, isPlaying, isMuted, interpolatedProps }: VideoClipProps & { interpolatedProps: any }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    
    // Set playback speed
    videoRef.current.playbackRate = clip.speed || 1;

    // Sync current time: Global Editor Time - Clip Start Time + Trim Offset
    const relativeTime = (currentTime - clip.start) * (clip.speed || 1) + (clip.trimStart || 0);
    
    // Only seek if out of sync by more than HEARTBEAT (0.3s) or if paused to prevent audio stutter
    const diff = Math.abs(videoRef.current.currentTime - relativeTime);
    if (!isPlaying || diff > 0.3) {
      videoRef.current.currentTime = relativeTime;
    }

    if (isPlaying) {
      // Browsers often block unmuted autoplay. 
      // We set muted state based on editor's mute toggle.
      videoRef.current.muted = !!isMuted;
      videoRef.current.volume = clip.volume ?? 1;
      
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (err.name === 'NotAllowedError') {
            // Keep muted if blocked
            videoRef.current!.muted = true;
            videoRef.current!.play().catch(() => {});
          }
        });
      }
    } else {
      videoRef.current.pause();
    }
  }, [currentTime, isPlaying, isMuted, clip.start, clip.trimStart, clip.speed, clip.volume]);

  const brightness = (interpolatedProps.brightness ?? 100) / 100;
  const contrast = (interpolatedProps.contrast ?? 100) / 100;
  const saturation = (interpolatedProps.saturation ?? 100) / 100;
  const hue = interpolatedProps.hue ?? 0;
  const blur = interpolatedProps.blur ?? 0;
  const sharpen = (interpolatedProps.sharpen ?? 0) / 100;
  const vignette = (interpolatedProps.vignette ?? 0) / 100;

  const clipPath = clip.maskType === 'circle' ? 'circle(50% at 50% 50%)' :
                 clip.maskType === 'rectangle' ? 'inset(10% 10% 10% 10%)' :
                 clip.maskType === 'linear' ? 'inset(0% 0% 50% 0%)' : 'none';

  return (
    <div className="relative w-full h-full" style={{ clipPath }}>
      <video 
        ref={videoRef}
        key={clip.src}
        src={clip.src} 
        preload="auto"
        className={cn(
          "relative z-10 w-full h-full object-contain pointer-events-none",
          clip.filter === 'grayscale' && "grayscale",
          clip.filter === 'sepia' && "sepia",
          clip.filter === 'vintage' && "sepia brightness-75 contrast-125",
          clip.filter === 'cold' && "hue-rotate-180 brightness-90 saturate-150",
          clip.filter === 'mirror' && "-scale-x-100",
          clip.filter === 'shake' && "animate-bounce",
          clip.filter === 'glitch' && "animate-[pulse_0.1s_infinite]",
          clip.filter === 'zoom-blur' && "blur-sm scale-110",
        )}
        playsInline
        style={{
          filter: `brightness(${brightness}) contrast(${contrast + sharpen}) saturate(${saturation}) hue-rotate(${hue}deg) blur(${blur}px)`,
          mixBlendMode: clip.blendMode ?? 'normal',
          transform: `scale(${clip.horizontalFlip ? -1 : 1}, ${clip.verticalFlip ? -1 : 1})`,
        }}
      />
      {vignette > 0 && (
        <div 
          className="absolute inset-0 z-20 pointer-events-none" 
          style={{ 
            background: `radial-gradient(circle, transparent ${100 - vignette * 50}%, rgba(0,0,0,${vignette * 0.8}) 100%)` 
          }} 
        />
      )}
    </div>
  );
}

interface PreviewProps {
  clips: Clip[];
  currentTime: number;
  selectedClipId: string | null;
  aspectRatio: AspectRatio;
  isPlaying?: boolean;
  isMuted?: boolean;
  isTransforming?: boolean;
  onTogglePlay?: () => void;
  onUpdateClip?: (id: string, updates: Partial<Clip>) => void;
  onUpdateEnd?: () => void;
}

export default function Preview({ 
  clips, 
  currentTime, 
  selectedClipId, 
  aspectRatio, 
  isPlaying, 
  isMuted,
  isTransforming,
  onTogglePlay, 
  onUpdateClip,
  onUpdateEnd
}: PreviewProps) {
  const [gestureState, setGestureState] = useState<{ scale: number, rotation: number } | null>(null);

  // Find visible clips
  const visibleClips = clips.filter(
    (clip) => currentTime >= clip.start && currentTime <= clip.start + clip.duration
  ).sort((a, b) => a.layer - b.layer);

  const getAspectRatioClasses = () => {
    switch (aspectRatio) {
      case '16:9': return 'aspect-video w-full max-w-full h-auto max-h-full';
      case '1:1': return 'aspect-square h-full max-h-full w-auto max-w-full';
      case '4:5': return 'aspect-[4/5] h-full max-h-full w-auto max-w-full';
      case '2.35:1': return 'aspect-[2.35/1] w-full max-w-full h-auto max-h-full';
      case '2:1': return 'aspect-[2/1] w-full max-w-full h-auto max-h-full';
      case '3:4': return 'aspect-[3/4] h-full max-h-full w-auto max-w-full';
      case 'original': return 'w-full h-full max-w-full max-h-full';
      case '9:16':
      default: return 'aspect-[9/16] h-full max-h-full w-auto max-w-full';
    }
  };

  const getAnimationProps = (clip: Clip) => {
    const initialProps: any = { opacity: 0 };
    const exitProps: any = { opacity: 0 };

    switch (clip.animationIn) {
      case 'fade': initialProps.opacity = 0; break;
      case 'slide-left': initialProps.x = -100; initialProps.opacity = 0; break;
      case 'slide-up': initialProps.y = 100; initialProps.opacity = 0; break;
      case 'zoom': initialProps.scale = 0.5; initialProps.opacity = 0; break;
      case 'black-flash': initialProps.filter = 'brightness(0)'; initialProps.opacity = 0; break;
      case 'white-flash': initialProps.filter = 'brightness(5)'; initialProps.opacity = 0; break;
      case 'sun-flare': initialProps.filter = 'brightness(3) sepia(0.5) hue-rotate(-20deg)'; initialProps.opacity = 0; break;
      case 'swing': initialProps.rotate = -15; initialProps.opacity = 0; break;
      case 'bounce': initialProps.scale = 0.3; initialProps.opacity = 0; break;
      case 'blur-fade': initialProps.filter = 'blur(20px)'; initialProps.opacity = 0; break;
      case 'rotate-zoom': initialProps.rotate = -45; initialProps.scale = 0.2; initialProps.opacity = 0; break;
    }
    
    switch (clip.animationOut) {
      case 'fade': exitProps.opacity = 0; break;
      case 'slide-right': exitProps.x = 100; exitProps.opacity = 0; break;
      case 'slide-down': exitProps.y = 100; exitProps.opacity = 0; break;
      case 'zoom': exitProps.scale = 0.5; exitProps.opacity = 0; break;
      case 'black-flash': exitProps.filter = 'brightness(0)'; exitProps.opacity = 0; break;
      case 'white-flash': exitProps.filter = 'brightness(5)'; exitProps.opacity = 0; break;
      case 'sun-flare': exitProps.filter = 'brightness(3) sepia(0.5) hue-rotate(-20deg)'; exitProps.opacity = 0; break;
      case 'blur-fade': exitProps.filter = 'blur(20px)'; exitProps.opacity = 0; break;
      case 'rotate-zoom': exitProps.rotate = 45; exitProps.scale = 0.2; exitProps.opacity = 0; break;
    }

    return { initialProps, exitProps };
  };

  return (
    <div 
      className={cn(
        "relative bg-black shadow-2xl rounded-sm overflow-hidden flex items-center justify-center transition-all duration-300 cursor-pointer border border-white/20",
        getAspectRatioClasses()
      )}
      onClick={onTogglePlay}
    >
      {/* Aspect Ratio Grid Guide */}
      <div className={cn(
        "absolute inset-0 z-[1] pointer-events-none transition-opacity duration-300",
        isTransforming ? "opacity-60" : "opacity-10"
      )}>
        <div className="absolute inset-0 flex">
          <div className="flex-1 border-r border-white/30" />
          <div className="flex-1 border-r border-white/30" />
          <div className="flex-1" />
        </div>
        <div className="absolute inset-0 flex flex-col">
          <div className="flex-1 border-b border-white/30" />
          <div className="flex-1 border-b border-white/30" />
          <div className="flex-1" />
        </div>
      </div>
      <AnimatePresence mode="popLayout">
        {visibleClips.length > 0 ? (
          visibleClips.map((clip) => {
            const props = getClipPropertiesAtTime(clip, currentTime);
            const { initialProps, exitProps } = getAnimationProps(clip);
            
            return (
              <motion.div
                key={clip.id}
                initial={initialProps}
                animate={{ 
                  opacity: props.opacity,
                  scale: (props.scale ?? 1),
                  x: (props.x ?? 0),
                  y: (props.y ?? 0),
                  rotate: props.rotation || 0,
                  filter: clip.animationIn === 'blur-fade' || clip.animationOut === 'blur-fade' ? 'blur(0px)' : 'none'
                }}
                exit={{
                  ...exitProps,
                  transition: { duration: clip.animationOutDuration || 0.4 }
                }}
                transition={{ 
                  type: clip.animationIn === 'bounce' ? 'spring' : 'tween',
                  stiffness: clip.animationIn === 'bounce' ? 300 : 100,
                  damping: clip.animationIn === 'bounce' ? 15 : 20,
                  duration: clip.animationInDuration || 0.4,
                  ease: "easeOut"
                }}
                onPointerDown={(e) => {
                  if (selectedClipId !== clip.id) return;
                  const el = e.currentTarget;
                  
                  // Use a ref-like object to track gesture state within the closure
                  const state = {
                    touches: new Map<number, { x: number, y: number }>(),
                    initialScale: props.scale ?? 1,
                    initialRotation: props.rotation ?? 0,
                    initialX: props.x ?? 0,
                    initialY: props.y ?? 0,
                    initialDist: 0,
                    initialAngle: 0,
                    startX: e.clientX,
                    startY: e.clientY
                  };

                  state.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
                  el.setPointerCapture(e.pointerId);

                  const handlePointerMove = (moveEvent: PointerEvent) => {
                    state.touches.set(moveEvent.pointerId, { x: moveEvent.clientX, y: moveEvent.clientY });
                    const coords = Array.from(state.touches.values());
                    
                    if (coords.length === 1) {
                      // Single finger move
                      const deltaX = moveEvent.clientX - state.startX;
                      const deltaY = moveEvent.clientY - state.startY;
                      if (onUpdateClip) {
                        onUpdateClip(clip.id, { 
                          x: state.initialX + deltaX,
                          y: state.initialY + deltaY
                        });
                      }
                    } else if (coords.length === 2) {
                      // Multi-finger pinch/rotate
                      const p1 = coords[0];
                      const p2 = coords[1];
                      
                      const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
                      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;

                      if (state.initialDist === 0) {
                        state.initialDist = dist;
                        state.initialAngle = angle;
                        // Use the precise current properties at this exact frame
                        const currentProps = getClipPropertiesAtTime(clip, currentTime);
                        state.initialScale = currentProps.scale ?? 1;
                        state.initialRotation = currentProps.rotation ?? 0;
                        return;
                      }

                      const scaleDelta = dist / state.initialDist;
                      const rotationDelta = angle - state.initialAngle;

                      if (onUpdateClip) {
                        const newScale = Math.max(0.01, state.initialScale * scaleDelta);
                        let newRotation = Math.round(state.initialRotation + rotationDelta);
                        
                        // Snapping rotation
                        const snapThreshold = 5;
                        const snaps = [0, 90, 180, 270, 360, -90, -180, -270];
                        for (const snap of snaps) {
                          if (Math.abs(newRotation - snap) < snapThreshold) {
                            newRotation = snap;
                            break;
                          }
                        }

                        setGestureState({ scale: newScale, rotation: newRotation });
                        onUpdateClip(clip.id, {
                          scale: newScale,
                          rotation: newRotation % 360
                        });
                      }
                    }
                  };

                  const handlePointerUp = (upEvent: PointerEvent) => {
                    state.touches.delete(upEvent.pointerId);
                    if (state.touches.size === 0) {
                      setGestureState(null);
                      el.releasePointerCapture(upEvent.pointerId);
                      el.removeEventListener('pointermove', handlePointerMove as any);
                      el.removeEventListener('pointerup', handlePointerUp as any);
                      if (onUpdateEnd) onUpdateEnd();
                    } else {
                      // Reset for remaining fingers
                      state.initialDist = 0;
                      state.initialAngle = 0;
                    }
                  };

                  el.addEventListener('pointermove', handlePointerMove as any);
                  el.addEventListener('pointerup', handlePointerUp as any);
                  el.addEventListener('pointercancel', handlePointerUp as any);
                }}
                className={cn(
                  "absolute inset-0 flex items-center justify-center touch-none transition-shadow duration-300",
                  selectedClipId === clip.id && "z-50",
                  clip.type === 'video' || clip.type === 'photo' ? "w-full h-full" : "w-auto h-auto"
                )}
                style={{
                  zIndex: clip.layer,
                }}
              >
                {/* Audio Fade Logic (Visual Overlay for feedback) */}
                {(clip.fadeInDuration || 0) > 0 && currentTime - clip.start < (clip.fadeInDuration || 0) && (
                   <div className="absolute inset-0 bg-black pointer-events-none z-[100]" style={{ opacity: 1 - ((currentTime - clip.start) / (clip.fadeInDuration || 1)) }} />
                )}
                {(clip.fadeOutDuration || 0) > 0 && (clip.start + clip.duration - currentTime) < (clip.fadeOutDuration || 0) && (
                   <div className="absolute inset-0 bg-black pointer-events-none z-[100]" style={{ opacity: 1 - ((clip.start + clip.duration - currentTime) / (clip.fadeOutDuration || 1)) }} />
                )}

                {selectedClipId === clip.id && (
                  <div className="absolute inset-[-2px] border-2 border-white/80 rounded pointer-events-none z-[60]" />
                )}
                {clip.type === 'video' || clip.type === 'photo' ? (
                  <div className="w-full h-full relative overflow-hidden flex items-center justify-center">
                    {clip.backgroundMode === 'blur' && (
                      <div className="absolute inset-0">
                        <img 
                          src={clip.src} 
                          alt="Blur background" 
                          className="w-full h-full object-cover blur-2xl opacity-50 scale-110"
                        />
                      </div>
                    )}
                      {clip.type === 'video' ? (
                        <VideoClip 
                          clip={clip} 
                          currentTime={currentTime} 
                          isPlaying={isPlaying} 
                          isMuted={isMuted}
                          interpolatedProps={props}
                        />
                      ) : (
                        <div className="relative w-full h-full" style={{ clipPath: clip.maskType === 'circle' ? 'circle(50% at 50% 50%)' : clip.maskType === 'rectangle' ? 'inset(10% 10% 10% 10%)' : clip.maskType === 'linear' ? 'inset(0% 0% 50% 0%)' : 'none' }}>
                          <img 
                            src={clip.src} 
                            alt="Clip content" 
                            className={cn(
                              "relative z-10 w-full h-full object-contain pointer-events-none",
                              clip.chromaKey && "[filter:contrast(1.5)_brightness(1.2)_saturate(1.5)_hue-rotate(90deg)_opacity(0.9)] [mix-blend-mode:screen]",
                              clip.filter === 'grayscale' && "grayscale",
                              clip.filter === 'sepia' && "sepia",
                              clip.filter === 'vintage' && "sepia brightness-75 contrast-125",
                              clip.filter === 'cold' && "hue-rotate-180 brightness-90 saturate-150",
                              clip.filter === 'mirror' && "-scale-x-100",
                              clip.filter === 'shake' && "animate-bounce",
                              clip.filter === 'glitch' && "animate-[pulse_0.1s_infinite]",
                              clip.filter === 'zoom-blur' && "blur-sm scale-110",
                            )} 
                            style={{
                              filter: (clip.chromaKey ? `contrast(1.5) brightness(1.2) ` : '') + 
                                `brightness(${(props.brightness ?? 100) / 100}) contrast(${((props.contrast ?? 100) + (props.sharpen ?? 0)) / 100}) saturate(${(props.saturation ?? 100) / 100}) hue-rotate(${props.hue ?? 0}deg) blur(${props.blur ?? 0}px)`,
                              mixBlendMode: clip.blendMode ?? 'normal',
                              transform: `scale(${clip.horizontalFlip ? -1 : 1}, ${clip.verticalFlip ? -1 : 1})`,
                            }}
                          />
                          {(props.vignette ?? 0) > 0 && (
                            <div 
                              className="absolute inset-0 z-20 pointer-events-none" 
                              style={{ 
                                background: `radial-gradient(circle, transparent ${100 - (props.vignette || 0) * 0.5}%, rgba(0,0,0,${(props.vignette || 0) / 100 * 0.8}) 100%)` 
                              }} 
                            />
                          )}
                        </div>
                      )}
                  </div>
                ) : clip.type === 'text' ? (
                  <div className={cn(
                    "px-4 py-2 text-xl rounded transition-all text-center",
                    clip.textStyle === 'bold-white' && "text-white font-bold",
                    clip.textStyle === 'white-shadow' && "text-white font-bold [text-shadow:2px_2px_4px_rgba(0,0,0,0.8)]",
                    clip.textStyle === 'black-shadow' && "text-black font-bold [text-shadow:1px_1px_2px_white]",
                    clip.textStyle === 'glow' && "text-white font-bold [text-shadow:0_0_10px_white,0_0_20px_white]",
                    (!clip.textStyle || clip.textStyle === 'bold-white') && "bg-black/40"
                  )}>
                    {clip.text}
                  </div>
                ) : null}
              </motion.div>
            );
          })
        ) : (
          <div className="flex flex-col items-center gap-4 opacity-20">
             <div className="w-32 h-64 border-2 border-dashed border-white rounded-xl" />
             <span className="text-xs font-bold tracking-widest uppercase">Preview Area</span>
          </div>
        )}
      </AnimatePresence>

      {/* Gesture Feedback Overlay */}
      <AnimatePresence>
        {gestureState && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-10 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex gap-4 z-[200] pointer-events-none"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase text-white/40">Skala</span>
              <span className="text-[10px] font-black text-white">{(gestureState.scale * 100).toFixed(0)}%</span>
            </div>
            <div className="w-[1px] h-3 bg-white/10 self-center" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase text-white/40">Putar</span>
              <span className="text-[10px] font-black text-white">{gestureState.rotation}°</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
