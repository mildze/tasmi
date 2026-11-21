// Liste des fichiers gardés sur l'appareil pour fonctionner sans Internet.
// Le modèle vocal et la référence du Coran n'y sont pas : le moteur Tilawa les garde lui-même après le premier chargement.
(function (g) {
  g.TASMI_APP = [
    './', './index.html', './app.js', './offline-list.js', './manifest.webmanifest',
    './data/quran.json', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'
  ];
  g.TASMI_BIG = [
    './fonts/amiri-400.woff2', './fonts/amiri-700.woff2', './vendor/tilawa.js',
    './tilawa/v1/runtime/ort/1.30.0/ort-wasm-simd-threaded.jsep.mjs',
    './tilawa/v1/runtime/ort/1.30.0/ort-wasm-simd-threaded.jsep.wasm'
  ];
})(typeof self !== 'undefined' ? self : window);
