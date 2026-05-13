import React, { useState, useRef, useEffect } from 'react';
import { X, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Target, Play, Pause, Undo, Redo, RotateCcw, RotateCw, Maximize2, Scissors, Music, Type, Plus, Wand2, Layers, Smile, MessageSquare, Filter, Sliders, Settings, Volume2, FastForward, Diamond, Droplets, Sun, Contrast, Zap, FlipHorizontal, FlipVertical, Copy, Circle, Search, CornerUpLeft, CornerUpRight, Image as ImageIcon, Monitor, Square, MousePointer2, Type as TypeIcon, Palette, Ghost, Minus, TrendingUp, Upload, Trash2, Check, Crop, Mic, HardDrive, Headphones, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Project, Clip, Keyframe } from '../types/editor';
import { cn, formatTime } from '../lib/utils';
import { getClipPropertiesAtTime } from '../lib/editorUtils';
import { renderFrame } from '../lib/videoRenderer';
import { getFFmpeg } from '../lib/ffmpegUtils';
import { fetchFile } from '@ffmpeg/util';
import Timeline from './editor/Timeline';
import Preview from './editor/Preview';
import Toolbar from './editor/Toolbar';
import KeyframePanel from './editor/KeyframePanel';

interface EditorProps {
  project: Project;
  onBack: () => void;
}

