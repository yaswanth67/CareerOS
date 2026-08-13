#!/usr/bin/env node
/**
 * One-command first-run setup for CareerOS.
 *
 * Installs everything — app dependencies, the SQLite database, and the
 * career-ops workspace — from a single command. Safe to re-run (idempotent):
 *
 *   1. Create .env from .env.example (if missing) with freshly generated secrets
 *   2. Install all app dependencies (dev deps included, even when the shell
 *      exports NODE_ENV=production, which would otherwise make npm skip them)
 *   3. Generate the Prisma client
 *   4. Push the Prisma schema to the SQLite database
 *   5. Seed sample data (idempotent)
 *   6. Install the career-ops workspace (./career-ops — deps + modes), so the
 *      app's Career Ops features work out of the box
 *
 * Invoked two ways:
 *   - `npm run setup`  — full run: installs app deps first, then steps 1, 3-6
 *   - `npm install`    — npm runs this as `postinstall`; there the app-install
 *                        step is skipped (npm just installed the deps), so the
 *                        script never recurses into itself.
 *
 * The nested-invocation guard: `npm run setup` installs deps by shelling out to
 * `npm install --include=dev`, and that child install re-fires this script as
 * its postinstall. The child inherits SETUP_ORIGIN=setup-full from the outer
 * `npm run setup`, which tells us the outer run is about to do the real work —
 * so the nested postinstall exits early instead of duplicating steps.
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, '.env')
const envExamplePath = join(root, '.env.example')
const careerOpsDir = join(root, 'career-ops')

const event = process.env.npm_lifecycle_event || ''
const invokedFromSetup = process.env.SETUP_ORIGIN === 'setup-full'
const skipAppInstall = event === 'postinstall' && !invokedFromSetup
const isVercel = process.env.VERCEL === '1'

// Nested postinstall fired by the `npm install --include=dev` inside `npm run
// setup`. The outer run will do every step, so this one is a no-op.
if (invokedFromSetup && event === 'postinstall') {
  console.log('  (nested npm install under `npm run setup` — skipping, the outer run handles setup)')
  process.exit(0)
}

const step = (title) => console.log(`\n==> ${title}`)

function run(cmd, { cwd = root } = {}) {
  console.log(`    $ ${cmd}`)
  execSync(cmd, { cwd, stdio: 'inherit' })
}

/** Run a non-fatal step: warn and continue instead of aborting setup. */
function runBestEffort(title, cmd, { cwd = root } = {}) {
  try {
    run(cmd, { cwd })
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.log(`    ⚠ ${title} failed: ${message}`)
    console.log('      Continuing setup — you can retry the step later with `npm run setup`.')
    return false
  }
}

// In postinstall mode the app deps should already be on disk (npm just
// installed them). If they aren't, the shell is exporting NODE_ENV=production,
// which makes npm skip devDependencies (prisma, tsx, ...) — warn and defer to
// the explicit `npm run setup`, which forces them with --include=dev.
if (skipAppInstall && !existsSync(join(root, 'node_modules', 'prisma'))) {
  console.log(`
==> Installing dependencies
    ⚠ prisma CLI is missing — your shell exports NODE_ENV=production, so
      \`npm install\` skipped devDependencies (prisma, tsx, ...).
      Run the full setup to finish everything:
        npm run setup
      (or: env -u NODE_ENV npm install && npm run setup)`)
  process.exit(0)
}

// 1. .env bootstrap (skipped on Vercel — env comes from the platform).
if (!isVercel && !existsSync(envPath)) {
  step('Creating .env from .env.example (generating secrets)')
  const template = readFileSync(envExamplePath, 'utf8')
  const nextAuthSecret = randomBytes(32).toString('base64')
  const cronSecret = randomBytes(24).toString('hex')
  const env = template
    .replace(/NEXTAUTH_SECRET="[^"]*"/, `NEXTAUTH_SECRET="${nextAuthSecret}"`)
    .replace(/CRON_SECRET="[^"]*"/, `CRON_SECRET="${cronSecret}"`)
  writeFileSync(envPath, env)
  console.log('    Created .env — NEXTAUTH_SECRET and CRON_SECRET generated')
} else if (isVercel) {
  step('Creating .env from .env.example')
  console.log('    skipped on Vercel — environment variables come from the platform')
} else {
  step('Creating .env from .env.example')
  console.log('    .env already exists — left untouched')
}

