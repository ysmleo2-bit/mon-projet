# SetterLink

## Deploiement rapide (sans integration GitHub)

### 1. Cloner et installer
```bash
git clone https://github.com/ysmleo2-bit/mon-projet.git
cd mon-projet/saas-platform
npm install
```

### 2. Base de donnees gratuite
Aller sur neon.tech -> Create project -> copier la Connection string

### 3. Deployer via Vercel CLI
```bash
npx vercel login
npx vercel
npx vercel env add DATABASE_URL   # coller l'URL Neon
npx vercel env add JWT_SECRET     # ex: setterlink-secret-xyz-2026
npx vercel --prod
```

### 4. Initialiser la base (une seule fois)
```bash
DATABASE_URL="postgresql://..." npx prisma migrate deploy
DATABASE_URL="postgresql://..." npm run seed
```

---

## Dev local
```bash
npm install && npm run dev    # SQLite auto, aucune config
npm run seed                  # 5 comptes demo (password: password123)
```

Comptes demo: alice@example.com, thomas@example.com, sarah@example.com (Setters)
               marc@example.com, julie@example.com (Entrepreneurs)