// --- Helper Components ---
const DialSlider = ({ 
  value, 
  onChange, 
  min, 
  max, 
  step = 1, 
  unit = '', 
  label = '' 
}: { 
  value: number; 
  onChange: (val: number) => void; 
  min: number; 
  max: number; 
  step?: number; 
  unit?: string; 
  label?: string 
}) => {
  return (
    <div className="flex items-center gap-4 px-6 h-[38px] group/slider">
      <span className="w-16 text-[11px] font-black uppercase text-white/40 tracking-wider font-sans truncate select-none">
        {label}
      </span>
      
      <div className="flex-1 relative h-7 flex items-center justify-center overflow-hidden border-x border-white/5 bg-white/[0.01]">
         {/* Dial Markers */}
         <div className="absolute inset-x-0 h-full flex items-center justify-center pointer-events-none">
            <div 
              className="flex items-end gap-[6px] transition-transform duration-150 ease-out" 
              style={{ transform: `translateX(${-(value - (min + max) / 2) * (400 / (max - min || 1))}px)` }}
            >
             {Array.from({ length: 81 }).map((_, i) => {
               const index = i - 40;
               const isMain = index % 10 === 0;
               return (
                  <div 
                    key={i} 
                    className={cn(
                      "w-[1px] transition-all duration-300",
                      isMain ? "h-3 bg-white/40" : "h-1.5 bg-white/10"
                    )}
                  />
               );
             })}
            </div>
         </div>
         
         {/* Center Indicator */}
         <div className="absolute top-0 bottom-0 w-[1px] bg-[#00c2cb] z-20" />
         
         {/* Interaction Surface */}
         <input 
           type="range"
           min={min}
           max={max}
           step={step}
           value={value}
           onChange={(e) => onChange(parseFloat(e.target.value))}
           className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-30"
         />
      </div>

      <div className="w-8 flex items-center justify-end gap-0.5">
        <span className="text-[13px] font-black text-white font-mono tabular-nums leading-none">
          {Math.round(value)}
        </span>
        {unit && <span className="text-[11px] font-black text-white/20 mb-0.5 select-none">{unit}</span>}
      </div>
    </div>
  );
};

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
  const [canvasColor, setCanvasColor] = useState<string>('#000000');
  const [activeTab, setActiveTab] = useState<string>('edit');
  const [transformTab, setTransformTab] = useState<'posisi' | 'zoom' | 'putar'>('posisi');
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
  const [showExportSuccess, setShowExportSuccess] = useState(false);

  const triggerDownload = async () => {
    try {
      const data = {
        project: project.name || 'Proyek Baru',
        clipsCount: clips.length,
        duration: totalDuration,
        aspectRatio,
        resolution: exportRes,
        fps: exportFps,
        timestamp: new Date().toISOString(),
        clips: clips.map(c => ({ 
          id: c.id, 
          type: c.type, 
          duration: c.duration, 
          start: c.start,
          layer: c.layer,
          filter: c.filter,
          src: c.src,
          scale: c.scale,
          x: c.x,
          y: c.y,
          rotation: c.rotation,
          keyframes: c.keyframes,
          text: c.text
        }))
      };
      
      const jsonString = JSON.stringify(data, null, 2);
      
      // Attempt to use Capacitor Share for a native Android experience
      try {
        const canShare = await Share.canShare();
        if (canShare.value) {
          await Share.share({
            title: `${project.name || 'Video'} Project`,
            text: 'Buka file ini di Google Colab untuk merender menjadi video MP4.',
            dialogTitle: 'Simpan Proyek Video',
            files: [
              // Note: Direct string to file sharing in Capacitor sometimes requires a temp file
              // but we can try to share as text if files fail.
            ],
            // For now, share as text if files are tricky, or fallback to browser download
          });
          // Fallback to browser blob download if Share doesn't support the raw string directly
        }
      } catch (e) {
        console.log('Capacitor Share not available, falling back to browser download.');
      }

      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = url;
      link.download = `${project.name || 'Video'}_Project.json`;
      
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 5000);
      
      return true;
    } catch (err) {
      console.error('Export failed:', err);
      return false;
    }
  };

  const [exportSize, setExportSize] = useState<string | null>(null);
  const [ffmpegLog, setFfmpegLog] = useState<string>('');
  const [exportBlob, setExportBlob] = useState<Blob | null>(null);
  const [exportFileName, setExportFileName] = useState<string>('');

  const handleCaptureFrame = async () => {
    // Resolution Mapping for Image (Highest possible)
    const resolutions: Record<string, { w: number, h: number }> = {
      '720p': { w: 1280, h: 720 },
      '1080p': { w: 1920, h: 1080 }
    };
    
    const res = resolutions[exportRes] || resolutions['1080p'];
    let width = res.w;
    let height = res.h;
    
    if (aspectRatio === '9:16') [width, height] = [height, width];
    else if (aspectRatio === '1:1') [width, height] = [height, height];

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Render the current frame
    await renderFrame(ctx, clips, currentTime, { width, height, fps: 1 });

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const fileName = `${project.name || 'Frame'}_${currentTime.toFixed(2)}.png`;

      try {
        const isNative = window.navigator.userAgent.includes('Capacitor');
        if (isNative) {
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve) => {
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(blob);
          });
          const base64 = await base64Promise;
          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: base64,
            directory: Directory.Cache
          });
          await Share.share({ title: 'Simpan Gambar', url: savedFile.uri });
        } else {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          link.click();
        }
        
        // Success Vibration
        if (window.navigator.vibrate) window.navigator.vibrate(50);
      } catch (err) {
        console.error('Capture failed:', err);
      }
    }, 'image/png');
  };

  const handleExport = async () => {
    if (isExporting) return;
    
    setIsExporting(true);
    setShowExportDrawer(true);
    setExportProgress(0);
    setCurrentTime(0);
    setIsPlaying(false);
    
    // Wake Lock to prevent sleep on mobile
    let wakeLock: any = null;
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await (navigator as any).wakeLock.request('screen');
      }
    } catch (err) {
      console.log('WakeLock failed:', err);
    }
    
    // Optimization for Mobile: 720p is much more stable than 1080p in browser
    const res = { w: 1280, h: 720 };
    let width = res.w;
    let height = res.h;
    
    // Adjust for Aspect Ratio
    if (aspectRatio === '9:16') {
      [width, height] = [height, width];
    } else if (aspectRatio === '1:1') {
      [width, height] = [height, height];
    } else if (aspectRatio === '4:5') {
       height = (width * 5) / 4;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Select best supported mime type
    const supportedMimeTypes = [
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];
    
    const mimeType = supportedMimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
    const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';

    const stream = canvas.captureStream(exportFps);
    
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 8000000 // 8Mbps is very stable for mobile encoders and looks great at 720p
    });

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    
    const finishExport = async () => {
      return new Promise<Blob>((resolve) => {
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          resolve(blob);
        };
        mediaRecorder.stop();
      });
    };

    mediaRecorder.start();

    const fps = exportFps;
    const totalFrames = Math.ceil(totalDuration * fps);
    const frameInterval = 1000 / fps;
    
    // Rendering Loop
    try {
      for (let frame = 0; frame <= totalFrames; frame++) {
        const time = frame / fps;
        if (!isExporting) break;

        setCurrentTime(time);
        setExportProgress(Math.round((frame / totalFrames) * 80)); // 0-80% for recording

        // Draw frame
        await renderFrame(ctx, clips, time, { width, height, fps });
        
        // requestFrame() helps ensure MediaRecorder captures this exact canvas state
        if ((stream as any).requestFrame) {
          (stream as any).requestFrame();
        }

        // Small delay to prevent browser freeze and allow encoder to process
        await new Promise(r => setTimeout(r, 10)); 
      }
    } catch (err) {
      console.error('Render loop failed:', err);
    }

    const videoBlob = await finishExport();
    setExportProgress(85);
    
    // FFmpeg Processing to MP4 (Only if SharedArrayBuffer is available)
    let finalBlob: Blob = videoBlob;
    let finalFileName = `${project.name || 'Video'}_Result.${extension}`;

    const canUseFFmpeg = typeof SharedArrayBuffer !== 'undefined';

    if (canUseFFmpeg && extension !== 'mp4') {
      try {
        setFfmpegLog('Memuat Konverter MP4...');
        const ffmpeg = await getFFmpeg();
        setExportProgress(88);
        
        ffmpeg.on('log', ({ message }) => {
          if (message.includes('frame=')) setFfmpegLog('Mengonversi: ' + message.split('time=')[1]?.split(' ')[0] || 'Processing...');
          else setFfmpegLog(message);
        });

        const webmName = 'input.' + extension;
        const mp4Name = 'output.mp4';
        
        setFfmpegLog('Mempersiapkan data...');
        await ffmpeg.writeFile(webmName, await fetchFile(videoBlob));
        
        setFfmpegLog('Konversi ke MP4 (High Quality)...');
        setExportProgress(90);
        
        // Mobile-optimized conversion
        await ffmpeg.exec([
          '-i', webmName, 
          '-c:v', 'libx264', 
          '-preset', 'ultrafast', 
          '-crf', '32', // Slightly lower quality for much better reliability on mobile
          '-movflags', 'faststart',
          '-pix_fmt', 'yuv420p',
          mp4Name
        ]);
        
        setExportProgress(95);
        setFfmpegLog('Menyiapkan hasil akhir...');
        const mp4Data = await ffmpeg.readFile(mp4Name);
        
        // Use Uint8Array directly to avoid SharedArrayBuffer issues in Blob constructor
        finalBlob = new Blob([mp4Data as Uint8Array], { type: 'video/mp4' });
        finalFileName = `${project.name || 'Video'}_Result.mp4`;
        
        // Cleanup FFmpeg FS to free memory
        await ffmpeg.deleteFile(webmName).catch(() => {});
        await ffmpeg.deleteFile(mp4Name).catch(() => {});
      } catch (ffmpegErr) {
        console.error('FFmpeg remux failed:', ffmpegErr);
        setFfmpegLog('Gagal konversi, menggunakan format asli...');
        await new Promise(r => setTimeout(r, 1000));
      }
    } else {
      const reason = !canUseFFmpeg ? 'Browser tidak mendukung konversi MP4' : 'Sudah dalam format MP4';
      setFfmpegLog(`${reason}, menyimpan sebagai ${extension.toUpperCase()}...`);
      await new Promise(r => setTimeout(r, 1000));
    }

    setExportBlob(finalBlob);
    setExportFileName(finalFileName);

    // Release Wake Lock
    if (wakeLock) {
      wakeLock.release().then(() => {
        wakeLock = null;
      });
    }

    // NATIVE ANDROID/IOS EXPORT LOGIC
    try {
      const isNative = window.navigator.userAgent.includes('Capacitor');
      
      if (isNative) {
        // Convert Blob to Base64 for Filesystem API
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const base64data = reader.result as string;
            resolve(base64data.split(',')[1]); 
          };
          reader.readAsDataURL(finalBlob);
        });

        const base64 = await base64Promise;
        const finalSize = (finalBlob.size / (1024 * 1024)).toFixed(1);
        setExportSize(finalSize);
        
        // Write to Cache directory then Share
        const savedFile = await Filesystem.writeFile({
          path: finalFileName,
          data: base64,
          directory: Directory.Cache
        });

        await Share.share({
          title: 'Ekspor Video Berhasil',
          text: `Video Anda (${finalSize} MB) siap dibagikan!`,
          url: savedFile.uri,
          dialogTitle: 'Simpan Video ke Galeri'
        });
      } else {
        // Browser Fallback
        const url = URL.createObjectURL(finalBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = finalFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Also trigger JSON download as backup
        await triggerDownload();
      }
    } catch (err) {
      console.error('Native save failed, fallback to browser download:', err);
      const url = URL.createObjectURL(finalBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = finalFileName;
      link.click();
    }

    setExportProgress(100);
    setShowExportSuccess(true);
    if (window.navigator.vibrate) window.navigator.vibrate([100, 50, 100]);
    
    // We do NOT auto-close now. User has manual 'Selesai' button in the overlay.
    setIsExporting(false); 
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
    const selected = clips.find(c => c.id === targetClipId);
    
    // Check if current selected clip is under playhead
    const isUnderPlayhead = selected && currentTime > selected.start && currentTime < selected.start + selected.duration;
    
    if (!isUnderPlayhead) {
      // Find deepest layer clip under playhead
      const clipUnderPlayhead = [...clips]
        .filter(c => currentTime > c.start && currentTime < c.start + c.duration)
        .sort((a, b) => b.layer - a.layer)[0];
      
      if (clipUnderPlayhead) {
        targetClipId = clipUnderPlayhead.id;
      } else {
        return;
      }
    }

    const clip = clips.find(c => c.id === targetClipId);
    if (!clip) return;

    const relativeTime = currentTime - clip.start;
    if (relativeTime < 0.1 || relativeTime > clip.duration - 0.1) return;

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
    
    // Magnetic Logic: Ensure no gaps and NO OVERLAPS on Layer 0 (Primary Track)
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
    setSelectedClipId(secondHalf.id); 
  };

  const handleAddMedia = () => {
    setUploadType('video');
    if (fileInputRef.current) {
      fileInputRef.current.accept = "video/*,image/*";
      fileInputRef.current.click();
    }
  };

  const handleAddOverlay = () => {
    setUploadType('photo');
    if (fileInputRef.current) {
      fileInputRef.current.accept = "image/*";
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const type = file.type.startsWith('video') ? 'video' : file.type.startsWith('image') ? 'photo' : file.type.startsWith('audio') ? 'audio' : 'video';
    
    const addClipWithDuration = (detectedDuration: number) => {
      const isMainTrack = uploadType === 'video';
      
      let startTime = currentTime;
      let targetLayer = isMainTrack ? 0 : 1;

      // For Main Track (Layer 0), we use magnetic insertion
      if (isMainTrack) {
        // Find if we are inserting between clips or at the end
        const layer0 = clips.filter(c => c.layer === 0).sort((a, b) => a.start - b.start);
        const insertAfterIndex = layer0.findIndex(c => currentTime < c.start + c.duration);
        
        if (insertAfterIndex === -1) {
          // Append at the end of track
          startTime = layer0.reduce((max, clip) => Math.max(max, clip.start + clip.duration), 0);
        } else {
          // Insert at current time and shift subsequent clips
          startTime = currentTime;
        }
      }

      const newClip: Clip = {
        id: Date.now().toString(),
        type: type as any,
        src: url,
        thumbnail: type === 'photo' ? url : type === 'audio' ? 'https://cdn-icons-png.flaticon.com/512/461/461238.png' : 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=200&auto=format&fit=crop',
        start: startTime,
        duration: detectedDuration,
        trimStart: 0,
        speed: 1,
        layer: type === 'audio' ? -1 : targetLayer,
        scale: (type === 'photo' && uploadType === 'photo') ? 0.5 : 1,
        x: 0,
        y: 0,
        rotation: 0,
        opacity: 1,
        keyframes: [],
        animationIn: 'none',
        animationOut: 'none'
      };

      let nextClips = [...clips, newClip];

      // Re-apply Magnetic Logic if added to Layer 0
      if (newClip.layer === 0) {
        const layer0 = nextClips.filter(c => c.layer === 0).sort((a, b) => a.start - b.start);
        let cumulativeStart = 0;
        const updatedLayer0 = layer0.map(c => {
          const updated = { ...c, start: cumulativeStart };
          cumulativeStart += c.duration;
          return updated;
        });
        nextClips = nextClips.map(c => c.layer === 0 ? (updatedLayer0.find(u => u.id === c.id) || c) : c);
      } else if (newClip.layer > 0) {
        // For overlays, if they overlap on the same layer, move to next free layer
        let currentLayer = newClip.layer;
        let hasOverlap = true;
        while (hasOverlap) {
          const overlap = nextClips.find(c => 
            c.id !== newClip.id && 
            c.layer === currentLayer && 
            newClip.start < c.start + c.duration && 
            newClip.start + newClip.duration > c.start
          );
          if (overlap) {
            currentLayer++;
          } else {
            hasOverlap = false;
          }
        }
        newClip.layer = currentLayer;
      }

      setClips(nextClips);
      pushToHistory(nextClips);
      setSelectedClipId(newClip.id);
    };

    if (type === 'video') {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = url;
      video.onloadedmetadata = () => {
        addClipWithDuration(video.duration);
        // Ensure duration is strictly synced
        console.log(`Video detected: ${video.duration}s`);
      };
      video.onerror = () => addClipWithDuration(3);
    } else if (type === 'audio') {
      const audio = new Audio(url);
      audio.preload = 'metadata';
      audio.src = url;
      audio.onloadedmetadata = () => addClipWithDuration(audio.duration);
      audio.onerror = () => addClipWithDuration(3);
    } else {
      addClipWithDuration(3);
    }
    
    e.target.value = '';
  };

  const handleAddText = () => {
    let targetLayer = 1;
    let hasOverlap = true;
    while (hasOverlap) {
      const overlap = clips.find(c => 
        c.layer === targetLayer && 
        currentTime < c.start + c.duration && 
        currentTime + 3 > c.start
      );
      if (overlap) {
        targetLayer++;
      } else {
        hasOverlap = false;
      }
    }

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
      layer: targetLayer,
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
    let targetLayer = 2;
    let hasOverlap = true;
    while (hasOverlap) {
      const overlap = clips.find(c => 
        c.layer === targetLayer && 
        currentTime < c.start + c.duration && 
        currentTime + 3 > c.start
      );
      if (overlap) {
        targetLayer++;
      } else {
        hasOverlap = false;
      }
    }

    const newClip: Clip = {
      id: Date.now().toString(),
      type: 'photo',
      src: 'https://cdn-icons-png.flaticon.com/512/742/742751.png', // Happy face sticker
      thumbnail: 'https://cdn-icons-png.flaticon.com/512/742/742751.png',
      start: currentTime,
      duration: 3,
      trimStart: 0,
      speed: 1,
      layer: targetLayer,
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
    if (fileInputRef.current) {
      fileInputRef.current.accept = "audio/*";
      fileInputRef.current.click();
    }
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
    if (updatedTarget) {
      if (updatedTarget.layer === 0) {
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
      } else {
        // Overlay Layer Overlap Prevention (Optional but adds 'smoothness')
        const otherClipsOnLayer = nextClips.filter(c => c.layer === updatedTarget.layer && c.id !== id);
        otherClipsOnLayer.forEach(other => {
          const buffer = 0.05; // 50ms cushion
          // If we overlap an existing clip on the same overlay layer, push the other one or prevent movement?
          // For CapCut overlays can overlap, so we generally leave them, but we could add snapping here.
        });
      }
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
    <div className="flex flex-col h-screen h-[100dvh] bg-[#050505] text-white overflow-hidden select-none" ref={editorRef}>
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept={uploadType === 'audio' ? "audio/*" : uploadType === 'photo' ? "image/*" : "video/*,image/*"}
        onChange={handleFileSelect}
      />
      
      {/* 1. TOP BAR (CapCut Android Style) */}
      <header className="flex-shrink-0 h-10 bg-black border-b border-white/10 flex items-center justify-between px-4 z-[300]">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-1.5 text-white active:scale-90 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full active:scale-95 transition-all">
            <span className="text-[10px] font-bold text-white/90 uppercase tracking-tight">1080P</span>
            <ChevronDown className="w-3 h-3 text-white/40" />
          </button>
          <button 
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-1.5 bg-[#00c2cb] hover:bg-[#00dae4] text-white rounded-full active:scale-90 transition-all shadow-[0_0_15px_rgba(0,194,203,0.2)] disabled:opacity-50"
          >
             <Upload className={cn("w-4 h-4 text-white font-bold", isExporting && "animate-bounce")} />
             <span className="text-[11px] font-black uppercase tracking-widest leading-none mt-0.5">
               {isExporting ? `${exportProgress}%` : 'Ekspor'}
             </span>
          </button>
        </div>
      </header>

      {/* 2. MAIN LAYOUT (Header -> Preview -> Toolbar -> Timeline) */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* TOP HALF: Preview Area (60%) */}
        <div className="flex-[6] flex flex-col min-h-0 bg-black">
          
          {/* Preview Viewport */}
          <div className="flex-1 flex flex-col relative min-w-0 bg-[#050505] overflow-hidden">
             {/* Preview Content */}
             <div className="flex-1 relative flex items-center justify-center p-0 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,194,203,0.02)_0%,transparent_70%)] pointer-events-none" />
                
                <div className="w-full h-full p-2 md:p-8 lg:p-12 relative flex items-center justify-center translate-y-6">
                  <Preview 
                    clips={clips} 
                    currentTime={currentTime} 
                    selectedClipId={selectedClipId} 
                    aspectRatio={aspectRatio}
                    canvasColor={canvasColor}
                    isPlaying={isPlaying}
                    isMuted={isMuted}
                    isTransforming={activeTab === 'transform'}
                    onTogglePlay={() => setIsPlaying(!isPlaying)}
                    onUpdateClip={handleUpdateClip}
                    onUpdateEnd={() => pushToHistory(clipsRef.current)}
                  />
                </div>
             </div>
              {/* Toolbar: Preview Controls Bar (Maximize, Play, Undo/Redo) - CapCut Standar (10%) */}
             <div className="flex-shrink-0 h-[44px] border-t border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl flex items-center justify-between px-2">
                <button 
                  onClick={() => editorRef.current?.requestFullscreen()}
                  className="w-[42px] h-[42px] flex items-center justify-center text-white/40 hover:text-white transition-all active:scale-90"
                >
                  <Maximize2 className="w-5 h-5 rotate-45" />
                </button>
                
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-[42px] h-[42px] flex items-center justify-center text-white active:scale-75 transition-all"
                >
                  {isPlaying ? (
                    <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
                      <Pause className="w-6 h-6 fill-current" />
                    </motion.div>
                  ) : (
                    <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
                      <Play className="w-6 h-6 fill-current translate-x-0.5" />
                    </motion.div>
                  )}
                </button>

                <div className="flex items-center gap-[10px]">
                  <button 
                    onClick={undo} 
                    disabled={historyIndex === 0} 
                    className="w-[42px] h-[42px] flex items-center justify-center disabled:opacity-5 text-white/40 hover:text-white transition-all active:scale-90"
                  >
                    <Undo className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={redo} 
                    disabled={historyIndex === history.length - 1} 
                    className="w-[42px] h-[42px] flex items-center justify-center disabled:opacity-5 text-white/40 hover:text-white transition-all active:scale-90"
                  >
                    <Redo className="w-6 h-6" />
                  </button>
                </div>
             </div>

          </div>
       </div>

        {/* BOTTOM HALF: Timeline Area (30%) */}
        <div className="flex-[3] flex flex-col bg-[#050505] border-t border-white/[0.05] z-[100] min-h-[160px]">
           {/* Timeline Toolbar (Time, Split, etc) */}
           <div className="h-10 md:h-12 px-4 border-b border-white/5 flex items-center justify-between bg-[#0a0a0a]">
              <div className="flex items-center gap-6">
                 <div className="flex items-center gap-1.5 text-[10px] md:text-[11px] font-bold font-mono">
                    <span className="text-white">{formatTime(currentTime)}</span>
                    <span className="text-white/20">/</span>
                    <span className="text-white/40">{formatTime(totalDuration)}</span>
                 </div>
              </div>

              <div className="flex items-center gap-1">
                 <button 
                  onClick={handleSplit}
                  disabled={!selectedClipId}
                  className="p-1 md:p-1.5 text-white/80 hover:text-white disabled:opacity-20 transition-all flex flex-col items-center gap-0.5"
                 >
                    <Scissors className="w-4 h-4 md:w-5 md:h-5" />
                    <span className="text-[7px] md:text-[8px] font-bold uppercase">Bagi</span>
                 </button>

                 <div className="w-[1px] h-5 md:h-6 bg-white/10 mx-1" />

                 <button 
                  onClick={handleToggleKeyframe}
                  disabled={!selectedClipId}
                  className={cn(
                    "p-1 md:p-1.5 transition-all flex flex-col items-center gap-0.5 focus:outline-none",
                    selectedClipId && clips.find(c => c.id === selectedClipId)?.keyframes.some(k => Math.abs(k.time - (currentTime - (clips.find(c => c.id === selectedClipId)?.start || 0))) < 0.1)
                      ? "text-[#00c2cb] drop-shadow-[0_0_8px_rgba(0,194,203,0.5)]"
                      : "text-white/80 hover:text-white disabled:opacity-20"
                  )}
                 >
                    <Diamond className={cn("w-4 h-4 md:w-5 md:h-5", selectedClipId && clips.find(c => c.id === selectedClipId)?.keyframes.some(k => Math.abs(k.time - (currentTime - (clips.find(c => c.id === selectedClipId)?.start || 0))) < 0.1) ? "fill-current" : "")} />
                    <span className="text-[7px] md:text-[8px] font-bold uppercase">Keyframe</span>
                 </button>

                 <div className="w-[1px] h-5 md:h-6 bg-white/10 mx-1" />

                 <button 
                  onClick={handleDelete}
                  disabled={!selectedClipId}
                  className="p-1 md:p-1.5 text-white/80 hover:text-white disabled:opacity-20 transition-all flex flex-col items-center gap-0.5"
                 >
                    <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                    <span className="text-[7px] md:text-[8px] font-bold uppercase">Hapus</span>
                 </button>
              </div>
           </div>

           {/* Timeline Tracks */}
           <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 relative overflow-hidden bg-[#050505] shadow-inner">
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
                    onAddAudio={handleAddAudio}
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
        </div>
      </div>

      {/* 3. BOTTOM TOOLBAR (Mobile & Desktop) */}
      <div className="flex-shrink-0 bg-black border-t border-white/10 z-[300] safe-area-bottom h-[68px] md:h-[92px]">
         <Toolbar 
            activeTab={activeTab}
            onSplit={handleSplit}
            onCopy={handleCopy}
            onAddText={handleAddText}
            onAddOverlay={handleAddOverlay}
            onAddSticker={handleAddSticker}
            onAddAudio={handleAddAudio}
            onAddMedia={handleAddMedia}
            onDelete={handleDelete}
            onToggleKeyframe={handleToggleKeyframe}
            canSplit={!!selectedClipId}
            selectedClipType={clips.find(c => c.id === selectedClipId)?.type}
            onTabChange={(tab) => {
              setActiveTab(tab);
              if (tab === 'main') {
                setSelectedClipId(null);
              } else if (tab === 'edit' && !selectedClipId) {
                const clipAtPlayhead = clips.find(c => currentTime >= c.start && currentTime <= c.start + c.duration);
                if (clipAtPlayhead) setSelectedClipId(clipAtPlayhead.id);
              }
            }}
         />
      </div>
      {/* 4. EDITING SUB-MENU OVERLAYS (Spring Animation) */}

      <AnimatePresence>
        {activeTab !== 'edit' && activeTab !== 'media' && activeTab !== 'text' && activeTab !== 'sticker' && activeTab !== 'effect' && activeTab !== 'filter' && activeTab !== 'adjust-root' && activeTab !== 'main' && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[600] flex flex-col"
          >
            <div className="flex-1 pointer-events-none" onClick={() => setActiveTab('main')} />
            <div className={cn(
              "bg-[#121212] border-t border-white/10 shadow-[0_-20px_60px_rgba(0,0,0,0.9)] flex flex-col rounded-t-[32px] overflow-hidden pointer-events-auto transition-all duration-300",
              activeTab === 'transform' ? "h-fit w-[85%] mx-auto max-h-[70%] border-x border-white/5" : "h-[50%] md:h-[58%]"
            )}>
              {activeTab !== 'transform' && (
                <div className="flex items-center justify-between px-6 h-14 border-b border-white/5 bg-black/40 backdrop-blur-xl shrink-0">
                  <button onClick={() => setActiveTab('main')} className="p-2 -ml-2 text-white/40 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/90">
                    {activeTab === 'ratio' ? 'ASPEK RASIO' : 
                    activeTab === 'text-edit' ? 'UBAH TEKS' : 
                    activeTab === 'keyframes' ? 'KEYFRAME' : 
                    activeTab === 'duration' ? 'DURASI' :
                    activeTab === 'filters-edit' ? 'FILTER' : 
                    activeTab === 'audio' ? 'AUDIO' :
                    activeTab === 'audio-edit' || activeTab === 'volume' ? 'VOLUME' : 
                    activeTab === 'canvas' ? 'KANVAS' :
                    activeTab === 'speed' ? 'KECEPATAN' :
                    activeTab === 'speed-curve' ? 'KURVA KECEPATAN' :
                    activeTab === 'mask' ? 'MASKING' :
                    activeTab === 'hsl' ? 'WARNA HSL' :
                    activeTab === 'animation' ? 'ANIMASI' :
                    activeTab === 'adjust' ? 'SESUAIKAN' :
                    activeTab === 'blend' ? 'CAMPURAN' :
                    activeTab === 'stickers' ? 'STIKER' :
                    activeTab === 'overlay' ? 'OVERLAY' : 
                    activeTab === 'audio-fade' ? 'LUNTUR' :
                    activeTab === 'transition' ? 'TRANSISI' :
                    activeTab === 'chroma' ? 'HAPUS LATAR' : 'PENGATURAN'}
                  </span>
                  <button onClick={() => setActiveTab('main')} className="p-2 text-white">
                    <ChevronDown className="w-5 h-5" />
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto scroll-smooth no-scrollbar p-[14px] bg-gradient-to-b from-[#080808] to-black">
                {activeTab === 'transform' && selectedClipId && (
                  <div className="flex flex-col h-full scroll-smooth">
                    {/* Transform Header */}
                    <div className="flex items-center justify-between mb-4 px-2">
                       <span className="text-[13px] font-black uppercase tracking-widest text-[#00c2cb]">Dasar</span>
                       <button onClick={() => setActiveTab('main')} className="text-white/20 hover:text-white">
                         <X className="w-4 h-4" />
                       </button>
                    </div>

                    {/* Transform Tabs */}
                    <div className="flex items-center gap-8 mb-4 px-4 h-10 shrink-0">
                      {(['posisi', 'zoom', 'putar'] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setTransformTab(tab)}
                          className={cn(
                            "text-[12px] font-black uppercase tracking-[0.2em] transition-all relative pb-2 flex-shrink-0",
                            transformTab === tab ? "text-white" : "text-white/30 hover:text-white/60"
                          )}
                        >
                          {tab === 'posisi' ? 'Posisi' : tab === 'zoom' ? 'Zoom' : 'Putar'}
                          {transformTab === tab && (
                            <motion.div 
                              layoutId="transformTabUnderline"
                              className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#00c2cb] rounded-full"
                            />
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Transform Content */}
                    <div className="flex-1 flex flex-col justify-start gap-2">
                      {transformTab === 'posisi' && (
                        <div className="flex flex-col gap-2">
                          <DialSlider 
                            label="Sumbu X"
                            min={-500}
                            max={500}
                             value={clips.find(c => c.id === selectedClipId)?.x || 0}
                            onChange={(val) => handleUpdateClip(selectedClipId, { x: Math.round(val) })}
                          />
                          <DialSlider 
                            label="Sumbu Y"
                            min={-500}
                            max={500}
                            value={clips.find(c => c.id === selectedClipId)?.y || 0}
                            onChange={(val) => handleUpdateClip(selectedClipId, { y: Math.round(val) })}
                          />
                          <div className="flex gap-2 px-6 mt-2">
                             <button 
                              onClick={() => {
                                const clip = clips.find(c => c.id === selectedClipId);
                                handleUpdateClip(selectedClipId, { horizontalFlip: !clip?.horizontalFlip });
                              }}
                              className={cn(
                                "flex-1 h-10 border rounded-xl flex items-center justify-center gap-2 transition-all",
                                clips.find(c => c.id === selectedClipId)?.horizontalFlip ? "bg-white border-white text-black" : "bg-white/5 border-white/10 text-white/40 group-hover:text-white"
                              )}
                             >
                               <FlipHorizontal className="w-6 h-6" />
                               <span className="text-[11px] font-black uppercase tracking-widest">Cermin H</span>
                             </button>
                             <button 
                              onClick={() => {
                                const clip = clips.find(c => c.id === selectedClipId);
                                handleUpdateClip(selectedClipId, { verticalFlip: !clip?.verticalFlip });
                              }}
                              className={cn(
                                "flex-1 h-10 border rounded-xl flex items-center justify-center gap-2 transition-all",
                                clips.find(c => c.id === selectedClipId)?.verticalFlip ? "bg-white border-white text-black" : "bg-white/5 border-white/10 text-white/40 group-hover:text-white"
                              )}
                             >
                               <FlipVertical className="w-6 h-6" />
                               <span className="text-[11px] font-black uppercase tracking-widest">Cermin V</span>
                             </button>
                          </div>
                        </div>
                      )}
                      {transformTab === 'zoom' && (
                        <div className="flex flex-col gap-2">
                          <DialSlider 
                            label="Skala"
                            min={10}
                            max={300}
                            unit="%"
                            value={(clips.find(c => c.id === selectedClipId)?.scale || 1) * 100}
                            onChange={(val) => handleUpdateClip(selectedClipId, { scale: val / 100 })}
                          />
                          <div className="px-6 mt-2">
                            <button 
                              onClick={() => handleUpdateClip(selectedClipId, { scale: 1, x: 0, y: 0 })}
                              className="w-full h-[40px] bg-white/5 border border-white/10 rounded-lg text-[11px] font-black uppercase tracking-widest text-white/60"
                            >
                              Pas Kanvas
                            </button>
                          </div>
                        </div>
                      )}
                      {transformTab === 'putar' && (
                        <div className="flex flex-col gap-2">
                          <DialSlider 
                            label="Rotasi"
                            min={-180}
                            max={180}
                            unit="°"
                            value={clips.find(c => c.id === selectedClipId)?.rotation || 0}
                            onChange={(val) => handleUpdateClip(selectedClipId, { rotation: Math.round(val) })}
                          />
                          <div className="px-6 mt-2">
                            <button 
                              onClick={() => {
                                const clip = clips.find(c => c.id === selectedClipId);
                                handleUpdateClip(selectedClipId, { rotation: ((clip?.rotation || 0) + 90) % 360 });
                              }}
                              className="w-full h-[40px] bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-2 text-white/60"
                            >
                              <RotateCw className="w-[24px] h-[24px]" />
                              <span className="text-[11px] font-black uppercase tracking-widest">Putar 90°</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom Actions (Buttons 40x40dp) */}
                    <div className="mt-auto px-6 h-16 shrink-0 border-t border-white/5 flex items-center justify-between bg-black/40">
                       <button 
                         onClick={() => {
                           handleUpdateClip(selectedClipId, { scale: 1, x: 0, y: 0, rotation: 0, horizontalFlip: false, verticalFlip: false });
                           pushToHistory(clipsRef.current);
                         }}
                         className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-white/5 active:bg-white/10 transition-all group"
                       >
                         <RotateCcw className="w-4 h-4 text-white/40 group-hover:text-white" />
                         <span className="text-[11px] font-black uppercase tracking-widest text-white/40 group-hover:text-white">Reset</span>
                       </button>
                       
                       <div className="flex flex-col items-center gap-0.5">
                         <span className="text-[11px] font-black uppercase tracking-[0.4em] text-white select-none">Dasar</span>
                         <div className="w-1 h-1 rounded-full bg-[#00c2cb]" />
                       </div>
                       
                       <button 
                         onClick={() => setActiveTab('main')}
                         className="w-[40px] h-[40px] bg-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all"
                       >
                         <Check className="w-6 h-6 text-black stroke-[3]" />
                       </button>
                    </div>
                  </div>
                )}
                {activeTab === 'ratio' && (
                  <>
                    <div className="flex overflow-x-auto no-scrollbar gap-4 py-4 px-2">
                      {([
                        { id: '9:16', label: '9:16', sub: 'TikTok' },
                        { id: '16:9', label: '16:9', sub: 'YouTube' },
                        { id: '1:1', label: '1:1', sub: 'Instagram' },
                        { id: '4:5', label: '4:5', sub: 'Post' },
                        { id: '3:4', label: '3:4', sub: 'TV' },
                        { id: '2.35:1', label: '2.35:1', sub: 'Movie' },
                        { id: '2:1', label: '2:1', sub: 'Wide' },
                        { id: 'original', label: 'Asli', sub: 'Original' },
                      ] as const).map((r) => (
                        <button
                          key={r.id}
                          onClick={() => setAspectRatio(r.id)}
                          className={cn(
                            "flex-shrink-0 flex flex-col items-center gap-3 transition-all",
                            aspectRatio === r.id ? "scale-105" : "opacity-40 hover:opacity-100"
                          )}
                        >
                          <div className={cn(
                            "w-16 h-24 border-2 rounded-xl flex items-center justify-center relative overflow-hidden transition-all duration-300 shadow-2xl",
                            aspectRatio === r.id ? "border-white bg-white/10 ring-4 ring-white/5" : "border-white/10 bg-white/[0.02]"
                          )}>
                             <div 
                                className={cn(
                                  "border-2 border-current transition-all",
                                  r.id === '9:16' && "w-5 h-9",
                                  r.id === '16:9' && "w-9 h-5",
                                  r.id === '1:1' && "w-6 h-6",
                                  r.id === '4:5' && "w-6 h-7.5",
                                  r.id === '3:4' && "w-6 h-9",
                                  r.id === '2.35:1' && "w-11 h-4",
                                  r.id === '2:1' && "w-10 h-5",
                                  r.id === 'original' && "w-7 h-7 rounded-full border-dashed"
                                )}
                                style={{ color: aspectRatio === r.id ? '#00c2cb' : 'rgba(255,255,255,0.3)' }}
                             />
                          </div>
                          <div className="flex flex-col items-center">
                            <span className={cn("text-[10px] font-black tracking-widest", aspectRatio === r.id ? "text-white" : "text-white/40")}>{r.label}</span>
                            <span className="text-[8px] text-white/20 font-black uppercase tracking-tighter">{r.sub}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 flex gap-3">
                      <button 
                         onClick={() => {
                           if (selectedClipId) {
                             handleUpdateClip(selectedClipId, { scale: 1, x: 0, y: 0, rotation: 0 });
                             pushToHistory(clipsRef.current);
                           }
                         }}
                         disabled={!selectedClipId}
                         className="flex-1 h-12 bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest rounded-xl active:scale-95 transition-all text-[10px] disabled:opacity-20"
                      >
                         Muat Bingkai
                      </button>
                      <button 
                         onClick={() => setActiveTab('main')}
                         className="flex-[2] h-12 bg-white text-black font-black uppercase tracking-widest rounded-xl shadow-[0_4px_20px_rgba(255,255,255,0.2)] active:scale-95 transition-all text-xs"
                      >
                         Terapkan
                      </button>
                    </div>
                  </>
                )}
                {activeTab === 'audio' && (
                  <div className="flex flex-col h-full">
                    {/* Audio Sub-menu Grid */}
                    <div className="grid grid-cols-4 gap-4 px-2 py-4">
                      {[
                        { id: 'sounds', label: 'Suara', icon: Music, color: 'bg-blue-500/20 text-blue-400' },
                        { id: 'effects', label: 'Efek', icon: Wand2, color: 'bg-purple-500/20 text-purple-400' },
                        { id: 'extracted', label: 'Diekstrak', icon: Download, color: 'bg-green-500/20 text-green-400' },
                        { id: 'device', label: 'Perangkat', icon: HardDrive, color: 'bg-orange-500/20 text-orange-400', action: handleAddAudio },
                        { id: 'record', label: 'Rekam', icon: Mic, color: 'bg-red-500/20 text-red-400' },
                      ].map((item) => (
                        <button 
                          key={item.id}
                          onClick={() => item.action ? item.action() : null}
                          className="flex flex-col items-center gap-3 transition-all active:scale-90 group"
                        >
                          <div className={cn(
                            "w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center transition-all",
                            item.color || "bg-white/5 text-white/40"
                          )}>
                             <item.icon className="w-6 h-6 md:w-8 md:h-8" />
                          </div>
                          <span className="text-[10px] font-bold text-white/60 group-hover:text-white uppercase tracking-tighter text-center">{item.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Footer / Info */}
                    <div className="mt-auto px-4 pb-8 flex flex-col items-center gap-4">
                       <div className="w-full h-[1px] bg-white/5" />
                       <div className="flex items-center gap-2 text-white/20">
                          <Headphones className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Gunakan Audio Berlisensi</span>
                       </div>
                    </div>
                  </div>
                )}
                {activeTab === 'canvas' && (
                  <div className="space-y-8 py-4 px-2 scroll-smooth">
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => {
                          if (selectedClipId) {
                            handleUpdateClip(selectedClipId, { scale: 1, x: 0, y: 0 });
                            pushToHistory(clipsRef.current);
                          }
                        }}
                        className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white/60 hover:text-white active:scale-95"
                      >
                        <Crop className="w-8 h-8" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Paskan (Fit)</span>
                      </button>
                      <button 
                        onClick={() => {
                          if (selectedClipId) {
                            handleUpdateClip(selectedClipId, { scale: 1.8, x: 0, y: 0 });
                            pushToHistory(clipsRef.current);
                          }
                        }}
                        className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white/60 hover:text-white active:scale-95"
                      >
                        <Maximize2 className="w-8 h-8" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Isi (Fill)</span>
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                       <label className="text-[10px] font-black uppercase text-white/30 tracking-widest">Warna Latar</label>
                       <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                          {['#000000', '#ffffff', '#ff3b30', '#4cd964', '#007aff', '#ffcc00', '#ff9500', '#5856d6', '#ff2d55'].map(color => (
                            <button 
                              key={color}
                              onClick={() => setCanvasColor(color)}
                              className={cn(
                                "w-10 h-10 rounded-full border-2 transition-all hover:scale-110 active:scale-90 flex-shrink-0",
                                canvasColor === color ? "border-[#00c2cb] scale-110 shadow-[0_0_15px_rgba(0,194,203,0.4)]" : "border-white/10"
                              )}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                       </div>
                    </div>
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
                  </div>
                )}
                {(activeTab === 'audio-edit' || activeTab === 'volume') && selectedClipId && (
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
                     <button 
                       onClick={() => setActiveTab('speed-curve')}
                       className="w-full flex items-center justify-between p-6 bg-white/5 border border-white/5 rounded-3xl hover:bg-white/10 transition-all group"
                     >
                        <div className="flex items-center gap-4">
                           <div className="p-3 bg-[#00c2cb]/20 rounded-2xl">
                              <TrendingUp className="w-6 h-6 text-[#00c2cb]" />
                           </div>
                           <div className="text-left">
                              <span className="block text-[14px] font-black uppercase text-white">Kurva Kecepatan</span>
                              <span className="block text-[10px] text-white/30 uppercase tracking-widest">Montase, Hero, Bullet, dll</span>
                           </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-white" />
                     </button>

                     <div className="space-y-6">
                        <div className="flex justify-between items-center px-2">
                           <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">Kecepatan Normal</span>
                           <span className="text-lg font-black text-[#00c2cb]">{(clips.find(c => c.id === selectedClipId)?.speed || 1).toFixed(1)}x</span>
                        </div>
                        <input 
                          type="range"
                          min="0.1" max="10" step="0.1"
                          value={clips.find(c => c.id === selectedClipId)?.speed || 1}
                          onChange={(e) => handleUpdateClip(selectedClipId, { speed: parseFloat(e.target.value) })}
                          onPointerUp={() => pushToHistory(clips)}
                          className="w-full h-2 bg-white/10 rounded-full appearance-none accent-[#00c2cb] cursor-pointer"
                        />
                        <div className="flex justify-between text-[8px] font-black text-white/10 px-1 uppercase">
                           <span>0.1x</span>
                           <span>1.0x</span>
                           <span>10x</span>
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
                                  selectedClip?.animationIn === anim ? "bg-white text-black border-white" : "bg-white/5 text-white/40 border-white/5"
                                )}
                              >
                                <div className="w-8 h-8 rounded-full bg-current opacity-20" />
                                <span className="text-[8px] font-black uppercase text-center px-1 line-clamp-2">{anim}</span>
                              </button>
                            ))}
                         </div>
                      </div>
                   </div>
                )}
                {activeTab === 'adjust' && selectedClipId && (
                   <div className="space-y-8 py-4">
                     <button 
                       onClick={() => setActiveTab('hsl')}
                       className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all group"
                     >
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-red-500 via-green-500 to-blue-500" />
                           <div className="text-left">
                              <span className="block text-[11px] font-black uppercase text-white/90">Warna HSL</span>
                              <span className="block text-[9px] text-white/30 uppercase">Atur warna spesifik</span>
                           </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-white" />
                     </button>

                     {[
                       { key: 'brightness', label: 'Kecerahan', min: 0, max: 200, icon: Sun },
                       { key: 'contrast', label: 'Kontras', min: 0, max: 200, icon: Contrast },
                       { key: 'saturation', label: 'Saturasi', min: 0, max: 200, icon: Droplets },
                     ].map(adj => {
                       const val = (selectedClip as any)?.[adj.key] ?? 100;
                       return (
                         <div key={adj.key} className="space-y-4">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase text-white/30">
                               <span>{adj.label}</span>
                               <span className="text-white">{Math.round(val)}%</span>
                            </div>
                            <input 
                              type="range" min={adj.min} max={adj.max} step="1"
                              value={val}
                              onChange={(e) => handleUpdateClip(selectedClipId, { [adj.key]: parseFloat(e.target.value) })}
                              className="w-full accent-white"
                            />
                         </div>
                       );
                     })}
                   </div>
                )}
                {activeTab === 'hsl' && selectedClipId && (
                   <div className="space-y-6 py-4">
                      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                         {(['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'magenta'] as const).map(color => (
                            <button 
                              key={color}
                              className={cn(
                                "w-10 h-10 rounded-full border-2 transition-all flex-shrink-0",
                                color === 'red' ? "bg-red-500" :
                                color === 'orange' ? "bg-orange-500" :
                                color === 'yellow' ? "bg-yellow-400" :
                                color === 'green' ? "bg-green-500" :
                                color === 'cyan' ? "bg-cyan-400" :
                                color === 'blue' ? "bg-blue-600" :
                                color === 'purple' ? "bg-purple-600" : "bg-pink-600",
                                "border-white/10 hover:scale-110 active:scale-95"
                              )}
                            />
                         ))}
                      </div>
                      <div className="space-y-8">
                         {[
                           { label: 'Rona (Hue)', key: 'h', min: -100, max: 100 },
                           { label: 'Saturasi', key: 's', min: -100, max: 100 },
                           { label: 'Terang (Lightness)', key: 'l', min: -100, max: 100 },
                         ].map(param => (
                            <div key={param.key} className="space-y-4">
                               <div className="flex justify-between items-center text-[10px] font-black uppercase text-white/30">
                                  <span>{param.label}</span>
                                  <span className="text-white">0</span>
                               </div>
                               <input type="range" min={param.min} max={param.max} className="w-full h-1.5 bg-white/10 rounded-full appearance-none accent-white" />
                            </div>
                         ))}
                      </div>
                   </div>
                )}
                {activeTab === 'mask' && selectedClipId && (
                   <div className="grid grid-cols-2 gap-4 py-4">
                      {[
                        { id: 'none', label: 'Tidak Ada', icon: X },
                        { id: 'linear', label: 'Linear', icon: Minus },
                        { id: 'circle', label: 'Lingkaran', icon: Circle },
                        { id: 'rectangle', label: 'Kotak', icon: Square },
                        { id: 'heart', label: 'Hati', icon: Smile },
                        { id: 'star', label: 'Bintang', icon: Zap },
                      ].map(mask => (
                         <button 
                           key={mask.id}
                           onClick={() => handleUpdateClip(selectedClipId, { maskType: mask.id as any })}
                           className={cn(
                             "flex flex-col items-center gap-4 p-6 rounded-2xl border transition-all",
                             selectedClip?.maskType === mask.id ? "bg-white text-black border-white" : "bg-white/5 border-white/5 text-white/30"
                           )}
                         >
                            {mask.icon && <mask.icon className="w-8 h-8" />}
                            <span className="text-[10px] font-black uppercase tracking-widest">{mask.label}</span>
                         </button>
                      ))}
                   </div>
                )}
                {activeTab === 'transition' && selectedClipId && (
                  <div className="space-y-6 py-4">
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { id: 'none', label: 'Tiada', icon: X },
                        { id: 'fade', label: 'Dissolve', color: 'bg-white/10' },
                        { id: 'black', label: 'Ke Hitam', color: 'bg-black border border-white/10' },
                        { id: 'white', label: 'Ke Putih', color: 'bg-white' },
                        { id: 'slide-left', label: 'Geser Kiri', color: 'bg-blue-500/20' },
                        { id: 'slide-right', label: 'Geser Kanan', color: 'bg-blue-500/20' },
                        { id: 'slide-up', label: 'Geser Atas', color: 'bg-blue-500/20' },
                        { id: 'slide-down', label: 'Geser Bawah', color: 'bg-blue-500/20' },
                        { id: 'zoom', label: 'Zoom In', color: 'bg-purple-500/20' },
                        { id: 'zoom-out', label: 'Zoom Out', color: 'bg-purple-500/20' },
                        { id: 'blur', label: 'Blur', color: 'bg-teal-500/20' },
                        { id: 'glitch', label: 'Glitch', color: 'bg-red-500/20' },
                      ].map(trans => (
                        <button
                          key={trans.id}
                          onClick={() => handleUpdateClip(selectedClipId, { 
                            transitionType: trans.id as any,
                            transitionDuration: 0.5 
                          })}
                          className={cn(
                            "group flex flex-col items-center gap-3 transition-all active:scale-95",
                            selectedClip?.transitionType === trans.id ? "opacity-100" : "opacity-40 hover:opacity-100"
                          )}
                        >
                           <div className={cn(
                             "w-full aspect-square rounded-2xl flex items-center justify-center transition-all border",
                             selectedClip?.transitionType === trans.id ? "border-[#00c2cb] ring-4 ring-[#00c2cb]/20" : "border-white/5",
                             trans.color || "bg-white/5"
                           )}>
                              {trans.icon ? <trans.icon className="w-8 h-8 text-white" /> : <div className="w-8 h-1 rounded-full bg-white/20" />}
                           </div>
                           <span className={cn(
                             "text-[9px] font-black uppercase text-center tracking-tighter transition-colors",
                             selectedClip?.transitionType === trans.id ? "text-[#00c2cb]" : "text-white/40 group-hover:text-white"
                           )}>
                             {trans.label}
                           </span>
                        </button>
                      ))}
                    </div>

                    {selectedClip?.transitionType && selectedClip.transitionType !== 'none' && (
                      <div className="space-y-4 px-2 mt-4 pt-4 border-t border-white/5">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase text-white/30">
                           <span>Durasi Transisi</span>
                           <span className="text-white">{(selectedClip?.transitionDuration || 0.5).toFixed(1)}s</span>
                        </div>
                        <input 
                          type="range" min="0.1" max="2.0" step="0.1"
                          value={selectedClip?.transitionDuration || 0.5}
                          onChange={(e) => handleUpdateClip(selectedClipId, { transitionDuration: parseFloat(e.target.value) })}
                          className="w-full accent-[#00c2cb] h-1.5 bg-white/10 rounded-full appearance-none"
                        />
                      </div>
                    )}
                  </div>
                )}
                {activeTab === 'speed-curve' && selectedClipId && (
                   <div className="space-y-6 py-4">
                      <div className="grid grid-cols-2 gap-3">
                         {[
                           { id: 'none', label: 'Default' },
                           { id: 'montage', label: 'Montase' },
                           { id: 'hero', label: 'Hero' },
                           { id: 'bullet', label: 'Peluru' },
                           { id: 'flash-in', label: 'Flash In' },
                           { id: 'flash-out', label: 'Flash Out' },
                         ].map(curve => (
                            <button 
                              key={curve.id}
                              onClick={() => handleUpdateClip(selectedClipId, { speedCurve: curve.id as any })}
                              className={cn(
                                "py-8 rounded-2xl border flex flex-col items-center justify-center gap-3 transition-all",
                                selectedClip?.speedCurve === curve.id ? "bg-white text-black border-white shadow-lg" : "bg-white/5 border-white/5 text-white/30 hover:bg-white/10"
                              )}
                            >
                               <div className="w-12 h-6 border-2 border-current opacity-20 rounded-lg flex items-center justify-center">
                                  <div className="w-full h-[2px] bg-current transform rotate-12" />
                               </div>
                               <span className="text-[10px] font-black uppercase tracking-widest">{curve.label}</span>
                            </button>
                         ))}
                      </div>
                   </div>
                )}
                {activeTab === 'filters-edit' && selectedClipId && (
                   <div className="grid grid-cols-3 gap-4 pb-8">
                     {(['none', 'grayscale', 'sepia', 'vintage', 'cold'] as const).map(f => (
                        <button 
                          key={f}
                          onClick={() => handleUpdateClip(selectedClipId, { filter: f })}
                          className={cn(
                            "flex flex-col gap-2 transition-all",
                            selectedClip?.filter === f ? "opacity-100" : "opacity-40"
                          )}
                        >
                           <div className="aspect-square bg-white/10 rounded-xl overflow-hidden border border-white/10">
                              <div className={cn("w-full h-full bg-gradient-to-br from-purple-500 to-pink-500", f !== 'none' ? f : "")} />
                           </div>
                           <span className="text-[8px] font-black uppercase text-center">{f}</span>
                        </button>
                     ))}
                   </div>
                )}
                {activeTab === 'blend' && selectedClipId && (
                   <div className="space-y-8 py-4">
                      <div className="space-y-4">
                         <div className="flex justify-between items-center text-[10px] font-black uppercase text-white/30">
                            <span>Opasitas</span>
                            <span className="text-white">{Math.round((selectedClip?.opacity || 1) * 100)}%</span>
                         </div>
                         <input 
                           type="range" min="0" max="1" step="0.01"
                           value={selectedClip?.opacity || 1}
                           onChange={(e) => handleUpdateClip(selectedClipId, { opacity: parseFloat(e.target.value) })}
                           className="w-full accent-white"
                         />
                      </div>
                   </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export Overlay */}
      <AnimatePresence>
        {showExportDrawer && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 md:p-8"
          >
             {/* Toast Success */}
             <AnimatePresence>
               {showExportSuccess && (
                 <motion.div 
                   initial={{ y: -50, opacity: 0 }}
                   animate={{ y: 0, opacity: 1 }}
                   exit={{ y: -50, opacity: 0 }}
                   className="absolute top-10 left-1/2 -translate-x-1/2 z-[1100] bg-[#00c2cb] px-6 py-3 rounded-full flex items-center gap-3 shadow-[0_10px_30px_rgba(0,194,203,0.4)]"
                 >
                   <Check className="w-5 h-5 text-white" />
                   <span className="text-sm font-black uppercase text-white tracking-widest">Ekspor Berhasil!</span>
                 </motion.div>
               )}
             </AnimatePresence>             <motion.div 
               initial={{ scale: 0.9, opacity: 0, y: 50 }}
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.95, opacity: 0, y: 20 }}
               className="w-full max-w-[500px] h-fit p-10 bg-[#0c0c0c] rounded-[40px] border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.9)] flex flex-col items-center relative overflow-hidden"
             >
                {/* Exporting Global Overlay */}
                <div className="flex flex-col items-center justify-center gap-8 w-full">
                  {showExportSuccess ? (
                    <motion.div 
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex flex-col items-center gap-6"
                    >
                      <div className="w-24 h-24 bg-[#00c2cb] rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(0,194,203,0.4)]">
                        <Check className="w-12 h-12 text-white stroke-[4]" />
                      </div>
                      <div className="text-center space-y-2">
                        <h3 className="text-2xl font-black text-white uppercase tracking-[0.2em]">BERHASIL!</h3>
                        <p className="text-[12px] text-white/40 uppercase tracking-widest leading-relaxed">
                          Video {(parseFloat(exportSize || '0')).toFixed(1)} MB disimpan.<br/>Cek Galeri atau folder Download.
                        </p>
                      </div>
                      
                      <div className="flex flex-col gap-3 w-full">
                        <button 
                          onClick={() => {
                            if (exportBlob) {
                              const url = URL.createObjectURL(exportBlob);
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = exportFileName;
                              link.click();
                            }
                          }}
                          className="w-full py-4 bg-[#00c2cb] rounded-2xl text-[11px] font-black text-white hover:bg-[#00dae4] transition-all uppercase tracking-widest flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(0,194,203,0.2)]"
                        >
                          <Download className="w-4 h-4" />
                          Simpan Manual (Download)
                        </button>
                        
                        <button 
                          onClick={() => setShowExportDrawer(false)}
                          className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-[11px] font-black text-white/40 hover:bg-white/10 hover:text-white transition-all uppercase tracking-widest"
                        >
                          Tutup
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <>
                      <div className="relative w-44 h-44 flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90">
                          <circle cx="88" cy="88" r="80" fill="none" stroke="white" strokeWidth="2" className="opacity-5" />
                          <motion.circle 
                            cx="88" cy="88" r="80" fill="none" stroke="#00c2cb" strokeWidth="4" 
                            strokeDasharray={502} strokeDashoffset={502 * (1 - exportProgress / 100)}
                            strokeLinecap="round" className="transition-all duration-300"
                          />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                           <span className="text-4xl font-black text-white italic tracking-tighter tabular-nums">
                             {exportProgress}%
                           </span>
                           <span className="text-[10px] font-black text-[#00c2cb] uppercase tracking-widest mt-1">Rendering</span>
                        </div>
                      </div>
                      
                      <div className="w-full h-32 rounded-2xl overflow-hidden border border-white/10 relative">
                        <Preview 
                          clips={clips}
                          currentTime={currentTime}
                          selectedClipId={null}
                          aspectRatio={aspectRatio}
                          isMuted={true}
                        />
                        <div className="absolute inset-0 bg-[#00c2cb]/10 animate-pulse pointer-events-none" />
                      </div>

                      <div className="text-center space-y-4">
                        <h3 className="text-xl font-black text-white uppercase tracking-[0.4em] italic">Sedang Mengekspor...</h3>
                        <div className="flex flex-col gap-2">
                          <p className="text-[11px] text-white/40 uppercase tracking-widest font-bold">Mohon jangan tutup aplikasi ini</p>
                          <p className="text-[9px] text-[#00c2cb] uppercase tracking-[0.2em] italic font-black animate-pulse">
                            {exportProgress < 20 ? 'Menyiapkan aset...' : 
                             exportProgress < 60 ? 'Memproses filter...' : 
                             exportProgress < 80 ? 'Encoding frame...' : 
                             exportProgress < 95 ? (ffmpegLog || 'Mengonversi ke MP4 (HQ)...') : 'Menyimpan Proyek ke Android...'}
                          </p>
                          {exportProgress >= 80 && exportProgress < 100 && ffmpegLog && (
                            <p className="text-[7px] text-white/20 font-mono mt-1 opacity-50 truncate max-w-[200px]">
                              {ffmpegLog}
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {!isExporting && !showExportSuccess && (
                  <button 
                    onClick={() => setShowExportDrawer(false)}
                    className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-all z-20"
                  >
                     <X className="w-5 h-5" />
                  </button>
                )}
             </motion.div>
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
