import { Plus, Scissors, Music, Type, Wand2, Layers, Smile, MessageSquare, Filter, Sliders, ChevronUp, FastForward, Target, Square, Palette, Volume2, Trash2, Maximize2, RotateCw, ChevronLeft, Copy, Diamond, Move, Crop } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';

interface ToolbarProps {
  activeTab: string;
  onTabChange: (tab: any) => void;
  onSplit: () => void;
  onCopy: () => void;
  onAddText: () => void;
  onAddOverlay: () => void;
  onAddSticker: () => void;
  onAddAudio: () => void;
  onAddMedia: () => void;
  onDelete: () => void;
  onToggleKeyframe?: () => void;
  canSplit: boolean;
  selectedClipType?: string | null;
}

const TOOL_BARS = {
  main: [
    { id: 'media', icon: Plus, label: 'Media' },
    { id: 'audio', icon: Music, label: 'Audio' },
    { id: 'text', icon: Type, label: 'Teks' },
    { id: 'overlay', icon: Layers, label: 'Overlay' },
    { id: 'effects', icon: Wand2, label: 'Efek' },
    { id: 'filters', icon: Filter, label: 'Filter' },
    { id: 'adjust-root', icon: Sliders, label: 'Sesuaikan' },
    { id: 'stickers', icon: Smile, label: 'Stiker' },
    { id: 'canvas', icon: Square, label: 'Kanvas' },
    { id: 'ratio', icon: Maximize2, label: 'Rasio' },
  ],
  edit: [
    { id: 'back', icon: ChevronLeft, label: 'Kembali', action: 'back' },
    { id: 'split', icon: Scissors, label: 'Bagi', action: 'split' },
    { id: 'transform', icon: Crop, label: 'Dasar' },
    { id: 'keyframe', icon: Diamond, label: 'Keyframe', action: 'keyframe' },
    { id: 'speed', icon: FastForward, label: 'Kecepatan' },
    { id: 'animation', icon: Wand2, label: 'Animasi' },
    { id: 'blend', icon: Layers, label: 'Campuran' },
    { id: 'mask', icon: Target, label: 'Masking' },
    { id: 'chroma', icon: Wand2, label: 'Hapus Latar' },
    { id: 'filters', icon: Filter, label: 'Filter' },
    { id: 'adjust', icon: Sliders, label: 'Sesuaikan' },
    { id: 'volume', icon: Volume2, label: 'Volume' },
    { id: 'audio-fade', icon: Music, label: 'Luntur' },
    { id: 'copy', icon: Copy, label: 'Salin', action: 'copy' },
    { id: 'delete', icon: Trash2, label: 'Hapus', action: 'delete' },
  ]
};

export default function Toolbar({ 
  activeTab, 
  onTabChange, 
  onSplit, 
  onCopy,
  onAddText, 
  onAddOverlay,
  onAddSticker,
  onAddAudio,
  onAddMedia,
  onDelete,
  onToggleKeyframe,
  canSplit,
  selectedClipType
}: ToolbarProps) {
  // If we are in a sub-menu (like 'adjust' or 'animation'), we don't show the toolbar, 
  // the Editor component handles the sub-menu UI. 
  // But we need to know if we are in ROOT or EDIT mode.
  const isEditMode = activeTab === 'edit' || canSplit;
  let currentTools = isEditMode ? [...TOOL_BARS.edit] : [...TOOL_BARS.main];
  
  if (isEditMode && selectedClipType === 'text') {
    // For text clips, ensure text editing is prominent
    if (!currentTools.find(t => t.id === 'text')) {
      currentTools.splice(2, 0, { id: 'text', icon: Type, label: 'Ubah Teks' });
    }
  }

  return (
    <div className="bg-black border-t border-white/5 w-full h-full relative">
      <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />
      <div className="flex overflow-x-auto no-scrollbar h-full items-center px-4 gap-0 w-full touch-pan-x overscroll-contain snap-x">
        {currentTools.map((tool) => (
          <motion.button
            key={tool.id}
            whileTap={{ scale: 0.9 }}
            className={cn(
              "flex-shrink-0 w-[64px] h-full flex flex-col items-center justify-center gap-1 transition-all snap-center",
              activeTab === tool.id ? "text-white" : "text-[#999] hover:text-white"
            )}
            onClick={() => {
              if (window.navigator.vibrate) window.navigator.vibrate(10);
              if (tool.id === 'back') onTabChange('main');
              else if (tool.id === 'split') onSplit();
              else if (tool.id === 'keyframe') onToggleKeyframe?.();
              else if (tool.id === 'copy') onCopy();
              else if (tool.id === 'delete') onDelete();
              else if (tool.id === 'media' && !isEditMode) onAddMedia();
              else if (tool.id === 'text' && !isEditMode) onAddText();
              else if (tool.id === 'overlay' && !isEditMode) onAddOverlay();
              else if (tool.id === 'audio' && !isEditMode) onTabChange('audio');
              else if (tool.id === 'edit-root') {
                onTabChange('edit');
              }
              else onTabChange(tool.id);
            }}
          >
            <div className={cn(
              "p-2 rounded-xl transition-all duration-300",
              activeTab === tool.id ? "bg-white/10 scale-110 shadow-[0_0_20px_rgba(255,255,255,0.05)]" : ""
            )}>
              <tool.icon className={cn("w-5 h-5 stroke-[2]", activeTab === tool.id ? "text-white" : "text-white/80")} />
            </div>
            <span className={cn(
              "text-[9px] font-bold tracking-tight whitespace-nowrap",
              activeTab === tool.id ? "text-white font-bold" : "text-white/60"
            )}>{tool.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
