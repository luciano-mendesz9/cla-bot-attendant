#!/data/data/com.termux/files/usr/bin/bash

echo "🚀 Iniciando aplicação com auto-restart..."

while true
do
  echo "▶️ Rodando: npm run start"
  
  npm run start

  exit_code=$?

  echo "⚠️ O processo parou com código: $exit_code"
  echo "🔁 Reiniciando em 2 segundos..."

  sleep 2
done