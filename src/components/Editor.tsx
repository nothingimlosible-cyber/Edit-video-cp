import React, { useState, useRef, useEffect } from 'react';
import { X, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Target, Play, Pause, Undo, Redo, RotateCcw, RotateCw, Maximize2, Scissors, Music, Type, Plus, Wand2, Layers, Smile, MessageSquare, Filter, Sliders, Settings, Volume2, FastForward, Diamond, Droplets, Sun, Contrast, Zap, FlipHorizontal, FlipVertical, Copy, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Project, Clip, Keyframe } from '../types/editor';
import { cn, formatTime } from '../lib/utils';
import { getClipPropertiesAtTime } from '../lib/editorUtils';
import Timeline from './editor/Timeline';
import Preview from './editor/Preview';
import Toolbar from './editor/Toolbar';
import KeyframePanel from './editor/KeyframePanel';

interface EditorProps {
  project: Project;
  onBack: () => void;
}

export default function Editor({ project, onBack }: EditorProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [clips, setClips] = useState<Clip[]>(project.clips);
  
  const clipsRef = useRef<Clip[]>(clips);
  useEffect(() => {
    clipsRef.current = clips;
  }, [clips]);

  const [history, setHistory] = useState<Clip[][]>([JSON.parse(JSON.stringify(project.clips))]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const pushToHistory = (newClips: Clip[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(newClips)));
    if (newHistory.length > 50) {
      newHistory.shift();
      setHistoryIndex(newHistory.length - 1);
    } else {
      setHistoryIndex(newHistory.length - 1);
    }
    setHistory(newHistory);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const prevClips = JSON.parse(JSON.stringify(history[prevIndex]));
      setClips(prevClips);
      setHistoryIndex(prevIndex);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const nextClips = JSON.parse(JSON.stringify(history[nextIndex]));
      setClips(nextClips);
      setHistoryIndex(nextIndex);
    }
  };

  // Dynamic duration calculation: Match the exact end of the last clip
  const totalDuration = clips.length > 0 
    ? clips.reduce((max, clip) => Math.max(max, clip.start + clip.duration), 0)
    : 0;

  const [aspectRatio, setAspectRatio] = useState<Project['aspectRatio']>(project.aspectRatio);
  const [activeTab, setActiveTab] = useState<string>('edit');
  const [showSubMenu, setShowSubMenu] = useState(false);
  
  const selectedClip = clips.find(c => c.id === selectedClipId);
  const isOverlay = selectedClip && (selectedClip.layer > 0 || selectedClip.type === 'text');

  const pushToHistoryWithDebounce = useRef<any>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<'video' | 'photo' | 'audio'>('video');
  const [showExportDrawer, setShowExportDrawer] = useState(false);
  const [exportRes, setExportRes] = useState('1080p');
  const [exportFps, setExportFps] = useState(30);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const triggerDownload = () => {
    const data = {
      project: project.name,
      clipsCount: clips.length,
      duration: totalDuration,
      aspectRatio,
      resolution: exportRes,
      fps: exportFps,
      timestamp: new Date().toISOString(),
      clips: clips.map(c => ({ id: c.id, type: c.type, duration: c.duration, filter: c.filter }))
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.name.replace(/\s+/g, '_')}_final_video.mov`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    setIsExporting(true);
    setExportProgress(0);
    
    const duration = 2000; // 2 seconds simulation
    const startTime = Date.now();
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(Math.round((elapsed / duration) * 100), 100);
      setExportProgress(progress);
      
      if (progress === 100) {
        clearInterval(interval);
        setTimeout(() => {
          setIsExporting(false);
          triggerDownload();
          setShowExportDrawer(false);
        }, 300);
      }
    }, 100);
  };

  // Playback timer
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= totalDuration) {
            setIsPlaying(false);
            return totalDuration;
          }
          return prev + 0.1;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, totalDuration]);

  const handleToggleKeyframe = () => {
    if (!selectedClipId) return;
    const clip = clips.find(c => c.id === selectedClipId);
    if (!clip) return;

    const timeInClip = currentTime - clip.start;
    if (timeInClip < 0 || timeInClip > clip.duration) return;

    const existingIndex = clip.keyframes?.findIndex(k => Math.abs(k.time - timeInClip) < 0.1) ?? -1;
    
    let nextClips;
    if (existingIndex >= 0) {
      // Remove keyframe
      nextClips = clips.map(c => c.id === selectedClipId ? {
        ...c,
        keyframes: (c.keyframes || []).filter((_, i) => i !== existingIndex)
      } : c);
    } else {
      // Use interpolated properties at current time as base for new keyframe
      const currentProps = getClipPropertiesAtTime(clip, currentTime);
      
      const newKeyframe: Keyframe = {
        time: timeInClip,
        scale: currentProps.scale,
        x: currentProps.x,
        y: currentProps.y,
        rotation: currentProps.rotation || 0,
        opacity: currentProps.opacity
      };
      nextClips = clips.map(c => c.id === selectedClipId ? {
        ...c,
        keyframes: [...(c.keyframes || []), newKeyframe].sort((a, b) => a.time - b.time)
      } : c);
    }
    
    setClips(nextClips);
    pushToHistory(nextClips);
  };

  const handleSplit = () => {
    let targetClipId = selectedClipId;
    
    // If selected clip is NOT under playhead or no selection, find what is under playhead
    const clipAtPlayhead = clips.find(c => c.layer === 0 && currentTime >= c.start && currentTime < c.start + c.duration);
    
    if (!targetClipId || (clipAtPlayhead && targetClipId !== clipAtPlayhead.id && (currentTime < (clips.find(c => c.id === targetClipId)?.start || 0) || currentTime > (clips.find(c => c.id === targetClipId)?.start || 0) + (clips.find(c => c.id === targetClipId)?.duration || 0)))) {
       if (clipAtPlayhead) targetClipId = clipAtPlayhead.id;
    }

    if (!targetClipId) return;
    const clip = clips.find(c => c.id === targetClipId);
    if (!clip) return;

    const relativeTime = currentTime - clip.start;
    // Allow very small splits if needed, but guard against logic errors
    if (relativeTime < 0.01 || relativeTime > clip.duration - 0.01) return;

    const speedAdjustedRelative = relativeTime * clip.speed;

    const firstHalf: Clip = {
      ...clip,
      duration: relativeTime,
      keyframes: clip.keyframes.filter(k => k.time < relativeTime)
    };
    const secondHalf: Clip = {
      ...clip,
      id: Math.random().toString(36).substring(7),
      start: currentTime,
      duration: clip.duration - relativeTime,
      trimStart: clip.trimStart + speedAdjustedRelative,
      keyframes: clip.keyframes
        .filter(k => k.time >= relativeTime)
        .map(k => ({ ...k, time: k.time - relativeTime }))
    };

    let nextClips = clips.filter(c => c.id !== targetClipId);
    let finalClips = [...nextClips, firstHalf, secondHalf];
    
    // Magnetic Logic: Ensure no gaps on Layer 0 (Primary Track)
    if (clip.layer === 0) {
      const layer0 = finalClips.filter(c => c.layer === 0).sort((a, b) => a.start - b.start);
      let cumulativeStart = 0;
      const updatedLayer0 = layer0.map(c => {
        const updated = { ...c, start: cumulativeStart };
        cumulativeStart += c.duration;
        return updated;
      });
      
      finalClips = finalClips.map(c => {
        if (c.layer === 0) {
          return updatedLayer0.find(u => u.id === c.id) || c;
        }
        return c;
      });
    }
    
    setClips(finalClips);
    pushToHistory(finalClips);
    setSelectedClipId(secondHalf.id); // Select the second part immediately for further splitting
  };

  const handleAddMedia = () => {
    setUploadType('video');
    fileInputRef.current?.click();
  };

  const handleAddOverlay = () => {
    setUploadType('photo');
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const type = file.type.startsWith('video') ? 'video' : file.type.startsWith('image') ? 'photo' : file.type.startsWith('audio') ? 'audio' : 'video';
    
    const addClipWithDuration = (detectedDuration: number) => {
      const lastClipOnMainTrack = clips
        .filter(c => c.layer === 0)
        .reduce((max, clip) => Math.max(max, clip.start + clip.duration), 0);

      const isMainTrack = uploadType === 'video';
      const startTime = isMainTrack ? lastClipOnMainTrack : currentTime;

      const newClip: Clip = {
        id: Date.now().toString(),
        type: type as any,
        src: url,
        thumbnail: type === 'photo' ? url : type === 'audio' ? 'https://cdn-icons-png.flaticon.com/512/461/461238.png' : 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=200&auto=format&fit=crop',
        start: startTime,
        duration: detectedDuration,
        trimStart: 0,
        speed: 1,
        layer: type === 'audio' ? -1 : uploadType === 'photo' ? 1 : 0,
        scale: (type === 'photo' && uploadType === 'photo') ? 0.5 : 1,
        x: 0,
        y: 0,
        rotation: 0,
        opacity: 1,
        keyframes: [],
        animationIn: 'none',
        animationOut: 'none'
      };

      const nextClips = [...clips, newClip].sort((a, b) => a.start - b.start);
      setClips(nextClips);
      pushToHistory(nextClips);
      setSelectedClipId(newClip.id);
    };

    if (type === 'video') {
      const video = document.createElement('video');
      video.src = url;
      video.onloadedmetadata = () => addClipWithDuration(video.duration);
    } else if (type === 'audio') {
      const audio = new Audio(url);
      audio.onloadedmetadata = () => addClipWithDuration(audio.duration);
    } else {
      addClipWithDuration(3);
    }
    
    e.target.value = '';
  };

  const handleAddText = () => {
    const newClip: Clip = {
      id: Date.now().toString(),
      type: 'text',
      src: '',
      text: 'TEKS BARU',
      textStyle: 'bold-white',
      start: currentTime,
      duration: 3,
      trimStart: 0,
      speed: 1,
      layer: 1, // Text defaults to layer 1
      scale: 1,
      x: 0,
      y: 0,
      opacity: 1,
      keyframes: []
    };
    const nextClips = [...clips, newClip].sort((a, b) => a.start - b.start);
    setClips(nextClips);
    pushToHistory(nextClips);
    setSelectedClipId(newClip.id);
  };

  const handleAddSticker = () => {
    const newClip: Clip = {
      id: Date.now().toString(),
      type: 'photo',
      src: 'https://cdn-icons-png.flaticon.com/512/742/742751.png', // Happy face sticker
      thumbnail: 'https://cdn-icons-png.flaticon.com/512/742/742751.png',
      start: currentTime,
      duration: 3,
      trimStart: 0,
      speed: 1,
      layer: 2,
      scale: 0.3,
      x: 50,
      y: 50,
      opacity: 1,
      keyframes: []
    };
    const nextClips = [...clips, newClip].sort((a, b) => a.start - b.start);
    setClips(nextClips);
    pushToHistory(nextClips);
    setSelectedClipId(newClip.id);
  };

  const handleAddAudio = () => {
    setUploadType('audio');
    fileInputRef.current?.click();
  };

  const handleUpdateClip = (id: string | null, updates: Partial<Clip>) => {
    if (!id) return;
    const targetClip = clips.find(c => c.id === id);
    if (!targetClip) return;

    // Handle speed-duration relation
    if (updates.speed !== undefined && updates.speed !== targetClip.speed && targetClip.type === 'video') {
      const speedRatio = targetClip.speed / updates.speed;
      updates.duration = targetClip.duration * speedRatio;
    }

    let nextClips = clips.map(c => {
      if (c.id === id) {
        // Broad transformation and visual adjustment properties for auto-keyframing
        const keyframeableProps = ['x', 'y', 'scale', 'rotation', 'opacity', 'brightness', 'contrast', 'saturation', 'hue', 'blur', 'sharpen', 'vignette'];
        const isKeyframeUpdate = Object.keys(updates).some(k => keyframeableProps.includes(k));
        
        if (isKeyframeUpdate && c.keyframes.length > 0) {
          const relativeTime = currentTime - c.start;
          const currentProps = getClipPropertiesAtTime(c, currentTime) as any;
          const existingKfIndex = c.keyframes.findIndex(kf => Math.abs(kf.time - relativeTime) < 0.1);
          
          let newKeyframes = [...c.keyframes];
          if (existingKfIndex >= 0) {
            newKeyframes[existingKfIndex] = { ...newKeyframes[existingKfIndex], ...updates as any };
          } else {
            // Add new keyframe with current interpolated values + all defined updates
            const newKeyframe: Keyframe = {
              time: relativeTime,
              x: updates.x ?? currentProps.x,
              y: updates.y ?? currentProps.y,
              scale: updates.scale ?? currentProps.scale,
              rotation: updates.rotation ?? currentProps.rotation ?? 0,
              opacity: updates.opacity ?? currentProps.opacity,
              brightness: updates.brightness ?? currentProps.brightness ?? 100,
              contrast: updates.contrast ?? currentProps.contrast ?? 100,
              saturation: updates.saturation ?? currentProps.saturation ?? 100,
              hue: updates.hue ?? currentProps.hue ?? 0,
              blur: updates.blur ?? currentProps.blur ?? 0,
              ...updates as any
            };
            newKeyframes.push(newKeyframe);
            newKeyframes.sort((a, b) => a.time - b.time);
          }
          return { ...c, keyframes: newKeyframes };
        }
        
        // Default behavior: update base properties
        return { ...c, ...updates };
      }
      return c;
    });
    
    // Magnetic Timeline Logic for Layer 0 (Primary Track)
    const updatedTarget = nextClips.find(c => c.id === id);
    if (updatedTarget && updatedTarget.layer === 0) {
      const layer0Clips = nextClips.filter(c => c.layer === 0).sort((a, b) => a.start - b.start);
      
      let currentStart = 0;
      const updatedLayer0 = layer0Clips.map(clip => {
        const updated = { ...clip, start: currentStart };
        currentStart += clip.duration;
        return updated;
      });

      nextClips = nextClips.map(c => {
        if (c.layer === 0) {
          return updatedLayer0.find(u => u.id === c.id) || c;
        }
        return c;
      });
    }

    setClips(nextClips);
  };

  const handleReorderClips = (draggedId: string, overId: string) => {
    const draggedClip = clips.find(c => c.id === draggedId);
    const overClip = clips.find(c => c.id === overId);
    if (!draggedClip || !overClip || draggedClip.layer !== overClip.layer) return;

    const currentLayer = draggedClip.layer;
    const sameLayerClips = [...clips.filter(c => c.layer === currentLayer)].sort((a, b) => a.start - b.start);
    
    const draggedIndex = sameLayerClips.findIndex(c => c.id === draggedId);
    const overIndex = sameLayerClips.findIndex(c => c.id === overId);
    
    if (draggedIndex === -1 || overIndex === -1) return;

    // Rearrange the sequence
    const updatedOrder = [...sameLayerClips];
    updatedOrder.splice(draggedIndex, 1);
    updatedOrder.splice(overIndex, 0, draggedClip);

    let nextClips: Clip[];
    if (currentLayer === 0) {
      // Magnetic Timeline: Recalculate all starts on Layer 0 to be contiguous
      let currentStart = 0;
      const updatedLayer0 = updatedOrder.map(c => {
         const updated = { ...c, start: currentStart };
         currentStart += c.duration;
         return updated;
      });
      
      nextClips = clips.map(c => {
        if (c.layer === 0) {
          return updatedLayer0.find(u => u.id === c.id) || c;
        }
        return c;
      });
    } else {
      // For overlays, just swap their starts for now if a swap was triggered
      const tempStart = draggedClip.start;
      const updatedDragged = { ...draggedClip, start: overClip.start };
      const updatedOver = { ...overClip, start: tempStart };
      
      nextClips = clips.map(c => {
        if (c.id === draggedId) return updatedDragged;
        if (c.id === overId) return updatedOver;
        return c;
      });
    }

    setClips(nextClips);
  };

  const handleDelete = () => {
    if (!selectedClipId) return;
    let nextClips = clips.filter(c => c.id !== selectedClipId);
    
    // Ripple Layer 0 after deletion
    const layer0Clips = nextClips.filter(c => c.layer === 0).sort((a, b) => a.start - b.start);
    let currentStart = 0;
    layer0Clips.forEach(clip => {
      clip.start = currentStart;
      currentStart += clip.duration;
    });

    nextClips = nextClips.map(c => {
      if (c.layer === 0) {
        return layer0Clips.find(u => u.id === c.id) || c;
      }
      return c;
    });

    setClips(nextClips);
    pushToHistory(nextClips);
    setSelectedClipId(null);
  };
  
  const handleCopy = () => {
    if (!selectedClipId) return;
    const clip = clips.find(c => c.id === selectedClipId);
    if (!clip) return;

    const newId = Math.random().toString(36).substring(7);
    const newClip: Clip = {
      ...JSON.parse(JSON.stringify(clip)),
      id: newId,
      start: clip.layer === 0 ? clip.start + clip.duration : clip.start + 0.5,
    };

    let nextClips = [...clips, newClip];
    
    // Magnetic Logic if on layer 0
    if (clip.layer === 0) {
      const layer0 = nextClips.filter(c => c.layer === 0).sort((a,b) => a.start - b.start);
      let cumulativeStart = 0;
      const updatedLayer0 = layer0.map(c => {
        const updated = { ...c, start: cumulativeStart };
        cumulativeStart += c.duration;
        return updated;
      });
      nextClips = nextClips.map(c => c.layer === 0 ? (updatedLayer0.find(u => u.id === c.id) || c) : c);
    }

    setClips(nextClips);
    pushToHistory(nextClips);
    setSelectedClipId(newId);
  };

  const handleUpdateKeyframe = (keyframe: Keyframe) => {
    if (!selectedClipId) return;
    const nextClips = clips.map(clip => {
      if (clip.id === selectedClipId) {
        const existingKfIndex = clip.keyframes.findIndex(kf => Math.abs(kf.time - keyframe.time) < 0.1);
        let newKeyframes = [...clip.keyframes];
        if (existingKfIndex >= 0) {
          newKeyframes[existingKfIndex] = { ...newKeyframes[existingKfIndex], ...keyframe };
        } else {
          newKeyframes.push(keyframe);
        }
        return { ...clip, keyframes: newKeyframes.sort((a, b) => a.time - b.time) };
      }
      return clip;
    });
    setClips(nextClips);
    pushToHistory(nextClips);
  };

  const handleRemoveKeyframe = (time: number) => {
    if (!selectedClipId) return;
    const nextClips = clips.map(clip => {
      if (clip.id === selectedClipId) {
        return { ...clip, keyframes: clip.keyframes.filter(kf => Math.abs(kf.time - time) >= 0.1) };
      }
      return clip;
    });
    setClips(nextClips);
    pushToHistory(nextClips);
  };

  return (
    <div className="flex flex-col h-screen h-[100dvh] bg-[#050505] overflow-hidden" ref={editorRef}>
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept={uploadType === 'audio' ? "audio/*" : uploadType === 'photo' ? "image/*" : "video/*,image/*"}
        onChange={handleFileSelect}
      />
      {/* Header - Fixed height */}
      <header className="flex-shrink-0 h-14 px-3 flex items-center justify-between border-b border-[#222] bg-black z-[100]">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1 text-[#666] hover:text-white transition-colors">
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
          <div className="flex flex-col">
            <span className="text-lg text-title">EDITOR</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <button 
            onClick={undo}
            disabled={historyIndex === 0}
            className={cn(
              "transition-all",
              historyIndex === 0 ? "text-[#222]" : "text-white hover:scale-110"
            )}
           >
            <Undo className="w-4 h-4" />
           </button>
           <button 
            onClick={redo}
            disabled={historyIndex === history.length - 1}
            className={cn(
              "transition-all",
              historyIndex === history.length - 1 ? "text-[#222]" : "text-white hover:scale-110"
            )}
           >
            <Redo className="w-4 h-4" />
           </button>
           <button 
            onClick={() => setShowExportDrawer(true)}
            className="btn-bold !px-3 !py-1 text-[10px]"
          >
            Export
          </button>
        </div>
      </header>

      {/* Export Overlay */}
      <AnimatePresence>
        {showExportDrawer && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6"
          >
            <div className="w-full max-w-md bg-[#050505] border border-white/10 rounded-3xl p-8 flex flex-col gap-8 shadow-2xl">
              {!isExporting ? (
                <>
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-black tracking-tighter text-white">EXPORT VIDEO</h2>
                    <button onClick={() => setShowExportDrawer(false)} className="p-2 text-white/40 hover:text-white transition-colors">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase text-white/30 tracking-[0.3em]">Resolusi</label>
                      <div className="flex gap-2">
                        {['720p', '1080p', '4K'].map(res => (
                          <button 
                            key={res}
                            onClick={() => setExportRes(res)}
                            className={cn(
                              "flex-1 py-3 rounded-xl border font-black text-[10px] tracking-widest transition-all",
                              exportRes === res ? "bg-white text-black border-white" : "border-white/10 text-white/40 bg-white/5"
                            )}
                          >
                            {res}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase text-white/30 tracking-[0.3em]">Frame Rate</label>
                      <div className="flex gap-2">
                        {[24, 30, 60].map(fps => (
                          <button 
                            key={fps}
                            onClick={() => setExportFps(fps)}
                            className={cn(
                              "flex-1 py-3 rounded-xl border font-black text-[10px] tracking-widest transition-all",
                              exportFps === fps ? "bg-white text-black border-white" : "border-white/10 text-white/40 bg-white/5"
                            )}
                          >
                            {fps}FPS
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={handleExport}
                    className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase tracking-[0.2em] text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-white/5"
                  >
                    Simpan ke Galeri
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center py-12 gap-10">
                   <div className="relative w-32 h-32 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90">
                        <circle cx="64" cy="64" r="60" fill="none" stroke="currentColor" strokeWidth="8" className="text-white/5" />
                        <circle cx="64" cy="64" r="60" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray={377} strokeDashoffset={377 - (377 * exportProgress) / 100} className="text-white transition-all duration-300" />
                      </svg>
                      <span className="absolute text-2xl font-black font-mono text-white">{exportProgress}%</span>
                   </div>
                   <div className="flex flex-col items-center gap-3">
                     <span className="text-[12px] font-black uppercase tracking-[0.6em] text-white animate-pulse">Rendering</span>
                     <span className="text-[10px] font-medium text-white/30 text-center tracking-wider">Harap jangan tutup aplikasi atau beralih tugas</span>
                   </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Area - Maximized */}
      <div className="flex-1 min-h-0 flex flex-col bg-black overflow-hidden relative justify-center">
        <div className="flex-1 relative flex items-center justify-center p-0 overflow-hidden bg-black">
          <Preview 
            clips={clips} 
            currentTime={currentTime} 
            selectedClipId={selectedClipId} 
            aspectRatio={aspectRatio}
            isPlaying={isPlaying}
            isMuted={isMuted}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            onUpdateClip={handleUpdateClip}
            onUpdateEnd={() => pushToHistory(clipsRef.current)}
          />
        </div>

        {/* Playback & Time Info */}
        <div className="flex-shrink-0 px-4 py-2 flex items-center bg-black/80 border-t border-[#111] backdrop-blur-md">
           <div className="flex-1 flex items-center gap-2">
              <span className="text-[10px] font-black font-mono text-white/90">
                {formatTime(currentTime)}
              </span>
              <span className="text-[10px] font-black font-mono text-[#444]">/</span>
              <span className="text-[10px] font-black font-mono text-[#444]">
                {formatTime(totalDuration)}
              </span>
           </div>

           <div className="flex-shrink-0">
             <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className={cn(
                "w-12 h-12 flex items-center justify-center active:scale-95 transition-transform bg-white/10 rounded-full",
                !isPlaying && "pl-1"
              )}
            >
              {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white" />}
            </button>
           </div>

           <div className="flex-1 flex items-center justify-end gap-2">
              {selectedClipId && (
                <div className="flex items-center bg-white/5 rounded-full p-1 border border-white/10 shadow-2xl">
                   <button 
                    onClick={() => {
                      const clip = clips.find(c => c.id === selectedClipId);
                      if (!clip || !clip.keyframes) return;
                      const kfs = [...clip.keyframes].sort((a,b) => b.time - a.time);
                      const relativeTime = currentTime - clip.start;
                      const prev = kfs.find(k => k.time < relativeTime - 0.1);
                      if (prev) setCurrentTime(clip.start + prev.time);
                    }}
                    className="p-2 text-white/40 hover:text-white transition-colors"
                   >
                     <ChevronLeft className="w-4 h-4" />
                   </button>
                   
                   <button 
                    onClick={handleToggleKeyframe}
                    className={cn(
                      "w-10 h-10 flex items-center justify-center rounded-full transition-all border shadow-lg",
                      clips.find(c => c.id === selectedClipId)?.keyframes.some(k => Math.abs(k.time - (currentTime - (clips.find(c => c.id === selectedClipId)?.start || 0))) < 0.1)
                        ? "bg-white text-black border-white scale-110"
                        : "bg-black/60 text-white border-white/20 hover:scale-105"
                    )}
                  >
                    <div className="relative">
                      <Diamond className="w-5 h-5 fill-current" />
                      <div className={cn(
                        "absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-black border",
                        clips.find(c => c.id === selectedClipId)?.keyframes.some(k => Math.abs(k.time - (currentTime - (clips.find(c => c.id === selectedClipId)?.start || 0))) < 0.1)
                          ? "bg-red-500 text-white border-white"
                          : "bg-white text-black border-black"
                      )}>
                        {clips.find(c => c.id === selectedClipId)?.keyframes.some(k => Math.abs(k.time - (currentTime - (clips.find(c => c.id === selectedClipId)?.start || 0))) < 0.1) ? '-' : '+'}
                      </div>
                    </div>
                  </button>

                  <button 
                    onClick={() => {
                      const clip = clips.find(c => c.id === selectedClipId);
                      if (!clip || !clip.keyframes) return;
                      const kfs = [...clip.keyframes].sort((a,b) => a.time - b.time);
                      const relativeTime = currentTime - clip.start;
                      const next = kfs.find(k => k.time > relativeTime + 0.1);
                      if (next) setCurrentTime(clip.start + next.time);
                    }}
                    className="p-2 text-white/40 hover:text-white transition-colors"
                   >
                     <RotateCw className="w-4 h-4 rotate-180" />
                   </button>
                </div>
              )}
              <Maximize2 className="w-4 h-4 text-[#444] ml-2" />
           </div>
        </div>
      </div>

      {/* Timeline Section - Optimized height */}
      <div className="flex-shrink-0 h-[160px] flex flex-col bg-black border-t border-[#222] z-10">
        <div className="flex-1 relative overflow-hidden">
          <Timeline 
            clips={clips}
            currentTime={currentTime}
            duration={totalDuration}
            onTimeChange={setCurrentTime}
            selectedClipId={selectedClipId}
            onClipSelect={(id) => {
              setSelectedClipId(id);
              if (id) setActiveTab('edit');
            }}
            onAddMedia={handleAddMedia}
            onAddText={handleAddText}
            onSplit={handleSplit}
            onUpdateClip={handleUpdateClip}
            onUpdateEnd={() => pushToHistory(clipsRef.current)}
            onTabChange={setActiveTab}
            onReorderClips={handleReorderClips}
            isMuted={isMuted}
            onToggleMute={() => setIsMuted(!isMuted)}
          />
        </div>
      </div>

      {/* Toolbar Area - Slightly taller with more safety padding */}
      <div className="flex-shrink-0 h-[calc(88px+env(safe-area-inset-bottom))] bg-black border-t border-white/5 z-[200] pb-[calc(20px+env(safe-area-inset-bottom))]">
          <Toolbar 
            activeTab={activeTab}
            onSplit={handleSplit}
            onCopy={handleCopy}
            onAddText={handleAddText}
            onAddOverlay={handleAddOverlay}
            onAddSticker={handleAddSticker}
            onAddAudio={handleAddAudio}
            onAddMedia={handleAddMedia}
            onDelete={() => {
              if (selectedClipId) {
                const nextClips = clips.filter(c => c.id !== selectedClipId);
                setClips(nextClips);
                pushToHistory(nextClips);
                setSelectedClipId(null);
              }
            }}
            canSplit={!!selectedClipId}
            selectedClipType={clips.find(c => c.id === selectedClipId)?.type}
            onTabChange={(tab) => {
              setActiveTab(tab);
              if (tab === 'main') {
                setSelectedClipId(null);
              } else if (tab === 'edit' && !selectedClipId) {
                // Find clip at playhead or just first clip to reveal features
                const clipAtPlayhead = clips.find(c => currentTime >= c.start && currentTime <= c.start + c.duration);
                if (clipAtPlayhead) setSelectedClipId(clipAtPlayhead.id);
                else if (clips.length > 0) setSelectedClipId(clips[0].id);
              }
            }}
          />
      </div>

      {/* Unified Overlay for all editing sub-menus */}
      <AnimatePresence>
        {activeTab !== 'edit' && activeTab !== 'main' && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[600] flex flex-col"
          >
            <div className="flex-1 pointer-events-none" onClick={() => setActiveTab('edit')} />
            <div className="h-[48%] bg-[#050505] border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/40 backdrop-blur-xl">
                <button onClick={() => setActiveTab('edit')} className="p-2 text-[#444] hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
                <span className="text-[12px] font-black uppercase tracking-[0.35em] text-white/90">
                  {activeTab === 'ratio' ? 'Aspek Rasio' : 
                   activeTab === 'text' ? 'Edit Teks' : 
                   activeTab === 'keyframes' ? 'Keyframe' : 
                   activeTab === 'duration' ? 'Durasi' :
                   activeTab === 'filters' ? 'Filter' : 
                   activeTab === 'audio' || activeTab === 'volume' ? 'Volume' : 
                   activeTab === 'canvas' ? 'Kanvas' :
                   activeTab === 'speed' ? 'Kecepatan' :
                   activeTab === 'transform' ? 'Transform' :
                   activeTab === 'animation' ? 'Animasi' :
                   activeTab === 'adjust' || activeTab === 'adjust-root' ? 'Sesuaikan' :
                   activeTab === 'blend' ? 'Campuran' :
                   activeTab === 'stickers' ? 'Stiker' :
                   activeTab === 'overlay' ? 'Overlay' : 
                   activeTab === 'audio-fade' ? 'Luntur' :
                   activeTab === 'transition' ? 'Transisi' :
                   activeTab === 'chroma' ? 'Hapus Latar' : 'Pengaturan'}
                </span>
                <button onClick={() => setActiveTab('edit')} className="p-2 text-white">
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar p-6 bg-gradient-to-b from-[#080808] to-black pointer-events-auto">
                {activeTab === 'ratio' && (
                  <div className="grid grid-cols-4 gap-4 pb-8">
                    {(['9:16', '16:9', '1:1', '4:5', '2.35:1', '2:1', '3:4', 'original'] as const).map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => setAspectRatio(ratio)}
                        className={cn(
                          "flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all duration-300",
                          aspectRatio === ratio ? "border-white bg-white/10 ring-2 ring-white/10" : "border-white/5 bg-white/[0.02] opacity-40 hover:opacity-100"
                        )}
                      >
                        <div className={cn(
                          "border-2 border-current shadow-sm",
                          ratio === 'original' && "w-6 h-6 border-dashed",
                          ratio === '9:16' && "w-4 h-7",
                          ratio === '16:9' && "w-7 h-4",
                          ratio === '1:1' && "w-5 h-5",
                          ratio === '4:5' && "w-4 h-5",
                          ratio === '2.35:1' && "w-8 h-3",
                          ratio === '2:1' && "w-8 h-4",
                          ratio === '3:4' && "w-6 h-8",
                        )} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{ratio}</span>
                      </button>
                    ))}
                  </div>
                )}
                {activeTab === 'duration' && selectedClipId && (
                  <div className="flex flex-col items-center py-12 gap-10">
                    <div className="text-6xl font-black text-white font-mono tracking-tighter shadow-white/5 shadow-2l">
                      {clips.find(c => c.id === selectedClipId)?.duration.toFixed(1)}<span className="text-2xl text-white/30 ml-1">s</span>
                    </div>
                    <input 
                      type="range"
                      min="0.1" max="20" step="0.1"
                      value={clips.find(c => c.id === selectedClipId)?.duration || 3}
                      onChange={(e) => handleUpdateClip(selectedClipId, { duration: parseFloat(e.target.value) })}
                      onPointerUp={() => pushToHistory(clips)}
                      className="w-full h-2.5 bg-white/10 rounded-full appearance-none accent-white cursor-pointer"
                    />
                    <div className="flex w-full justify-between px-3 text-[11px] font-black uppercase text-white/30 tracking-[0.2em]">
                       <span>Singkat</span>
                       <span>Panjang</span>
                    </div>
                  </div>
                )}
                {(activeTab === 'audio' || activeTab === 'volume') && selectedClipId && (
                  <div className="space-y-12 py-8">
                     <div className="flex items-center justify-between">
                       <div className="p-4 bg-white/10 rounded-2xl"><Volume2 className="w-8 h-8 text-white" /></div>
                       <div className="text-5xl font-black text-white font-mono">
                          {Math.round((clips.find(c => c.id === selectedClipId)?.volume ?? 1) * 100)}<span className="text-xl text-white/20 ml-2">%</span>
                       </div>
                     </div>
                     <input 
                      type="range"
                      min="0" max="2" step="0.01"
                      value={clips.find(c => c.id === selectedClipId)?.volume ?? 1}
                      onChange={(e) => handleUpdateClip(selectedClipId, { volume: parseFloat(e.target.value) })}
                      onPointerUp={() => pushToHistory(clips)}
                      className="w-full h-2.5 bg-white/10 rounded-full appearance-none accent-white cursor-pointer"
                    />
                  </div>
                )}
                {activeTab === 'speed' && selectedClipId && (
                  <div className="space-y-12 py-8">
                     <div className="flex items-center justify-between">
                       <div className="p-4 bg-white/10 rounded-2xl"><FastForward className="w-8 h-8 text-white" /></div>
                       <div className="text-5xl font-black text-white font-mono">
                          {clips.find(c => c.id === selectedClipId)?.speed.toFixed(1)}<span className="text-xl text-white/20 ml-2">x</span>
                       </div>
                     </div>
                     <div className="grid grid-cols-5 gap-2">
                        {[0.1, 0.5, 1, 2, 5].map(s => (
                          <button
                            key={s}
                            onClick={() => handleUpdateClip(selectedClipId, { speed: s })}
                            className={cn(
                              "py-2 rounded-lg border text-[10px] font-black transition-all",
                              clips.find(c => c.id === selectedClipId)?.speed === s ? "bg-white text-black border-white" : "border-white/10 text-white/40"
                            )}
                          >
                            {s}x
                          </button>
                        ))}
                     </div>
                     <input 
                      type="range"
                      min="0.1" max="10" step="0.1"
                      value={clips.find(c => c.id === selectedClipId)?.speed || 1}
                      onChange={(e) => handleUpdateClip(selectedClipId, { speed: parseFloat(e.target.value) })}
                      onPointerUp={() => pushToHistory(clips)}
                      className="w-full h-2.5 bg-white/10 rounded-full appearance-none accent-white cursor-pointer"
                    />
                  </div>
                )}
                {activeTab === 'transform' && selectedClipId && (
                  <div className="space-y-8 py-4">
                     <div className="space-y-4">
                        <div className="flex justify-between items-center">
                           <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">Skala</span>
                           <span className="text-sm font-mono text-white">{Math.round((clips.find(c => c.id === selectedClipId)?.scale ?? 1) * 100)}%</span>
                        </div>
                        <input 
                          type="range" min="0.1" max="5" step="0.01"
                          value={clips.find(c => c.id === selectedClipId)?.scale ?? 1}
                          onChange={(e) => handleUpdateClip(selectedClipId, { scale: parseFloat(e.target.value) })}
                          onPointerUp={() => pushToHistory(clips)}
                          className="w-full h-2 bg-white/10 rounded-full appearance-none accent-white"
                        />
                     </div>
                     <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-4">
                           <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">Posisi X</span>
                              <span className="text-sm font-mono text-white">{Math.round(clips.find(c => c.id === selectedClipId)?.x ?? 0)}</span>
                           </div>
                           <input 
                             type="range" min="-1000" max="1000" step="1"
                             value={clips.find(c => c.id === selectedClipId)?.x ?? 0}
                             onChange={(e) => handleUpdateClip(selectedClipId, { x: parseFloat(e.target.value) })}
                             onPointerUp={() => pushToHistory(clips)}
                             className="w-full h-2 bg-white/10 rounded-full appearance-none accent-white"
                           />
                        </div>
                        <div className="space-y-4">
                           <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">Posisi Y</span>
                              <span className="text-sm font-mono text-white">{Math.round(clips.find(c => c.id === selectedClipId)?.y ?? 0)}</span>
                           </div>
                           <input 
                             type="range" min="-1000" max="1000" step="1"
                             value={clips.find(c => c.id === selectedClipId)?.y ?? 0}
                             onChange={(e) => handleUpdateClip(selectedClipId, { y: parseFloat(e.target.value) })}
                             onPointerUp={() => pushToHistory(clips)}
                             className="w-full h-2 bg-white/10 rounded-full appearance-none accent-white"
                           />
                        </div>
                     </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">Rotasi</span>
                        <div className="flex gap-2">
                           <button onClick={() => handleUpdateClip(selectedClipId, { horizontalFlip: !clips.find(c => c.id === selectedClipId)?.horizontalFlip })} className={cn("p-4 bg-white/5 rounded-2xl active:bg-white/10 transition-colors", clips.find(c => c.id === selectedClipId)?.horizontalFlip && "bg-white text-black")} title="Balik Horizontal"><FlipHorizontal className="w-5 h-5" /></button>
                           <button onClick={() => handleUpdateClip(selectedClipId, { verticalFlip: !clips.find(c => c.id === selectedClipId)?.verticalFlip })} className={cn("p-4 bg-white/5 rounded-2xl active:bg-white/10 transition-colors", clips.find(c => c.id === selectedClipId)?.verticalFlip && "bg-white text-black")} title="Balik Vertikal"><FlipVertical className="w-5 h-5" /></button>
                           <button onClick={() => handleUpdateClip(selectedClipId, { rotation: (clips.find(c => c.id === selectedClipId)?.rotation ?? 0) - 90 })} className="p-4 bg-white/5 rounded-2xl active:bg-white/10 transition-colors"><RotateCcw className="w-6 h-6 text-white" /></button>
                           <button onClick={() => handleUpdateClip(selectedClipId, { rotation: (clips.find(c => c.id === selectedClipId)?.rotation ?? 0) + 90 })} className="p-4 bg-white/5 rounded-2xl active:bg-white/10 transition-colors"><RotateCw className="w-6 h-6 text-white" /></button>
                           <button onClick={() => handleUpdateClip(selectedClipId, { scale: 1, x: 0, y: 0, rotation: 0, horizontalFlip: false, verticalFlip: false })} className="px-6 py-4 bg-white text-black font-black uppercase text-[10px] rounded-2xl">Reset</button>
                        </div>
                     </div>
                  </div>
                )}
                {activeTab === 'animation' && selectedClipId && (
                  <div className="space-y-8 py-4">
                     <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-white/30 tracking-widest">Animasi Masuk</label>
                        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-4">
                           {(['none', 'fade', 'slide-up', 'slide-left', 'zoom', 'bounce', 'rotate-zoom', 'white-flash', 'black-flash'] as const).map(anim => (
                             <button
                               key={anim}
                               onClick={() => handleUpdateClip(selectedClipId, { animationIn: anim })}
                               className={cn(
                                 "flex-shrink-0 w-24 h-24 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all",
                                 clips.find(c => c.id === selectedClipId)?.animationIn === anim ? "bg-white text-black border-white" : "bg-white/5 text-white/40 border-white/5"
                               )}
                             >
                               <div className="w-8 h-8 rounded-full bg-current opacity-20" />
                               <span className="text-[8px] font-black uppercase text-center px-1 line-clamp-2">{anim}</span>
                             </button>
                           ))}
                        </div>
                     </div>
                     <div className="space-y-4">
                        <div className="flex justify-between items-center">
                           <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">Durasi Masuk</span>
                           <span className="text-sm font-mono text-white">{(clips.find(c => c.id === selectedClipId)?.animationInDuration ?? 0.5).toFixed(1)}s</span>
                        </div>
                        <input 
                          type="range" min="0.1" max="3" step="0.1"
                          value={clips.find(c => c.id === selectedClipId)?.animationInDuration ?? 0.5}
                          onChange={(e) => handleUpdateClip(selectedClipId, { animationInDuration: parseFloat(e.target.value) })}
                          onPointerUp={() => pushToHistory(clips)}
                          className="w-full h-2 bg-white/10 rounded-full appearance-none accent-white"
                        />
                     </div>

                     <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-white/30 tracking-widest">Animasi Keluar</label>
                        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-4">
                           {(['none', 'fade', 'slide-down', 'slide-right', 'zoom', 'blur-fade', 'rotate-zoom'] as const).map(anim => (
                             <button
                               key={anim}
                               onClick={() => handleUpdateClip(selectedClipId, { animationOut: anim })}
                               className={cn(
                                 "flex-shrink-0 w-24 h-24 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all",
                                 clips.find(c => c.id === selectedClipId)?.animationOut === anim ? "bg-white text-black border-white" : "bg-white/5 text-white/40 border-white/5"
                               )}
                             >
                               <div className="w-8 h-8 rounded-full bg-current opacity-20" />
                               <span className="text-[8px] font-black uppercase text-center px-1 line-clamp-2">{anim}</span>
                             </button>
                           ))}
                        </div>
                     </div>
                     <div className="space-y-4">
                        <div className="flex justify-between items-center">
                           <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">Durasi Keluar</span>
                           <span className="text-sm font-mono text-white">{(clips.find(c => c.id === selectedClipId)?.animationOutDuration ?? 0.5).toFixed(1)}s</span>
                        </div>
                        <input 
                          type="range" min="0.1" max="3" step="0.1"
                          value={clips.find(c => c.id === selectedClipId)?.animationOutDuration ?? 0.5}
                          onChange={(e) => handleUpdateClip(selectedClipId, { animationOutDuration: parseFloat(e.target.value) })}
                          onPointerUp={() => pushToHistory(clips)}
                          className="w-full h-2 bg-white/10 rounded-full appearance-none accent-white"
                        />
                     </div>
                  </div>
                )}
                {activeTab === 'chroma' && selectedClipId && (
                  <div className="flex flex-col items-center py-12 gap-8 text-center">
                     <div className={cn(
                        "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500",
                        clips.find(c => c.id === selectedClipId)?.chromaKey ? "bg-green-500 shadow-[0_0_40px_rgba(34,197,94,0.4)]" : "bg-white/5"
                     )}>
                        <Wand2 className={cn("w-10 h-10", clips.find(c => c.id === selectedClipId)?.chromaKey ? "text-white" : "text-white/20")} />
                     </div>
                     <div className="space-y-4">
                        <h3 className="text-xl font-black text-white uppercase tracking-tighter">Penghapus Latar</h3>
                        <p className="text-sm text-white/40 max-w-xs leading-relaxed">Secara otomatis menghapus latar belakang warna solid (hijau/biru) dari media yang dipilih.</p>
                     </div>
                     <button
                       onClick={() => {
                         const current = !!clips.find(c => c.id === selectedClipId)?.chromaKey;
                         handleUpdateClip(selectedClipId, { chromaKey: !current });
                         pushToHistory(clips);
                       }}
                       className={cn(
                         "w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] transition-all",
                         clips.find(c => c.id === selectedClipId)?.chromaKey ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-white text-black"
                       )}
                     >
                       {clips.find(c => c.id === selectedClipId)?.chromaKey ? 'Matikan Kroma' : 'Aktifkan Kroma'}
                     </button>
                  </div>
                )}
                {(activeTab === 'adjust' || activeTab === 'adjust-root') && selectedClipId && (
                  <div className="space-y-8 py-4">
                    <div className="flex w-full justify-end">
                      <button 
                        onClick={() => {
                          handleUpdateClip(selectedClipId, { 
                            brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0 
                          });
                          pushToHistory(clips);
                        }}
                        className="text-[10px] font-black text-white/40 uppercase tracking-widest hover:text-white transition-colors"
                      >
                        Atur Ulang
                      </button>
                    </div>
                    {[
                      { key: 'brightness', label: 'Kecerahan', min: 0, max: 200, icon: Sun },
                      { key: 'contrast', label: 'Kontras', min: 0, max: 200, icon: Contrast },
                      { key: 'saturation', label: 'Saturasi', min: 0, max: 200, icon: Droplets },
                      { key: 'hue', label: 'Rona', min: -180, max: 180, icon: Zap },
                      { key: 'blur', label: 'Kabur', min: 0, max: 50, icon: Filter },
                      { key: 'sharpen', label: 'Pertajam', min: 0, max: 100, icon: Target },
                      { key: 'vignette', label: 'Vinyet', min: 0, max: 100, icon: Circle },
                    ].map(adj => {
                      const val = (clips.find(c => c.id === selectedClipId) as any)?.[adj.key] ?? (adj.key === 'hue' || adj.key === 'blur' || adj.key === 'sharpen' || adj.key === 'vignette' ? 0 : 100);
                      return (
                        <div key={adj.key} className="space-y-4">
                           <div className="flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/5 rounded-lg">
                                  <adj.icon className="w-4 h-4 text-white/60" />
                                </div>
                                <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">{adj.label}</span>
                              </div>
                              <span className="text-sm font-black font-mono text-white">
                                {adj.key === 'hue' ? `${val}°` : adj.key === 'blur' ? `${val}px` : `${Math.round(val)}%`}
                              </span>
                           </div>
                           <div className="relative group px-1">
                             <input 
                               type="range" min={adj.min} max={adj.max} step="1"
                               value={val}
                               onChange={(e) => handleUpdateClip(selectedClipId, { [adj.key]: parseFloat(e.target.value) })}
                               onPointerUp={() => pushToHistory(clips)}
                               className="w-full h-1.5 bg-white/5 rounded-full appearance-none accent-white cursor-pointer group-hover:bg-white/10 transition-colors"
                             />
                           </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {activeTab === 'audio-fade' && selectedClipId && (
                  <div className="space-y-12 py-4">
                     <div className="space-y-4">
                        <div className="flex justify-between items-center">
                           <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">Luntur Masuk</span>
                           <span className="text-sm font-mono text-white">{((clips.find(c => c.id === selectedClipId) as any)?.fadeInDuration ?? 0).toFixed(1)}s</span>
                        </div>
                        <input 
                          type="range" min="0" max="5" step="0.1"
                          value={(clips.find(c => c.id === selectedClipId) as any)?.fadeInDuration ?? 0}
                          onChange={(e) => handleUpdateClip(selectedClipId, { fadeInDuration: parseFloat(e.target.value) })}
                          onPointerUp={() => pushToHistory(clips)}
                          className="w-full h-2 bg-white/10 rounded-full appearance-none accent-white"
                        />
                     </div>
                     <div className="space-y-4">
                        <div className="flex justify-between items-center">
                           <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">Luntur Keluar</span>
                           <span className="text-sm font-mono text-white">{((clips.find(c => c.id === selectedClipId) as any)?.fadeOutDuration ?? 0).toFixed(1)}s</span>
                        </div>
                        <input 
                          type="range" min="0" max="5" step="0.1"
                          value={(clips.find(c => c.id === selectedClipId) as any)?.fadeOutDuration ?? 0}
                          onChange={(e) => handleUpdateClip(selectedClipId, { fadeOutDuration: parseFloat(e.target.value) })}
                          onPointerUp={() => pushToHistory(clips)}
                          className="w-full h-2 bg-white/10 rounded-full appearance-none accent-white"
                        />
                     </div>
                  </div>
                )}
                {activeTab === 'blend' && selectedClipId && (
                  <div className="space-y-6">
                    <div className="flex flex-col gap-4">
                       <label className="text-[10px] font-black uppercase text-white/30 tracking-widest">Mode Campuran</label>
                       <div className="grid grid-cols-3 gap-3">
                          {[
                            'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion'
                          ].map(mode => (
                            <button
                              key={mode}
                              onClick={() => {
                                handleUpdateClip(selectedClipId, { blendMode: mode as any });
                                pushToHistory(clips);
                              }}
                              className={cn(
                                "py-3 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all",
                                clips.find(c => c.id === selectedClipId)?.blendMode === mode || (!clips.find(c => c.id === selectedClipId)?.blendMode && mode === 'normal') 
                                  ? "bg-white text-black border-white shadow-lg shadow-white/10" 
                                  : "bg-white/5 text-white/40 border-white/5 hover:bg-white/10"
                              )}
                            >
                              {mode}
                            </button>
                          ))}
                       </div>
                    </div>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                           <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">Opasitas</span>
                           <span className="text-sm font-mono text-white">{Math.round((clips.find(c => c.id === selectedClipId)?.opacity ?? 1) * 100)}%</span>
                        </div>
                        <input 
                          type="range" min="0" max="1" step="0.01"
                          value={clips.find(c => c.id === selectedClipId)?.opacity ?? 1}
                          onChange={(e) => handleUpdateClip(selectedClipId, { opacity: parseFloat(e.target.value) })}
                          onPointerUp={() => pushToHistory(clips)}
                          className="w-full h-2 bg-white/10 rounded-full appearance-none accent-white"
                        />
                     </div>
                  </div>
                )}
                {activeTab === 'stickers' && (
                  <div className="grid grid-cols-4 gap-4 pb-8">
                    {['🔥', '✨', '❤️', '😂', '💯', '🚀', '⭐', '🎈', '🎉', '🎸', '🎮', '💡', '✅', '❌', '⚠️', '💎', '🎨', '🎬', '📸', '🎵'].map((s, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          const newId = Math.random().toString(36).substr(2, 9);
                          const newClip: Clip = {
                            id: newId,
                            type: 'text',
                            src: '',
                            text: s,
                            start: currentTime,
                            duration: 2,
                            trimStart: 0,
                            speed: 1,
                            layer: clips.length % 3 + 1,
                            scale: 2,
                            x: 0,
                            y: 0,
                            opacity: 1,
                            keyframes: []
                          };
                          const updatedClips = [...clips, newClip];
                          setClips(updatedClips);
                          setSelectedClipId(newId);
                          pushToHistory(updatedClips);
                          setActiveTab('edit');
                        }}
                        className="aspect-square bg-white/10 rounded-2xl flex items-center justify-center text-4xl hover:bg-white/20 transition-all active:scale-90"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {activeTab === 'overlay' && (
                  <div className="grid grid-cols-3 gap-2 pb-8">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <button 
                         key={i}
                         onClick={() => {
                            const newId = Math.random().toString(36).substr(2, 9);
                            const newClip: Clip = {
                              id: newId,
                              type: i % 3 === 0 ? 'video' : 'photo',
                              src: i % 2 === 0 
                                ? 'https://images.unsplash.com/photo-1620336655055-088d06e36bf0?q=80&w=400&auto=format&fit=crop'
                                : 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?q=80&w=400&auto=format&fit=crop',
                              start: currentTime,
                              duration: 3,
                              trimStart: 0,
                              speed: 1,
                              layer: clips.length % 3 + 1,
                              scale: 0.5,
                              x: (i % 3 - 1) * 200,
                              y: (Math.floor(i / 3) - 1) * 200,
                              opacity: 1,
                              keyframes: []
                            };
                            const updatedClips = [...clips, newClip];
                            setClips(updatedClips);
                            setSelectedClipId(newId);
                            pushToHistory(updatedClips);
                            setActiveTab('edit');
                         }}
                         className="aspect-square bg-white/5 border border-white/5 rounded-xl relative group overflow-hidden"
                      >
                         <img 
                           src={i % 2 === 0 
                             ? 'https://images.unsplash.com/photo-1620336655055-088d06e36bf0?q=80&w=100&auto=format&fit=crop'
                             : 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?q=80&w=100&auto=format&fit=crop'} 
                           className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" 
                           referrerPolicy="no-referrer"
                         />
                         <div className="absolute bottom-1 right-1 text-[8px] font-bold bg-black/60 px-1 py-0.5 rounded">00:03</div>
                      </button>
                    ))}
                  </div>
                )}
                {activeTab === 'text' && selectedClipId && (
                  <div className="space-y-6">
                    <div className="flex flex-col gap-2">
                       <label className="text-[10px] font-black uppercase text-white/30 tracking-widest">Konten Teks</label>
                       <input 
                        type="text"
                        value={clips.find(c => c.id === selectedClipId)?.text || ""}
                        onChange={(e) => handleUpdateClip(selectedClipId, { text: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white outline-none focus:border-white/40 transition-colors"
                        placeholder="Ketik sesuatu..."
                       />
                    </div>
                    <div className="flex flex-col gap-3">
                       <label className="text-[10px] font-black uppercase text-white/30 tracking-widest">Gaya Teks</label>
                       <div className="grid grid-cols-2 gap-3">
                          {[
                            { id: 'bold-white', label: 'Tebal Putih' },
                            { id: 'white-shadow', label: 'Bayangan' },
                            { id: 'black-shadow', label: 'Kontras' },
                            { id: 'glow', label: 'Bercahaya' }
                          ].map(style => (
                            <button
                              key={style.id}
                              onClick={() => handleUpdateClip(selectedClipId, { textStyle: style.id as any })}
                              className={cn(
                                "p-3 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all",
                                clips.find(c => c.id === selectedClipId)?.textStyle === style.id ? "bg-white text-black border-white" : "bg-white/5 text-white/40 border-white/5"
                              )}
                            >
                              {style.label}
                            </button>
                          ))}
                       </div>
                    </div>
                  </div>
                )}
                {activeTab === 'filters' && selectedClipId && (
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { id: 'none', label: 'Asli', class: '' },
                      { id: 'grayscale', label: 'Hitam Putih', class: 'grayscale' },
                      { id: 'sepia', label: 'Klasik', class: 'sepia' },
                      { id: 'vintage', label: 'Vintaj', class: 'sepia brightness-75 contrast-125' },
                      { id: 'cold', label: 'Dingin', class: 'hue-rotate-180 brightness-90 saturate-150' },
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => handleUpdateClip(selectedClipId, { filter: f.id as any })}
                        className={cn(
                          "flex flex-col gap-2 transition-all",
                          clips.find(c => c.id === selectedClipId)?.filter === f.id ? "opacity-100 scale-105" : "opacity-40 hover:opacity-100"
                        )}
                      >
                        <div className={cn("aspect-square w-full rounded-xl bg-white/10 overflow-hidden border-2", clips.find(c => c.id === selectedClipId)?.filter === f.id ? "border-white" : "border-transparent")}>
                           <div className={cn("w-full h-full bg-gradient-to-br from-purple-500 to-pink-500", f.class)} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-tighter text-center">{f.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                {activeTab === 'canvas' && selectedClipId && (
                  <div className="space-y-8">
                     <div className="grid grid-cols-2 gap-4">
                        <button
                          onClick={() => handleUpdateClip(selectedClipId, { backgroundMode: 'blur' })}
                          className={cn(
                            "flex flex-col items-center gap-4 p-6 rounded-2xl border transition-all",
                            clips.find(c => c.id === selectedClipId)?.backgroundMode === 'blur' ? "bg-white/10 border-white text-white" : "bg-white/5 border-white/5 text-white/30"
                          )}
                        >
                          <Layers className="w-8 h-8" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Kabur</span>
                        </button>
                        <button
                          onClick={() => handleUpdateClip(selectedClipId, { backgroundMode: 'color' })}
                          className={cn(
                            "flex flex-col items-center gap-4 p-6 rounded-2xl border transition-all",
                            clips.find(c => c.id === selectedClipId)?.backgroundMode === 'color' ? "bg-white/10 border-white text-white" : "bg-white/5 border-white/5 text-white/30"
                          )}
                        >
                          <Sliders className="w-8 h-8" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Warna</span>
                        </button>
                     </div>
                  </div>
                )}
                {activeTab === 'effects' && selectedClipId && (
                  <div className="grid grid-cols-2 gap-4 pb-8">
                    {[
                      { id: 'zoom-blur', label: 'Zoom Blur', icon: Sparkles },
                      { id: 'shake', label: 'Guncang', icon: Sparkles },
                      { id: 'mirror', label: 'Cermin', icon: Layers },
                      { id: 'glitch', label: 'Gangguan', icon: Sparkles },
                    ].map(effect => (
                      <button
                        key={effect.id}
                        onClick={() => {
                          handleUpdateClip(selectedClipId, { filter: effect.id as any });
                          pushToHistory(clips);
                        }}
                        className={cn(
                          "p-6 rounded-2xl border flex flex-col items-center gap-4 transition-all",
                          clips.find(c => c.id === selectedClipId)?.filter === effect.id ? "bg-white/10 border-white text-white" : "bg-white/5 border-white/5 text-white/30"
                        )}
                      >
                        <effect.icon className="w-8 h-8" />
                        <span className="text-[10px] font-black uppercase tracking-widest">{effect.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                {activeTab === 'transition' && selectedClipId && (
                  <div className="space-y-8 py-4">
                     <div className="grid grid-cols-4 gap-3">
                        {[
                          { id: 'none', label: 'None' },
                          { id: 'fade', label: 'Pudar' },
                          { id: 'black', label: 'Hitam' },
                          { id: 'white', label: 'Putih' },
                          { id: 'slide-left', label: 'Geser Kiri' },
                          { id: 'slide-right', label: 'Geser Kanan' },
                          { id: 'zoom', label: 'Zum' },
                          { id: 'blur', label: 'Kabur' }
                        ].map(t => (
                          <button
                            key={t.id}
                            onClick={() => handleUpdateClip(selectedClipId, { transitionType: t.id as any })}
                            className={cn(
                              "flex flex-col items-center justify-center aspect-square rounded-xl border text-[8px] font-black uppercase transition-all",
                              clips.find(c => c.id === selectedClipId)?.transitionType === t.id ? "bg-white text-black border-white" : "bg-white/5 text-white/30 border-white/5"
                            )}
                          >
                            <div className="w-6 h-6 rounded-full bg-current opacity-20 mb-2" />
                            {t.label}
                          </button>
                        ))}
                     </div>
                     <div className="space-y-4">
                        <div className="flex justify-between items-center">
                           <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">Durasi Transisi</span>
                           <span className="text-sm font-mono text-white">{(clips.find(c => c.id === selectedClipId)?.transitionDuration ?? 0.5).toFixed(1)}s</span>
                        </div>
                        <input 
                          type="range" min="0.1" max="2" step="0.1"
                          value={clips.find(c => c.id === selectedClipId)?.transitionDuration ?? 0.5}
                          onChange={(e) => handleUpdateClip(selectedClipId, { transitionDuration: parseFloat(e.target.value) })}
                          onPointerUp={() => pushToHistory(clips)}
                          className="w-full h-2 bg-white/10 rounded-full appearance-none accent-white"
                        />
                     </div>
                  </div>
                )}
                {activeTab === 'keyframes' && selectedClipId && (
                  <KeyframePanel 
                    clip={clips.find(c => c.id === selectedClipId)!}
                    currentTime={currentTime}
                    onUpdateKeyframe={handleUpdateKeyframe}
                    onRemoveKeyframe={handleRemoveKeyframe}
                  />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Sparkles(props: any) {
  return (
    <svg 
      {...props}
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      <path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
    </svg>
  );
}
