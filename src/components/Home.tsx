import React, { useRef } from 'react';
import { Plus, Image, Scissors, Sparkles, Camera, Cloud, LayoutGrid, User, Search, Settings } from 'lucide-react';
import { motion } from 'motion/react';
import { Project } from '../types/editor';

interface HomeProps {
  onCreateProject: (files?: FileList | null) => void;
  onOpenProject: (project: Project) => void;
  onOpenPhotoEditor: () => void;
}

const TOOLS = [
  { icon: Scissors, label: 'AutoCut', color: 'text-white' },
  { icon: Camera, label: 'Retouch', color: 'text-white' },
  { icon: Cloud, label: 'Ruang', color: 'text-white' },
  { icon: Sparkles, label: 'Pembuat AI', color: 'text-white' },
  { icon: Sparkles, label: 'Sempurnakan', color: 'text-white' },
  { icon: Image, label: 'Alat foto', color: 'text-white' },
  { icon: LayoutGrid, label: 'Pemasaran', color: 'text-white' },
  { icon: LayoutGrid, label: 'Desktop', color: 'text-white', badge: 'Keuntungan' },
  { icon: User, label: 'Hapus latar', color: 'text-white' },
];

const RECENT_PROJECTS: Project[] = [
  {
    id: '1',
    name: 'Video 0508-1',
    duration: 15,
    fps: 30,
    resolution: '1080p',
    aspectRatio: '9:16',
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
    thumbnail: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=200&auto=format&fit=crop',
    clips: []
  },
  {
    id: '2',
    name: 'Video 0508-2',
    duration: 10,
    fps: 30,
    resolution: '1080p',
    aspectRatio: '9:16',
    createdAt: Date.now() - 1000 * 60 * 60 * 25,
    thumbnail: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=200&auto=format&fit=crop',
    clips: []
  },
  {
    id: '3',
    name: 'Video 0508-3',
    duration: 5,
    fps: 30,
    resolution: '1080p',
    aspectRatio: '16:9',
    createdAt: Date.now() - 1000 * 60 * 60 * 26,
    thumbnail: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=200&auto=format&fit=crop',
    clips: []
  }
];