// 2. Install dependencies. --include=dev is explicit so dev deps are installed
// even if the shell exports NODE_ENV=production. (Skipped in postinstall mode —
// npm already ran the install that triggered us.)
if (skipAppInstall) {
  step('Installing dependencies')
  console.log('    skipped — `npm install` already installed them')
} else {
  step('Installing dependencies')
  run('npm install --include=dev')
}

// 3. Generate the Prisma client (also lets `prisma db push` below work).
step('Generating the Prisma client')
run('npx prisma generate')

// 4-6: local-only. On Vercel the filesystem is ephemeral, so a SQLite DB and
// the career-ops workspace don't belong there — the build only needs the client.
if (isVercel) {
  console.log(`
Setup complete (Vercel build) ✅

  Prisma client generated. DB schema, seed, and the career-ops workspace were
  skipped because they're local-only.`)
  process.exit(0)
}

// 4. Create the SQLite schema. Fatal in `npm run setup` (the app needs it),
// best-effort in postinstall mode (an install should never be blocked by the DB).
step('Creating the database schema (prisma db push)')
if (skipAppInstall) {
  runBestEffort('prisma db push', 'npx prisma db push')
} else {
  run('npx prisma db push')
}

// 5. Seed sample data (idempotent).
step('Seeding sample data')
if (skipAppInstall) {
  runBestEffort('db:seed', 'npm run db:seed')
} else {
  run('npm run db:seed')
}

// 6. career-ops workspace — installs its deps + modes so the app's Career Ops
// evaluation works. Best-effort: a failure must never break the rest of setup.
step('Installing the career-ops workspace')
setupCareerOps()

console.log(`
Setup complete 🎉

  Next step:  npm run dev   →   http://localhost:3000

  Seed login (if you kept the sample data):
    email:    buddy@gmail.com
    password: qwerty@1

  career-ops workspace: ./career-ops
    - Installed for the app's Career Ops features (evaluate, cover, interview
      prep, upskill, follow-up, tailor-resume).
    - Running the career-ops CLI itself? cd career-ops and use your AI CLI there.
    - PDF generation needs the Playwright browser: cd career-ops && npx playwright install chromium
`)

function setupCareerOps() {
  try {
    if (existsSync(join(careerOpsDir, 'package.json'))) {
      // Workspace already present (vendored or from a previous setup).
      if (!existsSync(join(careerOpsDir, 'node_modules'))) {
        // --ignore-scripts: installs the packages without downloading the
        // Playwright browser (~130 MB) or touching system deps. The app doesn't
        // need the browser — only the career-ops CLI PDF flow does.
        run('npm install --prefix career-ops --ignore-scripts')
      } else {
        console.log('    career-ops already installed — left untouched')
      }
    } else {
      // Fresh clone: the workspace is gitignored, so bootstrap it with the
      // tool's own installer (clones the latest release into ./career-ops).
      console.log('    career-ops workspace missing — bootstrapping via `npx @santifer/career-ops init`')
      run('npx --yes @santifer/career-ops init')
    }

    // Sanity-check the files the app reads at evaluation time.
    const missing = ['modes/_shared.md', 'modes/oferta.md'].filter(
      (rel) => !existsSync(join(careerOpsDir, rel))
    )
    if (missing.length > 0) {
      console.log(`    ⚠ ./career-ops is missing ${missing.join(', ')} — Career Ops features will report "not installed".`)
    } else {
      console.log('    career-ops ready — modes present, app Career Ops features enabled')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.log(`    ⚠ career-ops setup failed: ${message}`)
    console.log('      The app will still run; Career Ops features just won\'t be available.')
    console.log('      You can retry later with:  npx @santifer/career-ops init')
  }
}
