// Moteur vocal hors ligne : Whisper (modèle Coran de Tarteel) exécuté dans le navigateur.
import { pipeline, env } from './vendor/transformers.min.js';

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.useBrowserCache = false;
env.localModelPath = new URL('./models/', self.location.href).href;
env.backends.onnx.wasm.wasmPaths = new URL('./vendor/', self.location.href).href;

let asr = null;
const OPTS = { language: 'ar', task: 'transcribe' };

self.onmessage = async e => {
  const m = e.data;
  try {
    if (m.type === 'load') {
      asr = await pipeline('automatic-speech-recognition', 'whisper-tiny-ar-quran', {
        dtype: { encoder_model: 'fp32', decoder_model_merged: 'q8' }, device: 'wasm',
        progress_callback: p => {
          if (p.status === 'progress' && /\.onnx$/.test(p.file || '')) self.postMessage({ type: 'progress', file: p.file, loaded: p.loaded, total: p.total });
        }
      });
      await asr(new Float32Array(16000), { ...OPTS, max_new_tokens: 2 });   // mise en chauffe
      self.postMessage({ type: 'ready', threads: env.backends.onnx.wasm.numThreads || 1 });
    } else if (m.type === 'run') {
      const t0 = performance.now();
      const out = await asr(m.audio, { ...OPTS, max_new_tokens: m.maxTokens || 160 });
      self.postMessage({ type: 'result', id: m.id, text: (out && out.text) || '', ms: performance.now() - t0 });
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: m.id, message: String((err && err.message) || err) });
  }
};
