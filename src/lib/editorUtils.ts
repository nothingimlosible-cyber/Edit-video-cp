import { Clip, Keyframe } from '../types/editor';

export function getInterpolatedValue(keyframes: Keyframe[], currentTimeInClip: number, property: keyof Omit<Keyframe, 'time'>, defaultValue: number): number {
  if (keyframes.length === 0) return defaultValue;

  // Filter keyframes that have the property defined
  const validKeyframes = keyframes.filter(kf => kf[property] !== undefined).sort((a, b) => a.time - b.time);
  
  if (validKeyframes.length === 0) return defaultValue;
  if (currentTimeInClip <= validKeyframes[0].time) return validKeyframes[0][property] as number;
  if (currentTimeInClip >= validKeyframes[validKeyframes.length - 1].time) return validKeyframes[validKeyframes.length - 1][property] as number;

  // Find the two keyframes to interpolate between
  for (let i = 0; i < validKeyframes.length - 1; i++) {
    const start = validKeyframes[i];
    const end = validKeyframes[i + 1];

    if (currentTimeInClip >= start.time && currentTimeInClip <= end.time) {
      const t = (currentTimeInClip - start.time) / (end.time - start.time);
      const startVal = start[property] as number;
      const endVal = end[property] as number;
      return startVal + (endVal - startVal) * t;
    }
  }

  return defaultValue;
}

export function getClipPropertiesAtTime(clip: Clip, currentTime: number) {
  const relativeTime = currentTime - clip.start;
  
  const base = {
    scale: getInterpolatedValue(clip.keyframes, relativeTime, 'scale', clip.scale),
    x: getInterpolatedValue(clip.keyframes, relativeTime, 'x', clip.x),
    y: getInterpolatedValue(clip.keyframes, relativeTime, 'y', clip.y),
    opacity: getInterpolatedValue(clip.keyframes, relativeTime, 'opacity', clip.opacity),
    rotation: getInterpolatedValue(clip.keyframes, relativeTime, 'rotation', clip.rotation || 0),
    brightness: getInterpolatedValue(clip.keyframes, relativeTime, 'brightness', clip.brightness ?? 100),
    contrast: getInterpolatedValue(clip.keyframes, relativeTime, 'contrast', clip.contrast ?? 100),
    saturation: getInterpolatedValue(clip.keyframes, relativeTime, 'saturation', clip.saturation ?? 100),
    hue: getInterpolatedValue(clip.keyframes, relativeTime, 'hue', clip.hue ?? 0),
    blur: getInterpolatedValue(clip.keyframes, relativeTime, 'blur', clip.blur ?? 0),
    sharpen: getInterpolatedValue(clip.keyframes, relativeTime, 'sharpen', clip.sharpen ?? 0),
    vignette: getInterpolatedValue(clip.keyframes, relativeTime, 'vignette', clip.vignette ?? 0),
  };

  return base;
}
