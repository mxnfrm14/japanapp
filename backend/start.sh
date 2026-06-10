#!/bin/bash

APP_MODULE="app.main:app"
HOST="0.0.0.0"
PORT="8000"

source .venv/bin/activate

echo "🚀 Démarrage du serveur FastAPI avec Uvicorn..."
echo "Appuyez sur Ctrl+C pour arrêter le serveur."
echo "---------------------------------------------"

uvicorn $APP_MODULE --host $HOST --port $PORT