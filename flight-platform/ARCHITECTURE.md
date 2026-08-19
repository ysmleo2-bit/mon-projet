# AERIS — Architecture & Product Documentation

## Vision Produit

**AERIS** (de l'latin *aer* : air) est le moteur de recherche de vols qui fait ce que Google Flights ne fera jamais : classer les résultats selon **l'intérêt du voyageur**, pas selon les commissions reçues.

Tagline : *"True Price Engine — Zéro sponsoring. Zéro manipulation."*

---

## Stack Technique (MVP → Production)

### Frontend
| Couche | Choix | Raison |
|--------|-------|--------|
| Framework | **Next.js 14** (App Router) | SSR, Streaming, RSC, perf optimale |
| Language | **TypeScript strict** | Sécurité type end-to-end |
| Styles | **Tailwind CSS v3** | Design system cohérent, perf build |
| Animations | **Framer Motion** | Transitions fluides sans lib lourde |
| Charts | **Recharts** | Léger, composable, responsive |
| State | **Zustand** (prod) / useState (MVP) | Simple, scalable |
| Data fetching | **TanStack Query** | Cache, retry, optimistic updates |

### Backend (Production)
| Couche | Choix | Raison |
|--------|-------|--------|
| API | **Next.js Route Handlers** → **Fastify** (scale) | Démarrage rapide → perf prod |
| Queue | **BullMQ** + Redis | Jobs de scraping asynchrones |
| Cache | **Redis** (Upstash serverless) | Résultats mis en cache 5min |
| Database | **PostgreSQL** (Neon serverless) | Historique prix, alertes, users |
| Search index | **Meilisearch** | Autocomplétion aéroports ultra-rapide |
| Auth | **Clerk** ou **Auth.js** | Auth sans friction |

### Infrastructure
```
User → Vercel Edge → Next.js → Redis Cache
                              → Fastify API → Amadeus GDS
                                            → Skyscanner API
                                            → Kiwi Tequila API
                                            → Duffel API
                                            → Booking.com API
                                            → Agoda API
```

---

## APIs Recommandées

### Vols (par priorité)
1. **Amadeus Self-Service** — accès direct aux GDS, parfait MVP gratuit jusqu'à 2k req/mois
2. **Duffel API** — moderne, bien documentée, NDC airlines direct
3. **Kiwi Tequila** — excellent pour combinations créatives et "virtual interlining"
4. **Skyscanner API** — large couverture OTA
5. **Travelpayouts** — agrégateur avec 80+ partenaires

### Hôtels
1. **Booking.com Affiliate API** — le plus large inventaire
2. **Agoda Partner Hub** — excellent Asie
3. **Hotelbeds** — contenu B2B
4. **Expedia Partner Solutions**

### Données enrichies
- **Aviation Edge** — données compagnies, flotte, historique retards
- **OAG** — ponctualité et qualité vols
- **FlightAware** — tracking temps réel
- **Exchangerates API** — conversion devises

---

## Algorithme AERIS Score™

```typescript
score = Σ (critère_i × poids_i) / Σ poids_i

Critères (poids défaut) :
  prix          : 30% — normalisé entre min/max de la recherche
  durée         : 20% — inversement proportionnel
  compagnie     : 15% — rating composite (OAG + Skytrax + avis)
  horaires      : 10% — score heure de départ vs préférences user
  confort       : 10% — légroom + classe
  bagages       : 5%  — bagage inclus = bonus
  ponctualité   : 5%  — taux OTP 12 derniers mois
  avis          : 5%  — note Tripadvisor / Skytrax

Personnalisation :
  Chaque utilisateur peut modifier les 8 poids via son profil.
  Le score est recalculé côté client en temps réel.
```

---

## Détection Erreurs Tarifaires

```
Algorithme ET (Error Tariff Detection) :
1. Prix < 60% du prix moyen 30j → flag "potential error"
2. Prix < 40% → flag "error tarifaire"
3. Notification push instantanée aux utilisateurs avec alerte sur cette route
4. Lifetime: 4h maximum avant expiration automatique
```

---

## Base de Données (PostgreSQL)

```sql
-- Core tables
users (id, email, prefs_json, created_at)
price_alerts (id, user_id, from, to, target_price, channel, active)
price_history (route_hash, date, price, source, cabin_class)
flight_cache (search_hash, results_json, sources_scanned, expires_at)
hotel_cache (search_hash, results_json, expires_at)

-- Indexes
idx_price_history_route_date
idx_price_alerts_active_user
idx_flight_cache_expires
```

---

## Modèle de Monétisation Éthique

| Tier | Prix | Features |
|------|------|----------|
| **Free** | 0€/mois | 5 recherches/jour, 2 alertes, score basique |
| **Explorer** | 4.99€/mois | Recherches illimitées, 20 alertes, historique 90j |
| **Nomad** | 9.99€/mois | Tout + alertes Telegram, IA prédictive, export data |
| **Pro** | 19.99€/mois | API access, white-label, usage commercial |

**Principe cardinal** :
- Aucune commission d'affiliation ne peut influencer le classement
- Liens "réserver" = liens directs vers la source originale
- Revenue = uniquement abonnements + API licensing

---

## MVP 30 Jours — Roadmap

### Semaine 1 : Core Engine
- [x] Design system Tailwind + composants
- [x] Homepage + SearchBar
- [x] Moteur de scoring AERIS Score™
- [x] Page résultats avec FlightCard
- [x] Filtres temps réel

### Semaine 2 : Features
- [x] Calendrier des prix
- [x] Historique prix (graphique)
- [x] IA prédictive (modèle simple)
- [x] Module hôtels
- [x] Système d'alertes prix
- [x] Page profil + préférences

### Semaine 3 : API Integration
- [ ] Connexion Amadeus API (sandbox → production)
- [ ] Cache Redis (Upstash)
- [ ] Auth utilisateur (Clerk)
- [ ] Alertes email (Resend)
- [ ] Alertes Telegram (Bot API)

### Semaine 4 : Polish + Launch
- [ ] Tests E2E (Playwright)
- [ ] PWA (manifest + service worker)
- [ ] SEO (sitemap, meta, structured data)
- [ ] Analytics (privacy-first : Plausible)
- [ ] Déploiement Vercel + domaine

---

## Supériorité vs Google Flights

| Critère | Google Flights | AERIS |
|---------|----------------|-------|
| Transparence | ❌ Résultats sponsorisés | ✅ Zéro sponsoring |
| Personnalisation | Basique | ✅ 8 critères pondérés |
| Score intelligent | ❌ Prix seul | ✅ AERIS Score™ 100pts |
| IA prédictive | ✅ Basique | ✅ Avancée + confiance % |
| Alertes | ✅ Email | ✅ Email + Telegram |
| Hôtels | ❌ Délégué à Booking | ✅ Intégré + comparaison |
| Erreurs tarifaires | ❌ | ✅ Détection automatique |
| Données vendues | ❓ | ✅ Jamais |
| Business model | Publicité + commissions | ✅ Abonnement only |
