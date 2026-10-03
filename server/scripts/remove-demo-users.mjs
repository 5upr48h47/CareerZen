// Remove the seeded demo accounts from the database.
//
// The demo users all share the password "password123" and include a recruiter
// who can post jobs — unsafe on a public deployment. Run this once before
// going live, then promote your real account to admin.
//
//   node scripts/remove-demo-users.mjs --yes
//
// Without --yes it only lists what it would delete.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_EMAILS = [
  'alex@example.com',
  'priya@example.com',
  'sarah@techcorp.io',
];

const confirmed = process.argv.includes('--yes');

try {
  const users = await prisma.user.findMany({
    where: { email: { in: DEMO_EMAILS } },
    select: { id: true, username: true, email: true, role: true },
  });

  if (users.length === 0) {
    console.log('No demo accounts found — nothing to do.');
  } else if (!confirmed) {
    console.log('Demo accounts that would be deleted:\n');
    users.forEach((u) => console.log(`  id=${u.id}  ${u.username}  ${u.email}  (${u.role})`));
    console.log('\nRe-run with --yes to delete them:');
    console.log('  node scripts/remove-demo-users.mjs --yes');
  } else {
    // Child rows cascade via the schema's onDelete: Cascade.
    const { count } = await prisma.user.deleteMany({
      where: { email: { in: DEMO_EMAILS } },
    });
    console.log(`Deleted ${count} demo account(s).`);
    console.log('Next: promote your real account with:');
    console.log('  node scripts/promote-admin.mjs you@example.com');
  }
} catch (err) {
  console.error('Failed:', err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}