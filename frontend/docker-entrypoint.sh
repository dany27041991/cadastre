#!/bin/sh
# Installa dipendenze nel volume (se mancanti o package.json cambiato), poi avvia Vite.
# Così node_modules persistono tra i rebuild dell'immagine senza riscaricare ogni volta.
set -e
cd /app
npm install
exec node node_modules/vite/bin/vite.js --host 0.0.0.0 "$@"
