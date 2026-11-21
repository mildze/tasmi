@echo off
rem Double-cliquez pour lancer Tasmi. Laissez cette fenetre ouverte pendant la recitation.
cd /d "%~dp0"
start "" "http://localhost:5178"
node serveur.js
