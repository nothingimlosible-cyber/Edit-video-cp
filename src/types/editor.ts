export type ClipType = 'video' | 'photo' | 'audio' | 'text';

export interface Keyframe {
  time: number;
  scale?: number;
  x?: number;
  y?: number;
  opacity?: number;
  rotation?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  hue?: number;
  blur?: number;
  sharpen?: number;
  vignette?: number;
}

export interface Clip {
  id: string;
  type: ClipType;
  src: string;
  thumbnail?: string;
  start: number; // Start time in the overall project timeline
  duration: number; // Length of the clip
  trimStart: number; // Offset from the beginning of the file
  speed: number;
  layer: number;
  scale: number;
  x: number;
  y: number;
  opacity: number;
  rotation?: number;
  keyframes: Keyframe[];
  volume?: number;
  text?: string;
  chromaKey?: boolean;
  maskType?: 'none' | 'linear' | 'circle' | 'rectangle';
  textStyle?: 'bold-white' | 'white-shadow' | 'black-shadow' | 'glow';
  filter?: 'none' | 'grayscale' | 'sepia' | 'vintage' | 'cold' | 'mirror' | 'shake' | 'glitch' | 'zoom-blur';
  brightness?: number;
  contrast?: number;
  saturation?: number;
  hue?: number;
  blur?: number;
  vignette?: number;
  sharpen?: number;
  blendMode?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity';
  horizontalFlip?: boolean;
  verticalFlip?: boolean;
  animationIn?: 'none' | 'fade' | 'slide-left' | 'slide-up' | 'zoom' | 'black-flash' | 'white-flash' | 'sun-flare' | 'swing' | 'bounce' | 'blur-fade' | 'rotate-zoom';
  animationOut?: 'none' | 'fade' | 'slide-right' | 'slide-down' | 'zoom' | 'black-flash' | 'white-flash' | 'sun-flare' | 'blur-fade' | 'rotate-zoom';
  animationInDuration?: number;
  animationOutDuration?: number;
  transitionType?: 'none' | 'fade' | 'black' | 'white' | 'slide-left' | 'slide-right' | 'zoom' | 'blur';
  transitionDuration?: number;
  fadeInDuration?: number;
  fadeOutDuration?: number;
  backgroundMode?: 'black' | 'blur' | 'color';
}

export type AspectRatio = '9:16' | '16:9' | '1:1' | '4:5' | '2.35:1' | '2:1' | '3:4' | 'original';

export interface Project {
  id: string;
  name: string;
  duration: number;
  fps: number;
  resolution: string;
  aspectRatio: AspectRatio;
  clips: Clip[];
  createdAt: number;
  thumbnail: string;
}
