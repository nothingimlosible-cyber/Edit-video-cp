import { Plus, Scissors, Music, Type, Wand2, Layers, Smile, MessageSquare, Filter, Sliders, ChevronUp, FastForward, Target, Square, Palette, Volume2, Trash2, Maximize2, RotateCw, ChevronLeft, Copy } from 'lucide-react';
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
  canSplit: boolean;
  selectedClipType?: string | null;
}

const TOOL_BARS = {
  main: [
    { id: 'edit-root', icon: Scissors, label: 'Edit' },
    { id: 'audio', icon: Music, label: 'Audio' },
    { id: 'text', icon: Type, label: 'Teks' },
    { id: 'effects', icon: Wand2, label: 'Efek' },
    { id: 'overlay', icon: Layers, label: 'Overlay' },
    { id: 'captions', icon: MessageSquare, label: 'Keterangan' },
    { id: 'impor', icon: Plus, label: 'Tambah' },
    { id: 'ratio', icon: Maximize2, label: 'Aspek' },
    { id: 'canvas', icon: Square, label: 'Kanvas' },
    { id: 'adjust-root', icon: Sliders, label: 'Sesuaikan' },
  ],
  edit: [
    { id: 'back', icon: ChevronLeft, label: 'Menu', action: 'back' },
    { id: 'split', icon: Scissors, label: 'Bagi', action: 'split' },
    { id: 'speed', icon: FastForward, label: 'Kecepatan' },
    { id: 'animation', icon: Wand2, label: 'Animasi' },
    { id: 'blend', icon: Layers, label: 'Campuran' },
    { id: 'effects', icon: Wand2, label: 'Efek' },
    { id: 'transition', icon: Layers, label: 'Transisi' },
    { id: 'transform', icon: RotateCw, label: 'Transform' },
    { id: 'chroma', icon: Wand2, label: 'Hapus Latar' },
    { id: 'filters', icon: Filter, label: 'Filter' },
    { id: 'adjust', icon: Sliders, label: 'Sesuaikan' },
    { id: 'volume', icon: Volume2, label: 'Volume' },
    { id: 'audio-fade', icon: Music, label: 'Luntur' },
    { id: 'duration', icon: Scissors, label: 'Durasi' },
    { id: 'keyframes', icon: Target, label: 'Keyframe' },
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
              "flex-shrink-0 w-[78px] h-full flex flex-col items-center justify-center gap-1.5 transition-all snap-center",
              activeTab === tool.id ? "text-white" : "text-[#999] hover:text-white"
            )}
            onClick={() => {
              if (tool.id === 'back') onTabChange('main');
              else if (tool.id === 'split') onSplit();
              else if (tool.id === 'copy') onCopy();
              else if (tool.id === 'delete') onDelete();
              else if (tool.id === 'impor') onAddMedia();
              else if (tool.id === 'text' && !isEditMode) onAddText();
              else if (tool.id === 'overlay' && !isEditMode) onAddOverlay();
              else if (tool.id === 'audio' && !isEditMode) onAddAudio();
              else if (tool.id === 'edit-root') {
                onTabChange('edit');
              }
              else onTabChange(tool.id);
            }}
          >
            <div className={cn(
              "p-1.5 rounded-lg transition-transform",
              activeTab === tool.id ? "scale-110" : ""
            )}>
              <tool.icon className={cn("w-6 h-6 stroke-[2.2]", activeTab === tool.id && "text-white")} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-tight leading-none whitespace-nowrap">{tool.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
