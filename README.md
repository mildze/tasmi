# Tasmīʿ — récitation du Coran de mémoire

Application web personnelle : on récite, le texte reste caché, et chaque mot n'apparaît qu'une fois récité juste.
Une erreur déclenche un bip et colore la case, sans montrer le mot. Tout fonctionne hors ligne une fois l'app chargée ;
le son du micro ne quitte jamais l'appareil.

- **Sur iPhone** : ouvrir la page dans Safari, bouton Partager, puis « Sur l'écran d'accueil ».
- **Sur PC** : double-cliquer sur `Lancer.bat` (Node.js requis), puis ouvrir Chrome ou Edge.

## Organisation

- `index.html`, `app.js` : l'application. `app.js` décide de ce qui s'affiche à partir des événements du moteur.
- `vendor/tilawa.js`, `tilawa/v1/` : le moteur de suivi et ses fichiers (modèles, référence, runtime WASM).
- `data/quran.json` : le texte affiché. `sw.js`, `offline-list.js` : fonctionnement hors ligne.
- `engine/` : sert à reconstruire les trois éléments ci-dessus (`npm install` puis `npm run build`).

## Crédits

- Suivi de la récitation : [Tilawa](https://github.com/yazinsai/tilawa) (`@tilawa/core`, licence MIT), version préliminaire 1.0.0-rc.
  Son modèle d'écoute est entraîné sur tlog (Tarteel, CC-BY) et Quranic Universal Ayahs (QUD Technologies, CC-BY),
  distillé de `obadx/muaalem-model-v3_2` (MIT). Détail : [NOTICE de Tilawa](https://github.com/yazinsai/tilawa/blob/main/NOTICE.md).
- Exécution du modèle : [ONNX Runtime Web](https://github.com/microsoft/onnxruntime) (MIT).
- Texte du Coran (lecture Ḥafṣ, graphie othmanienne) : dérivé de [Tanzil.net](https://tanzil.net), tel que fourni par Tilawa.
  La basmala d'ouverture des sourates est séparée du premier verset pour l'affichage ; le texte des versets n'est pas modifié.
- Police : [Amiri](https://github.com/aliftype/amiri) (SIL Open Font License).
