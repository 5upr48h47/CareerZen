// Wipe every non-admin user and all their data, keeping only the real admin
// accounts. Run this right before going live so the public database contains
// nothing but genuine, self-registered users.
//
// Deleting a user cascades to every child row (jobs, posts, comments, likes,
// collaborations + members, connections, messages, conversations, applications,
// saved jobs, notifications...). Three relations have no onDelete: Cascade
// (UserSubscription, Payment, FeaturedJob), so those are cleaned explicitly
// first to avoid foreign-key constraint failures.
//
//   node scripts/wipe-nonadmin.mjs            # dry-run: report what would go
//   node scripts/wipe-nonadmin.mjs --yes      # actually delete

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const confirmed = process.argv.includes('--yes');

(async () => {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'admin' },
      select: { id: true, username: true, email: true },
    });

    if (admins.length === 0) {
      console.error('No admin accounts found — refusing to wipe. Promote a real account first:');
      console.error('  node scripts/promote-admin.mjs you@example.com');
      process.exitCode = 1;
      return;
    }

    const adminIds = admins.map((a) => a.id);
    const nonAdminWhere = { role: { not: 'admin' } };

    const [users, jobs, posts, collabs, profiles, applications, connections,
      messages, conversations, notifications, subscriptions, payments, featured] =
      await Promise.all([
        prisma.user.count({ where: nonAdminWhere }),
        prisma.job.count({ where: { recruiter: { role: { not: 'admin' } } } }),
        prisma.post.count({ where: { author: { role: { not: 'admin' } } } }),
        prisma.collaboration.count({ where: { creator: { role: { not: 'admin' } } } }),
        prisma.profile.count({ where: { user: { role: { not: 'admin' } } } }),
        prisma.jobApplication.count({ where: { candidate: { role: { not: 'admin' } } } }),
        prisma.connection.count({ where: { OR: [{ sender: { role: { not: 'admin' } } }, { receiver: { role: { not: 'admin' } } }] } }),
        prisma.message.count({ where: { OR: [{ sender: { role: { not: 'admin' } } }, { receiver: { role: { not: 'admin' } } }] } }),
        prisma.conversation.count({ where: { OR: [{ user1: { role: { not: 'admin' } } }, { user2: { role: { not: 'admin' } } }] } }),
        prisma.notification.count({ where: { user: { role: { not: 'admin' } } } }),
        prisma.userSubscription.count({ where: { user: { role: { not: 'admin' } } } }),
        prisma.payment.count({ where: { user: { role: { not: 'admin' } } } }),
        prisma.featuredJob.count({ where: { user: { role: { not: 'admin' } } } }),
      ]);

    if (!confirmed) {
      console.log('Admin accounts that will be KEPT:\n');
      admins.forEach((a) => console.log(`  id=${a.id}  ${a.username}  ${a.email}`));
      console.log('\nWould be deleted (everything not owned by an admin):');
      console.log(`  Non-admin users:              ${users}`);
      console.log(`  Jobs (incl. applications):    ${jobs} jobs / ${applications} applications`);
      console.log(`  Feed posts (incl. likes/comments): ${posts}`);
      console.log(`  Collaborations (incl. members):    ${collabs}`);
      console.log(`  Profiles (incl. skills/projects):  ${profiles}`);
      console.log(`  Connections:                   ${connections}`);
      console.log(`  Messages / conversations:      ${messages} / ${conversations}`);
      console.log(`  Notifications:                 ${notifications}`);
      if (subscriptions || payments || featured) {
        console.log('\nRelations without ON DELETE CASCADE (cleaned explicitly):');
        if (subscriptions) console.log(`  User subscriptions:            ${subscriptions}`);
        if (payments) console.log(`  Payments:                      ${payments}`);
        if (featured) console.log(`  Featured jobs:                 ${featured}`);
      }
      console.log('\nRe-run with --yes to delete them:');
      console.log('  node scripts/wipe-nonadmin.mjs --yes');
      return;
    }

    // Relations without onDelete: Cascade — delete first so the user delete
    // doesn't trip a foreign-key constraint.
    await prisma.userSubscription.deleteMany({ where: { user: { role: { not: 'admin' } } } });
    await prisma.payment.deleteMany({ where: { user: { role: { not: 'admin' } } } });
    await prisma.featuredJob.deleteMany({ where: { user: { role: { not: 'admin' } } } });

    // Everything else cascades via the schema's onDelete: Cascade.
    const { count } = await prisma.user.deleteMany({ where: nonAdminWhere });

    console.log(`Deleted ${count} non-admin account(s) and all their cascade data.`);
    console.log(`  - ${jobs} jobs / ${applications} applications`);
    console.log(`  - ${posts} feed posts`);
    console.log(`  - ${collabs} collaborations`);
    console.log(`  - ${profiles} profiles`);
    console.log(`  - ${connections} connections / ${messages} messages / ${conversations} conversations`);
    console.log(`  - ${notifications} notifications`);
    console.log('\nAdmin accounts preserved:');
    admins.forEach((a) => console.log(`  id=${a.id}  ${a.username}  ${a.email}`));
  } catch (err) {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();