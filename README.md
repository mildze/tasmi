# Tasmīʿ — récitation du Coran de mémoire

Application web personnelle : on récite, le texte reste caché, et chaque mot n'apparaît qu'une fois récité juste.
Une erreur déclenche un bip et colore la case, sans montrer le mot. Tout fonctionne hors ligne une fois l'app chargée.

- **Sur iPhone** : ouvrir la page dans Safari, bouton Partager, puis « Sur l'écran d'accueil ».
- **Sur PC** : double-cliquer sur `Lancer.bat` (Node.js requis), puis ouvrir Chrome ou Edge.

## Crédits

- Texte du Coran (lecture Ḥafṣ, orthographe simple) : [Tanzil.net](https://tanzil.net), récupéré via [alquran.cloud](https://alquran.cloud). La basmala d'ouverture des sourates est séparée du premier verset pour l'affichage ; le texte des versets n'est pas modifié.
- Reconnaissance vocale : [tarteel-ai/whisper-tiny-ar-quran](https://huggingface.co/tarteel-ai/whisper-tiny-ar-quran) (Apache-2.0), conversion ONNX [Sharjeelbaig/whisper-tiny-ar-quran-onnx](https://huggingface.co/Sharjeelbaig/whisper-tiny-ar-quran-onnx).
- Moteur : [Transformers.js](https://github.com/huggingface/transformers.js) et ONNX Runtime Web (Apache-2.0 / MIT).
- Police : [Amiri](https://github.com/aliftype/amiri) (SIL Open Font License).
