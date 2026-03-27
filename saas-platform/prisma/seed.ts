import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import bcrypt from 'bcryptjs'
import path from 'path'
import { fileURLToPath } from 'url'

// Use __filename so the path is relative to this file, not process.cwd()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// This file is at: <project>/prisma/seed.ts  → DB is at: <project>/prisma/dev.db
const absDbPath = path.resolve(__dirname, 'dev.db')
const envUrl = process.env.DATABASE_URL
const url = (!envUrl || envUrl.startsWith('file:'))
  ? `file://${absDbPath}`
  : envUrl

const adapter = new PrismaLibSql({ url })
const prisma = new PrismaClient({ adapter })

const setters = [
  {
    email: 'alice@example.com',
    name: 'Alice Martin',
    title: 'Experte en cold calling B2B',
    bio: "5 ans d'expérience en prise de RDV pour des entreprises SaaS. Spécialisée dans le secteur tech et finance. Taux de conversion moyen de 35%.",
    skills: ['Cold calling', 'LinkedIn outreach', 'CRM', 'Prospection B2B', 'Salesforce'],
    hourlyRate: 35,
    location: 'Paris, France',
  },
  {
    email: 'thomas@example.com',
    name: 'Thomas Bernard',
    title: 'Setter LinkedIn & email marketing',
    bio: "Je génère 15-20 RDV qualifiés par semaine grâce à des séquences LinkedIn et email personnalisées. Expérience dans le B2B SaaS, consulting et formation.",
    skills: ['LinkedIn outreach', 'Email marketing', 'Copywriting', 'Automation', 'HubSpot'],
    hourlyRate: 40,
    location: 'Lyon, France',
  },
  {
    email: 'sarah@example.com',
    name: 'Sarah Dubois',
    title: 'SDR Senior - Marché SME',
    bio: "Ancienne SDR chez 2 scale-ups, je maîtrise la prospection multicanal. J'aide les startups à structurer leur processus de qualification et à remplir leur pipeline.",
    skills: ['Lead generation', 'Qualification', 'Sales funnel', 'Outbound', 'Pipedrive'],
    hourlyRate: 45,
    location: 'Bordeaux, France',
  },
]

const entrepreneurs = [
  {
    email: 'marc@example.com',
    name: 'Marc Leroy',
    title: 'CEO & Fondateur - SaaS RH',
    bio: "Je dirige une startup SaaS dans les RH avec 50 clients. Je cherche un setter pour scaler notre acquisition B2B et atteindre 200 clients d'ici fin d'année.",
    skills: ['SaaS', 'B2B', 'RH', 'Scaling', 'Fundraising'],
    location: 'Paris, France',
  },
  {
    email: 'julie@example.com',
    name: 'Julie Fontaine',
    title: 'Consultante en transformation digitale',
    bio: "Consultante indépendante depuis 3 ans, j'accompagne des PME dans leur transformation digitale. Je recherche un setter expérimenté pour développer mon portefeuille client.",
    skills: ['Transformation digitale', 'Coaching', 'PME', 'Formation', 'Stratégie'],
    location: 'Nantes, France',
  },
]

async function main() {
  console.log('Seeding database...')
  const password = await bcrypt.hash('password123', 10)

  for (const s of setters) {
    await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        email: s.email,
        password,
        role: 'setter',
        profile: {
          create: {
            name: s.name,
            title: s.title,
            bio: s.bio,
            skills: JSON.stringify(s.skills),
            hourlyRate: s.hourlyRate,
            location: s.location,
            available: true,
          },
        },
      },
    })
  }

  for (const e of entrepreneurs) {
    await prisma.user.upsert({
      where: { email: e.email },
      update: {},
      create: {
        email: e.email,
        password,
        role: 'entrepreneur',
        profile: {
          create: {
            name: e.name,
            title: e.title,
            bio: e.bio,
            skills: JSON.stringify(e.skills),
            hourlyRate: null,
            location: e.location,
            available: true,
          },
        },
      },
    })
  }

  console.log('Done! password: password123')
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); process.exit(1) })