export default function Home({ onCreateProject, onOpenProject, onOpenPhotoEditor }: HomeProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onCreateProject(files);
    }
  };

  return (
    <div className="flex flex-col h-screen h-[100dvh] overflow-hidden bg-[#050505]">
      <div className="flex-1 overflow-y-auto pb-20">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept="video/*,image/*"
        multiple
      />

      {/* Header */}
      <header className="p-4 flex items-center justify-between border-b border-[#222]">
        <div className="flex flex-col">
          <h1 className="text-2xl text-title">CAPSTREAM</h1>
          <span className="text-[8px] font-black text-[#666] tracking-[0.2em] uppercase">Mobile Editor</span>
        </div>
        <div className="flex items-center gap-4">
          <Search className="w-5 h-5 text-[#444]" />
          <Settings className="w-5 h-5 text-[#444]" />
        </div>
      </header>

      {/* Main Action Area */}
      <div className="px-6 mt-6">
        <div className="flex items-center justify-between mb-6">
           <h2 className="text-[14px] font-black text-white/40 tracking-[0.2em] uppercase">Mulai Proyek</h2>
           <div className="flex gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
              <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
           </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleImportClick}
            className="group relative bg-[#0f0f0f] border border-white/5 aspect-[4/5] rounded-3xl flex flex-col items-center justify-center transition-all hover:bg-[#151515] hover:border-white/10 active:scale-95 overflow-hidden"
          >
            {/* Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />
            
            <div className="w-24 h-24 bg-white text-black rounded-lg flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(255,255,255,0.1)] group-hover:scale-110 transition-transform duration-500">
              <Plus className="w-12 h-12 stroke-[3px]" />
            </div>
            
            <div className="flex flex-col items-center gap-1.5 z-10">
              <span className="text-[20px] font-black uppercase tracking-tighter text-white">Proyek Baru</span>
              <div className="px-3 py-1 bg-white/5 rounded-full border border-white/5">
                <span className="text-[9px] font-bold text-white/40 tracking-wider uppercase">Impor Media</span>
              </div>
            </div>
          </button>

          <button
            onClick={onOpenPhotoEditor}
            className="group relative bg-[#0f0f0f] border border-white/5 aspect-[4/5] rounded-3xl flex flex-col items-center justify-center transition-all hover:bg-[#151515] hover:border-white/10 active:scale-95 overflow-hidden"
          >
            <div className="w-24 h-24 bg-white/5 text-white/30 rounded-lg flex items-center justify-center mb-6 border border-white/10 group-hover:bg-white group-hover:text-black transition-all duration-500">
              <Image className="w-10 h-10 stroke-[1.5px]" />
            </div>
            
            <div className="flex flex-col items-center gap-1.5 z-10 text-center">
              <span className="text-[20px] font-black uppercase tracking-tighter text-white/40 group-hover:text-white transition-colors">Edit Foto</span>
              <span className="text-[9px] font-bold text-white/20 tracking-wider uppercase">Photo Engine</span>
            </div>
          </button>
        </div>
      </div>

      {/* Recent Projects */}
      <div className="px-6 mt-10">
        <h2 className="text-[10px] font-black text-[#666] tracking-[0.2em] uppercase mb-4">Proyek Terbaru</h2>
        <div className="flex overflow-x-auto gap-4 no-scrollbar pb-6">
          {RECENT_PROJECTS.map((project) => (
            <motion.button
              key={project.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => onOpenProject(project)}
              className="flex-shrink-0 w-32 flex flex-col gap-2 group"
            >
              <div className="aspect-[4/5] bg-[#111] border border-[#222] overflow-hidden relative group-hover:border-[#444] transition-colors">
                <img src={project.thumbnail} alt={project.name} className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500" />
                <div className="absolute top-0 left-0 p-1">
                   <div className="bg-black/80 px-1.5 py-0.5 border border-white/5">
                      <span className="text-[8px] font-black tracking-tighter">HD</span>
                   </div>
                </div>
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest truncate">{project.name}</span>
            </motion.button>
          ))}
          <button className="flex-shrink-0 w-32 aspect-[4/5] bg-[#111] border border-dashed border-[#333] flex flex-col items-center justify-center gap-2 opacity-40">
            <Plus className="w-4 h-4" />
            <span className="text-[8px] font-black uppercase">Semua</span>
          </button>
        </div>
      </div>

      {/* Tools Grid Area - Reimagined for Bold Theme */}
      <div className="px-6 mt-8">
        <div className="grid grid-cols-2 gap-px bg-[#222] border border-[#222]">
          {TOOLS.slice(0, 4).map((tool, idx) => (
            <div key={idx} className="bg-[#0e0e0e] flex items-center gap-3 p-4">
              <tool.icon className="w-4 h-4 text-[#444]" />
              <span className="text-[9px] font-black uppercase tracking-widest">{tool.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Copyright Notice */}
      <div className="mt-12 mb-8 flex flex-col items-center justify-center opacity-20">
        <span className="text-[10px] font-black tracking-[0.3em] uppercase">©LanAnonymous</span>
        <div className="w-12 h-[1px] bg-white mt-4" />
      </div>

      {/* Bottom Nav - Better spacing for mobile bars */}
      <nav className="fixed bottom-0 inset-x-0 bg-black/80 backdrop-blur-xl border-t border-white/5 h-[calc(80px+env(safe-area-inset-bottom))] px-8 flex justify-between items-center z-[100] pb-[calc(16px+env(safe-area-inset-bottom))]">
        {[
          { icon: Scissors, label: 'Edit', active: true },
          { icon: LayoutGrid, label: 'Template' },
          { icon: Sparkles, label: 'Lab AI' },
          { icon: Cloud, label: 'Proyek' },
          { icon: User, label: 'Saya' },
        ].map((item, idx) => (
          <div key={idx} className={cn("flex flex-col items-center gap-1 min-w-[50px]", item.active ? "text-white" : "text-[#444]")}>
            <item.icon className="w-4 h-4" />
            <span className="text-[8px] font-black uppercase tracking-tighter">{item.label}</span>
          </div>
        ))}
      </nav>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
