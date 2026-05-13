import { Clip, Project } from '../types/editor';
import { getClipPropertiesAtTime } from './editorUtils';

interface RenderOptions {
  width: number;
  height: number;
  fps: number;
}

export async function renderFrame(
  ctx: CanvasRenderingContext2D,
  clips: Clip[],
  currentTime: number,
  options: RenderOptions
) {
  const { width, height } = options;

  // Clear background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  // Filter visible clips
  const visibleClips = clips
    .filter(c => currentTime >= c.start && currentTime < c.start + c.duration)
    .sort((a, b) => a.layer - b.layer);

  for (const clip of visibleClips) {
    const props = getClipPropertiesAtTime(clip, currentTime) as any;
    const opacity = props.opacity ?? 1;
    if (opacity <= 0) continue;

    ctx.save();

    // Apply global opacity
    ctx.globalAlpha = opacity;

    // Center and transform
    ctx.translate(width / 2 + (props.x || 0), height / 2 + (props.y || 0));
    ctx.rotate(((props.rotation || 0) * Math.PI) / 180);
    ctx.scale(props.scale ?? 1, props.scale ?? 1);
    if (clip.horizontalFlip) ctx.scale(-1, 1);
    if (clip.verticalFlip) ctx.scale(1, -1);

    // Apply Filters
    let filterStr = '';
    if (props.brightness !== undefined) filterStr += `brightness(${props.brightness / 100}) `;
    if (props.contrast !== undefined) filterStr += `contrast(${(props.contrast + (props.sharpen || 0)) / 100}) `;
    if (props.saturation !== undefined) filterStr += `saturate(${props.saturation / 100}) `;
    if (props.hue !== undefined) filterStr += `hue-rotate(${props.hue}deg) `;
    if (props.blur !== undefined) filterStr += `blur(${props.blur}px) `;
    
    if (clip.filter === 'grayscale') filterStr += 'grayscale(1) ';
    if (clip.filter === 'sepia') filterStr += 'sepia(1) ';
    if (clip.filter === 'vintage') filterStr += 'sepia(0.5) brightness(0.8) contrast(1.2) ';
    
    if (filterStr) ctx.filter = filterStr.trim();

    // Draw content
    if (clip.type === 'photo' || clip.type === 'video') {
      try {
        const img = await getElementForClip(clip);
        if (img) {
          if (img instanceof HTMLVideoElement) {
            const relativeTime = (currentTime - clip.start) * (clip.speed || 1) + (clip.trimStart || 0);
            if (Math.abs(img.currentTime - relativeTime) > 0.1) {
              img.currentTime = relativeTime;
              await new Promise(r => {
                const onSeeked = () => {
                  img.removeEventListener('seeked', onSeeked);
                  r(null);
                };
                img.addEventListener('seeked', onSeeked);
                // Safety timeout
                setTimeout(onSeeked, 500);
              });
            }
          }

          const imgAspect = img instanceof HTMLVideoElement ? (img.videoWidth / img.videoHeight) : (img.width / img.height);
          let drawW, drawH;
          
          // Logic for fitting - CapCut usually does 'cover' or 'contain'
          // We'll calculate based on the actual image aspect relative to its container
          if (imgAspect > 1) {
            drawW = 1000; // Ref base width
            drawH = 1000 / imgAspect;
          } else {
            drawH = 1000; 
            drawW = 1000 * imgAspect;
          }

          ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        }
      } catch (e) {
        console.error('Failed to draw clip:', clip.id, e);
      }
    } else if (clip.type === 'text') {
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 10;
      ctx.fillStyle = 'white';
      ctx.font = 'black 60px Inter, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      if (clip.textStyle === 'white-shadow') {
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 15;
      } else if (clip.textStyle === 'glow') {
        ctx.shadowColor = 'white';
        ctx.shadowBlur = 20;
      }

      ctx.fillText(clip.text || '', 0, 0);
    }

    ctx.restore();
  }
}

// Memory cache for elements
const elementCache = new Map<string, HTMLImageElement | HTMLVideoElement>();

async function getElementForClip(clip: Clip): Promise<HTMLImageElement | HTMLVideoElement | null> {
  if (elementCache.has(clip.src)) return elementCache.get(clip.src)!;

  return new Promise((resolve) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    }, 10000); // 10s timeout per asset

    if (clip.type === 'photo') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          elementCache.set(clip.src, img);
          resolve(img);
        }
      };
      img.onerror = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve(null);
        }
      };
      img.src = clip.src;
    } else if (clip.type === 'video') {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.preload = 'auto';
      video.onloadeddata = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          elementCache.set(clip.src, video);
          resolve(video);
        }
      };
      video.onerror = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve(null);
        }
      };
      video.src = clip.src;
    } else {
      clearTimeout(timeout);
      resolve(null);
    }
  });
}
