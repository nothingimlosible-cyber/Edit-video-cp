import React from 'react';
import { Target, Move, Maximize, Circle, Trash2, Plus, Sun, Contrast, Droplets, Zap, Filter, Share2 } from 'lucide-react';
import { Clip, Keyframe } from '../../types/editor';
import { cn } from '../../lib/utils';

interface KeyframePanelProps {
  clip: Clip;
  currentTime: number;
  onUpdateKeyframe: (keyframe: Keyframe) => void;
  onRemoveKeyframe: (time: number) => void;
}

export default function KeyframePanel({ clip, currentTime, onUpdateKeyframe, onRemoveKeyframe }: KeyframePanelProps) {
  const relativeTime = currentTime - clip.start;
  const currentKeyframe = clip.keyframes.find(kf => Math.abs(kf.time - relativeTime) < 0.1);
  const isAtKeyframe = !!currentKeyframe;

  const handlePropertyChange = (prop: keyof Omit<Keyframe, 'time'>, value: number) => {
    onUpdateKeyframe({
      ...(currentKeyframe || { time: relativeTime }),
      [prop]: value
    });
  };

  const properties = [
    { key: 'scale', label: 'Skala', icon: Maximize, min: 0.1, max: 3, step: 0.01, unit: 'x' },
    { key: 'opacity', label: 'Opasitas', icon: Circle, min: 0, max: 1, step: 0.01, unit: '%' },
    { key: 'x', label: 'Posisi X', icon: Move, min: -1000, max: 1000, step: 1, unit: 'px' },
    { key: 'y', label: 'Posisi Y', icon: Move, min: -1000, max: 1000, step: 1, unit: 'px' },
    { key: 'rotation', label: 'Rotasi', icon: Zap, min: -360, max: 360, step: 1, unit: '°' },
    { key: 'brightness', label: 'Cerah', icon: Sun, min: 0, max: 200, step: 1, unit: '%' },
    { key: 'contrast', label: 'Kontras', icon: Contrast, min: 0, max: 200, step: 1, unit: '%' },
    { key: 'saturation', label: 'Saturasi', icon: Droplets, min: 0, max: 200, step: 1, unit: '%' },
    { key: 'blur', label: 'Kabur', icon: Filter, min: 0, max: 50, step: 1, unit: 'px' },
    { key: 'hue', label: 'Rona', icon: Zap, min: -180, max: 180, step: 1, unit: '°' },
    { key: 'sharpen', label: 'Tajam', icon: Target, min: 0, max: 100, step: 1, unit: '%' },
    { key: 'vignette', label: 'Vinyet', icon: Circle, min: 0, max: 100, step: 1, unit: '%' },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="text-[10px] font-black text-white/20 tracking-[0.3em] uppercase">Control Panel</h3>
          <span className="text-[9px] font-bold text-white/10 uppercase">Frame: {Math.round(relativeTime * 30)}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {}}
            className="flex items-center gap-2 px-3 py-1.5 border border-white/5 bg-white/5 text-white/40 font-black text-[9px] uppercase tracking-widest hover:text-white transition-colors"
          >
            <Share2 className="w-3 h-3" />
            Curves
          </button>
          <button
            onClick={() => isAtKeyframe ? onRemoveKeyframe(currentKeyframe.time) : onUpdateKeyframe({ 
              time: relativeTime, 
              scale: clip.scale, x: clip.x, y: clip.y, opacity: clip.opacity, 
              brightness: clip.brightness ?? 100, contrast: clip.contrast ?? 100, saturation: clip.saturation ?? 100,
              rotation: clip.rotation ?? 0, hue: clip.hue ?? 0, blur: clip.blur ?? 0,
              sharpen: clip.sharpen ?? 0, vignette: clip.vignette ?? 0
            })}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 border font-black text-[9px] uppercase tracking-widest transition-colors",
              isAtKeyframe ? "border-red-500/50 text-red-500 bg-red-500/10" : "border-white bg-white text-black"
            )}
          >
            {isAtKeyframe ? <Trash2 className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {isAtKeyframe ? "Hapus" : "Tambah"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-6">
        {properties.map((prop: any) => {
          const val = (currentKeyframe?.[prop.key] as any) ?? (clip as any)[prop.key] ?? (prop.key === 'hue' || prop.key === 'blur' || prop.key === 'rotation' || prop.key === 'x' || prop.key === 'y' ? 0 : prop.key === 'scale' || prop.key === 'opacity' ? 1 : 100);
          return (
            <div key={prop.key} className="space-y-2">
               <div className="flex items-center justify-between text-white/40">
                  <div className="flex items-center gap-2">
                    <prop.icon className={cn("w-3 h-3", prop.key === 'x' && "rotate-90")} />
                    <span className="text-[8px] font-black uppercase tracking-widest">{prop.label}</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-white/60">
                    {prop.unit === '%' ? `${Math.round(val * (prop.key === 'opacity' ? 100 : 1))}` : val.toFixed(prop.step < 1 ? 2 : 0)}{prop.unit}
                  </span>
               </div>
               <input 
                  type="range" 
                  min={prop.min} 
                  max={prop.max} 
                  step={prop.step}
                  value={val}
                  onChange={(e) => handlePropertyChange(prop.key, parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/5 rounded-full appearance-none accent-white cursor-pointer hover:bg-white/10 transition-colors"
               />
            </div>
          );
        })}
      </div>

      {/* Curve Preview (Visual Placeholder) */}
      <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/5 space-y-3">
        <div className="flex items-center justify-between">
           <span className="text-[8px] font-black uppercase text-white/20 tracking-widest">Velocity Curve</span>
           <span className="text-[8px] font-black text-white/60">Linear</span>
        </div>
        <div className="h-12 w-full relative">
           <svg className="w-full h-full text-white/10" viewBox="0 0 100 20">
              <path d="M 0 20 L 100 0" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2" />
           </svg>
           <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-red-500/50" />
        </div>
      </div>
    </div>
  );
}
