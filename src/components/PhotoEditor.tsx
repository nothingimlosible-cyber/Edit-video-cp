import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, Download, Image as ImageIcon, Type, Sliders, ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface PhotoEditorProps {
  onBack: () => void;
}

export default function PhotoEditor({ onBack }: PhotoEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [text, setText] = useState('Ini adalah tempat terpencil dan banyak tangan di Sulawesi');
  const [label, setLabel] = useState('ILUSTRASI');
  const [lineWidth, setLineWidth] = useState(200);
  const [textYPos, setTextYPos] = useState(650);
  const [fontSize, setFontSize] = useState(40);
  const [isControlsVisible, setIsControlsVisible] = useState(true);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, 800, 800);

    // Draw image
    if (image) {
      ctx.drawImage(image, 0, 0, 800, 480);
    } else {
      ctx.fillStyle = "#222";
      ctx.fillRect(0, 0, 800, 480);
      ctx.fillStyle = "#444";
      ctx.font = "bold 30px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Upload Foto untuk Memulai", 400, 240);
    }

    // Draw Label
    ctx.font = "bold 18px Inter, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.shadowColor = "black";
    ctx.shadowBlur = 4;
    ctx.fillText(label.toUpperCase(), 25, 465);
    ctx.shadowBlur = 0;

    // Draw Divider Line
    ctx.fillStyle = "#f1c40f";
    ctx.fillRect(0, 480, 800, 5);

    // Draw Main Text
    ctx.fillStyle = "#ffffff";
    ctx.font = `500 ${fontSize}px Inter, sans-serif`;
    
    const words = text.split(' ');
    let line = '';
    let currentY = textYPos;
    const maxWidth = 700;
    const lineHeight = fontSize * 1.3;

    for (let n = 0; n < words.length; n++) {
      let testLine = line + words[n] + ' ';
      let testWidth = ctx.measureText(testLine).width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, 50, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 50, currentY);

    // Draw Accent Line below text
    ctx.fillStyle = "#f1c40f";
    ctx.fillRect(50, currentY + 15, lineWidth, 6);
  }, [image, text, label, lineWidth, textYPos, fontSize]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'capstream-photo-edit.png';
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden font-sans">
      {/* Header */}
      <header className="p-4 flex items-center justify-between border-b border-[#111] bg-black/50 backdrop-blur-md z-50">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-center bg-[#111] active:scale-95 transition-transform"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex flex-col">
            <span className="text-lg text-title">PHOTO ENGINE</span>
            <span className="text-[7px] font-black text-[#666] tracking-widest uppercase">Alan Studio v13.2</span>
          </div>
        </div>
        <button 
          onClick={downloadImage}
          className="btn-bold !bg-yellow-500 !text-black !px-4 !py-2 flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          <span className="text-[10px] uppercase">SIMPAN PNG</span>
        </button>
      </header>

      {/* Preview Area */}
      <main className="flex-1 overflow-y-auto no-scrollbar pb-64 flex flex-col items-center">
        <div className="w-full max-w-sm mt-8 px-4">
          <div className="relative aspect-square w-full bg-[#111] border border-[#222] shadow-2xl overflow-hidden rounded-lg">
             <canvas 
              ref={canvasRef} 
              width={800} 
              height={800} 
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center gap-2 opacity-50">
           <span className="text-[8px] font-black text-[#444] uppercase tracking-[0.3em]">Canvas 800x800</span>
           <div className="w-1 h-8 bg-gradient-to-b from-[#222] to-transparent" />
        </div>
      </main>

      {/* Controls Panel */}
      <div className={cn(
        "fixed bottom-0 left-0 w-full bg-zinc-900 border-t border-zinc-800 p-5 z-50 rounded-t-3xl transition-transform duration-300 pb-[calc(1.25rem+env(safe-area-inset-bottom))]",
        !isControlsVisible && "translate-y-[calc(100%-54px-env(safe-area-inset-bottom))]"
      )}>
        <button 
          onClick={() => setIsControlsVisible(!isControlsVisible)}
          className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-500 shadow-xl z-50"
        >
          {isControlsVisible ? <ChevronDown className="w-4 h-4" /> : <ChevronDown className="w-4 h-4 rotate-180" />}
        </button>

        <div className="max-w-md mx-auto space-y-4 pt-2">
            <div className="flex gap-2">
                <input 
                  type="file" 
                  id="uploadFile" 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleFileUpload}
                />
                <button 
                  onClick={() => document.getElementById('uploadFile')?.click()}
                  className="flex-1 bg-zinc-800 text-white text-[10px] font-bold py-3 rounded-xl border border-zinc-700 flex items-center justify-center gap-2 uppercase tracking-widest active:scale-95 duration-200"
                > 
                  <ImageIcon className="w-4 h-4" />
                  Pilih Foto
                </button>
            </div>

            <div className="space-y-1">
               <label className="text-[9px] text-zinc-500 block font-bold uppercase tracking-widest">Teks Utama</label>
               <textarea 
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={2} 
                className="w-full bg-black p-3 rounded-xl text-xs border border-zinc-700 outline-none focus:border-yellow-500 transition-colors" 
                placeholder="Tulis Judul..."
              />
            </div>
            
            <div className="space-y-1">
               <label className="text-[9px] text-zinc-500 block font-bold uppercase tracking-widest">Label</label>
               <input 
                type="text" 
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full bg-black p-3 rounded-xl text-xs border border-zinc-700 outline-none focus:border-yellow-500 transition-colors" 
                placeholder="Label (ilustrasi/asli)"
              />
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                       <label className="text-[9px] text-zinc-500 block font-bold uppercase tracking-widest">Garis</label>
                       <span className="text-[8px] text-white font-mono">{lineWidth}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="10" 
                      max="650" 
                      value={lineWidth}
                      onChange={(e) => setLineWidth(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-black rounded-lg appearance-none accent-yellow-500 cursor-pointer"
                    />
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                       <label className="text-[9px] text-zinc-500 block font-bold uppercase tracking-widest">Posisi</label>
                       <span className="text-[8px] text-white font-mono">{textYPos}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="500" 
                      max="750" 
                      value={textYPos}
                      onChange={(e) => setTextYPos(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-black rounded-lg appearance-none accent-white cursor-pointer"
                    />
                </div>
                <div className="col-span-2 space-y-2">
                    <div className="flex justify-between items-center">
                       <label className="text-[9px] text-zinc-500 block font-bold uppercase tracking-widest">Ukuran Teks</label>
                       <span className="text-[8px] text-white font-mono">{fontSize}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="20" 
                      max="80" 
                      value={fontSize}
                      onChange={(e) => setFontSize(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-black rounded-lg appearance-none accent-blue-500 cursor-pointer"
                    />
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
