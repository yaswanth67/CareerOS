#!/usr/bin/env node
/**
 * One-command first-run setup for JobMatch AI.
 *
 * Collapses the old 4-command install into a single `npm run setup`:
 *   1. Create .env from .env.example (if missing) with freshly generated secrets
 *   2. Install all dependencies (dev deps included, even when the shell
 *      exports NODE_ENV=production, which would otherwise make npm skip them)
 *   3. Push the Prisma schema to the SQLite database
 *   4. Seed sample data (idempotent)
 *
 * Safe to re-run — every step is a no-op when already done.
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, '.env')
const envExamplePath = join(root, '.env.example')

const step = (title) => console.log(`\n==> ${title}`)

function run(cmd) {
  console.log(`    $ ${cmd}`)
  execSync(cmd, { cwd: root, stdio: 'inherit' })
}

// 1. .env bootstrap
if (!existsSync(envPath)) {
  step('Creating .env from .env.example (generating secrets)')
  const template = readFileSync(envExamplePath, 'utf8')
  const nextAuthSecret = randomBytes(32).toString('base64')
  const cronSecret = randomBytes(24).toString('hex')
  const env = template
    .replace(/NEXTAUTH_SECRET="[^"]*"/, `NEXTAUTH_SECRET="${nextAuthSecret}"`)
    .replace(/CRON_SECRET="[^"]*"/, `CRON_SECRET="${cronSecret}"`)
  writeFileSync(envPath, env)
  console.log('    Created .env — NEXTAUTH_SECRET and CRON_SECRET generated')
} else {
  console.log('    .env already exists — left untouched')
}

// 2. Install dependencies. --include=dev is explicit so dev deps are installed
// even if the shell exports NODE_ENV=production. postinstall runs `prisma generate`.
step('Installing dependencies')
run('npm install --include=dev')

// 3. Create the SQLite schema
step('Creating the database schema (prisma db push)')
run('npx prisma db push')

// 4. Seed sample data
step('Seeding sample data')
run('npm run db:seed')

console.log(`
Setup complete 🎉

  Next step:  npm run dev   →   http://localhost:3000

  Seed login (if you kept the sample data):
    email:    buddy@gmail.com
    password: qwerty@1
`)
