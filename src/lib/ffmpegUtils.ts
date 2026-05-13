import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

export async function getFFmpeg() {
  if (ffmpeg) return ffmpeg;

  // Check for SharedArrayBuffer (Required for multi-threaded FFmpeg 0.12+)
  // If not supported, we might need a single-threaded fallback or skip.
  const isIsolated = window.crossOriginIsolated || (typeof SharedArrayBuffer !== 'undefined');
  console.log('Environment is isolated:', isIsolated);

  ffmpeg = new FFmpeg();
  
  // Timeout protection for the load process
  const loadPromise = (async () => {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpeg!.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    return ffmpeg;
  })();

  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('FFmpeg load timeout')), 20000)
  );

  return Promise.race([loadPromise, timeoutPromise]) as Promise<FFmpeg>;
}
