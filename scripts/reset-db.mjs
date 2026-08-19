// Wipes the local SQLite database and reseeds the demo data.
// Development convenience only - never point this at production.
import { readFileSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';

// Read DATABASE_URL straight out of .env so this needs no extra dependency.
function envValue(key) {
  if (process.env[key]) return process.env[key];
  try {
    const match = readFileSync('.env', 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'));
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : '';
  } catch {
    return '';
  }
}

const url = envValue('DATABASE_URL');
if (!url.startsWith('file:')) {
  console.error('db:reset only works against a local SQLite file (DATABASE_URL=file:...).');
  process.exit(1);
}

const file = url.replace('file:', '').replace(/^[.][/]/, '');
for (const suffix of ['', '-journal', '-wal', '-shm']) {
  try {
    rmSync(`prisma/${file}${suffix}`);
  } catch (err) {
    if (err.code === 'ENOENT') continue; // nothing to delete
    // On Windows a running dev server keeps the file open. Failing loudly here
    // matters: otherwise the seed just skips and the reset looks like it worked.
    console.error(`Could not delete prisma/${file}${suffix}: ${err.message}`);
    console.error('Stop the dev server (and Prisma Studio) first, then run this again.');
    process.exit(1);
  }
}

console.log('Database removed. Recreating...');
execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
execSync('node prisma/seed.mjs', { stdio: 'inherit' });
