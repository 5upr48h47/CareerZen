// Remove the seeded demo accounts AND their demo jobs, posts, projects, and
// collaborations from the database.
//
// The demo users all share the password "password123" and include a recruiter
// who can post jobs — unsafe on a public deployment. Deleting the three demo
// users cascades to every child row (jobs, posts, comments, likes, collabs,
// profiles with their projects, messages, notifications...). Three relations
// (UserSubscription, Payment, FeaturedJob) have no onDelete: Cascade, so they
// are cleaned up explicitly first to avoid FK constraint failures.
//
//   node scripts/remove-demo-data.mjs            # dry-run: list what would go
//   node scripts/remove-demo-data.mjs --yes      # actually delete

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_EMAILS = [
  'alex@example.com',
  'priya@example.com',
  'sarah@techcorp.io',
];

const confirmed = process.argv.includes('--yes');

(async () => {
  try {
    const users = await prisma.user.findMany({
      where: { email: { in: DEMO_EMAILS } },
      select: { id: true, username: true, email: true, role: true },
    });

    if (users.length === 0) {
      console.log('No demo accounts found — nothing to do.');
      return;
    }

    const demoIds = users.map((u) => u.id);

    // Count everything that will be removed, for the dry-run report.
    const [jobs, posts, collabs, profiles, subscriptions, payments, featured] =
      await Promise.all([
        prisma.job.count({ where: { recruiterId: { in: demoIds } } }),
        prisma.post.count({ where: { authorId: { in: demoIds } } }),
        prisma.collaboration.count({ where: { creatorId: { in: demoIds } } }),
        prisma.profile.count({ where: { userId: { in: demoIds } } }),
        prisma.userSubscription.count({ where: { userId: { in: demoIds } } }),
        prisma.payment.count({ where: { userId: { in: demoIds } } }),
        prisma.featuredJob.count({ where: { userId: { in: demoIds } } }),
      ]);

    if (!confirmed) {
      console.log('Demo accounts that would be deleted:\n');
      users.forEach((u) =>
        console.log(`  id=${u.id}  ${u.username}  ${u.email}  (${u.role})`)
      );
      console.log('\nCascade impact (deleted with the accounts):');
      console.log(`  Demo jobs posted:              ${jobs}`);
      console.log(`  Demo feed posts:               ${posts}`);
      console.log(`  Demo collaborations:           ${collabs}`);
      console.log(`  Demo profiles (w/ projects):   ${profiles}`);
      if (subscriptions || payments || featured) {
        console.log('\nRelations without ON DELETE CASCADE (cleaned explicitly):');
        if (subscriptions) console.log(`  User subscriptions:            ${subscriptions}`);
        if (payments) console.log(`  Payments:                      ${payments}`);
        if (featured) console.log(`  Featured jobs:                 ${featured}`);
      }
      console.log('\nRe-run with --yes to delete them:');
      console.log('  node scripts/remove-demo-data.mjs --yes');
      return;
    }

    // Relations without onDelete: Cascade — delete first so the user delete
    // doesn't trip a foreign-key constraint.
    await prisma.userSubscription.deleteMany({ where: { userId: { in: demoIds } } });
    await prisma.payment.deleteMany({ where: { userId: { in: demoIds } } });
    await prisma.featuredJob.deleteMany({ where: { userId: { in: demoIds } } });

    // Everything else cascades via the schema's onDelete: Cascade.
    const { count } = await prisma.user.deleteMany({
      where: { email: { in: DEMO_EMAILS } },
    });

    console.log(`Deleted ${count} demo account(s) and all their cascade data.`);
    console.log(`  - ${jobs} demo jobs`);
    console.log(`  - ${posts} demo feed posts`);
    console.log(`  - ${collabs} demo collaborations`);
    console.log(`  - ${profiles} demo profiles (projects included)`);
    console.log('\nNext: promote your real account with:');
    console.log('  node scripts/promote-admin.mjs you@example.com');
  } catch (err) {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();