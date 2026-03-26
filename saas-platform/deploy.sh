#!/bin/bash
set -e

echo "=== SetterLink Deploy ==="
echo ""

# Check vercel CLI
if ! command -v vercel &> /dev/null; then
  echo "Installation de Vercel CLI..."
  npm install -g vercel
fi

# Login
echo "Connexion a Vercel..."
npx vercel login

# Deploy
echo ""
echo "Deploiement..."
echo "Repondre aux questions:"
echo "  - Set up and deploy? -> Y"
echo "  - Which scope? -> votre compte"
echo "  - Link to existing project? -> N"
echo "  - Project name? -> setterlink (ou autre)"
echo "  - In which directory? -> . (point)"
echo ""
npx vercel

# Env vars
echo ""
echo "=== Variables d'environnement ==="
echo ""
read -p "DATABASE_URL (postgresql://...): " DB_URL
read -p "JWT_SECRET (chaine aleatoire): " JWT

npx vercel env add DATABASE_URL production <<< "$DB_URL"
npx vercel env add JWT_SECRET production <<< "$JWT"

# Final deploy
echo ""
echo "=== Deploy final en production ==="
npx vercel --prod

echo ""
echo "=== Initialisation de la base ==="
DATABASE_URL="$DB_URL" npx prisma migrate deploy
DATABASE_URL="$DB_URL" npm run seed

echo ""
echo "DONE ! Votre SaaS est en ligne."
