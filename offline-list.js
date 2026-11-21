// Liste des fichiers gardés sur l'appareil pour fonctionner sans Internet.
(function (g) {
  g.TASMI_APP = [
    './', './index.html', './asr-worker.js', './mic-worklet.js', './offline-list.js', './manifest.webmanifest',
    './data/quran.json', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'
  ];
  var M = './models/whisper-tiny-ar-quran/';
  g.TASMI_BIG = [
    './fonts/amiri-400.woff2', './fonts/amiri-700.woff2',
    './vendor/transformers.min.js', './vendor/ort-wasm-simd-threaded.jsep.mjs', './vendor/ort-wasm-simd-threaded.jsep.wasm',
    M + 'config.json', M + 'generation_config.json', M + 'preprocessor_config.json', M + 'tokenizer.json',
    M + 'tokenizer_config.json', M + 'special_tokens_map.json', M + 'added_tokens.json', M + 'normalizer.json',
    M + 'vocab.json', M + 'merges.txt',
    M + 'onnx/encoder_model.onnx', M + 'onnx/decoder_model_merged_quantized.onnx'
  ];
})(typeof self !== 'undefined' ? self : window);
