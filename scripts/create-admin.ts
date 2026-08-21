/**
 * Create (or report) an administrator in MongoDB.
 *
 * Usage:
 *   npm run create-admin -- --email you@org.org --password 'a-strong-password' --name 'Site Administrator'
 *
 * Falls back to BOOTSTRAP_ADMIN_* env vars when flags are omitted.
 * Do not insert users from the Atlas UI — this script bcrypt-hashes the password.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectMongo } from '../server/config/mongo';
import { createAdmin } from '../server/services/adminService';

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const email = arg('--email') || (process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim();
  const password = arg('--password') || process.env.BOOTSTRAP_ADMIN_PASSWORD || '';
  const name = arg('--name') || (process.env.BOOTSTRAP_ADMIN_NAME || '').trim() || 'Site Administrator';
  const role = (arg('--role') || 'admin') as 'admin' | 'editor';

  if (!email || !password) {
    console.error(
      'Usage: npm run create-admin -- --email you@org.org --password "strong-pass" [--name "Name"] [--role admin|editor]'
    );
    process.exit(1);
  }

  const ok = await connectMongo();
  if (!ok) {
    console.error('Could not connect to MongoDB. Set MONGODB_URI and check Atlas Network Access.');
    process.exit(1);
  }

  try {
    const admin = await createAdmin({ name, email, password, role, isActive: true });
    console.log(`Created ${admin.role} account: ${admin.email} (id ${admin.id})`);
  } catch (err) {
    console.error((err as Error).message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
