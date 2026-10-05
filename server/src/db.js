import prismaClientPkg from '@prisma/client';

const { PrismaClient } = prismaClientPkg;
import bcrypt from 'bcryptjs';
import { logger } from './logger.js';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Helper to convert Prisma results to plain objects
const toPlain = (obj) => {
  if (obj === undefined || obj === null) return null;
  return JSON.parse(JSON.stringify(obj, (_, value) =>
    typeof value === 'bigint' ? Number(value) : value
  ));
};

// Promise wrappers for clean async/await - maintain same interface as sqlite
export const query = async (sql, params = []) => {
  // For raw SQL queries, we use prisma.$queryRaw
  // But most routes use our specific model methods now
  // This is a fallback for any remaining raw SQL
  logger.warn({ sql }, 'Raw SQL query used - consider migrating to Prisma model');
  const results = await prisma.$queryRawUnsafe(sql, ...params);
  return results.map(r => toPlain(r));
};

export const get = async (sql, params = []) => {
  logger.warn({ sql }, 'Raw SQL get used - consider migrating to Prisma model');
  const results = await prisma.$queryRawUnsafe(sql, ...params);
  return toPlain(results[0]) || null;
};

export const run = async (sql, params = []) => {
  logger.warn({ sql }, 'Raw SQL run used - consider migrating to Prisma model');

  // Callers rely on `result.id` being the id of the row they just inserted.
  // `last_insert_rowid()` is SQLite-only, so use RETURNING instead — it works
  // on PostgreSQL and on SQLite 3.35+, letting both providers share this path.
  if (/^\s*INSERT\b/i.test(sql) && !/\bRETURNING\b/i.test(sql)) {
    const rows = await prisma.$queryRawUnsafe(`${sql} RETURNING id`, ...params);
    const inserted = toPlain(rows[0]);
    return { id: inserted?.id ?? null, changes: rows.length };
  }

  const changes = await prisma.$executeRawUnsafe(sql, ...params);
  return { id: changes, changes };
};

export const exec = async (sql) => {
  logger.warn({ sql }, 'Raw SQL exec used - consider migrating to Prisma model');
  await prisma.$executeRawUnsafe(sql);
};

export async function initDB() {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');

    // Run Prisma migrations in production
    if (process.env.NODE_ENV === 'production') {
      // Migrations are handled by `prisma migrate deploy` in CI/CD
    }

    await seedInitialData();
  } catch (err) {
    logger.error({ err }, 'Failed to initialize database');
    throw err;
  }
}

async function seedInitialData() {
  // Demo accounts ship with a known password (password123) and include a
  // recruiter who can post jobs. Never auto-create them on a public
  // deployment — opt in explicitly with SEED_DEMO=true.
  if (process.env.NODE_ENV === 'production' && process.env.SEED_DEMO !== 'true') {
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      logger.info('Database already has users, skipping');
      return;
    }
    logger.info('Production build — skipping demo seed. Run scripts/promote-admin.mjs to create the first admin.');
    return;
  }

  const userCount = await prisma.user.count();
  if (userCount > 0) {
    logger.info('Database already seeded, skipping');
    return;
  }

  logger.info('🌱 Seeding initial demo users and data...');
  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Create Alex Chen (Student / Early-Career Dev)
  const alex = await prisma.user.create({
    data: {
      username: 'alexchen',
      email: 'alex@example.com',
      passwordHash,
      role: 'job_seeker',
      profile: {
        create: {
          fullName: 'Alex Chen',
          headline: 'CS Senior @ Berkeley | Aspiring Full-Stack & AI Engineer | Open Source Contributor',
          bio: 'Passionate final year computer science student with a focus on modern web stacks (React, Node, TypeScript) and applied machine learning. Built 3 full-stack apps and love collaborating on early-career projects!',
          location: 'San Francisco, CA (Open to Remote)',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
          bannerUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80',
          targetRole: 'Full-Stack Developer / Frontend Engineer',
          education: JSON.stringify([
            { school: 'UC Berkeley', degree: 'B.S. in Computer Science', year: '2023 - 2026', gpa: '3.85 / 4.0' }
          ]),
          experience: JSON.stringify([
            { role: 'Software Engineering Intern', company: 'Nova Labs', period: 'Summer 2025', description: 'Engineered responsive dashboard widgets in React + TypeScript, reducing page latency by 35%.' }
          ]),
          projects: JSON.stringify([
            { title: 'DevMatch AI', description: 'Semantic project recommendation platform for open-source contributors.', liveUrl: 'https://devmatch.app', githubUrl: 'https://github.com/alexchen/devmatch', tech: ['React', 'Node.js', 'Vector DB', 'Tailwind'] },
            { title: 'CampusPulse', description: 'Real-time student community board with live voting and event notifications.', liveUrl: 'https://campuspulse.app', githubUrl: 'https://github.com/alexchen/campuspulse', tech: ['TypeScript', 'Express', 'WebSocket', 'SQLite'] }
          ]),
          socialLinks: JSON.stringify({ github: 'https://github.com/alexchen', linkedin: 'https://linkedin.com/in/alexchen', portfolio: 'https://alexchen.dev' })
        }
      },
      skills: {
        create: [
          { name: 'React', category: 'Frontend', proficiency: 'Expert' },
          { name: 'Node.js', category: 'Backend', proficiency: 'Intermediate' },
          { name: 'TypeScript', category: 'Languages', proficiency: 'Intermediate' },
          { name: 'Tailwind CSS', category: 'Frontend', proficiency: 'Expert' },
          { name: 'Python', category: 'Languages', proficiency: 'Beginner' }
        ]
      }
    }
  });

  // 2. Create Priya Sharma (Design Technologist / Fresher)
  const priya = await prisma.user.create({
    data: {
      username: 'priyasharma',
      email: 'priya@example.com',
      passwordHash,
      role: 'job_seeker',
      profile: {
        create: {
          fullName: 'Priya Sharma',
          headline: 'UI/UX Design Engineer & Frontend Dev | Creating Accessible Web Experiences | 2026 Grad',
          bio: 'Bridging design systems and front-end engineering. Obsessed with micro-interactions, responsive design, and WCAG accessibility standards. Seeking full-time frontend roles in product-led teams.',
          location: 'New York, NY (Open to Relocation)',
          avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80',
          bannerUrl: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1200&auto=format&fit=crop&q=80',
          targetRole: 'Design Technologist / UI Engineer',
          education: JSON.stringify([
            { school: 'New York University (NYU)', degree: 'B.S. in Computer Science & Digital Media', year: '2022 - 2026', gpa: '3.9 / 4.0' }
          ]),
          experience: JSON.stringify([
            { role: 'Frontend & UI Intern', company: 'DesignCraft Studio', period: 'Winter 2025', description: 'Built accessible design system components and implemented smooth Micro-interactions with Framer Motion.' }
          ]),
          projects: JSON.stringify([
            { title: 'Aura UI Kit', description: 'Accessible, light-weight headless UI component collection with Tailwind.', liveUrl: 'https://auraui.app', githubUrl: 'https://github.com/priyasharma/aura-ui', tech: ['React', 'Tailwind CSS', 'A11y'] }
          ]),
          socialLinks: JSON.stringify({ github: 'https://github.com/priyasharma', linkedin: 'https://linkedin.com/in/priyasharma', portfolio: 'https://priyasharma.design' })
        }
      },
      skills: {
        create: [
          { name: 'React', category: 'Frontend', proficiency: 'Expert' },
          { name: 'Next.js', category: 'Frontend', proficiency: 'Intermediate' },
          { name: 'CSS / Tailwind', category: 'Frontend', proficiency: 'Expert' },
          { name: 'UI / UX Design', category: 'Design', proficiency: 'Expert' },
          { name: 'Figma', category: 'Design', proficiency: 'Expert' }
        ]
      }
    }
  });

  // 3. Create Sarah Jenkins (Technical Recruiter at TechCorp)
  const sarah = await prisma.user.create({
    data: {
      username: 'sarahjenkins',
      email: 'sarah@techcorp.io',
      passwordHash,
      role: 'recruiter',
      profile: {
        create: {
          fullName: 'Sarah Jenkins',
          headline: 'Head of Early-Career & University Talent Acquisition @ TechCorp Solutions',
          bio: 'Passionate about giving students and career-switchers their breakthrough opportunity. Hiring software engineers, product designers, and data analysts globally.',
          location: 'San Francisco, CA',
          avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80',
          bannerUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&auto=format&fit=crop&q=80',
          targetRole: 'Technical Recruiter',
          education: JSON.stringify([
            { school: 'Stanford University', degree: 'B.A. in Organizational Psychology', year: '2016 - 2020', gpa: '3.9 / 4.0' }
          ]),
          experience: JSON.stringify([
            { role: 'Lead Talent Recruiter', company: 'TechCorp Solutions', period: '2023 - Present', description: 'Managing global campus hiring, new grad engineering cohorts, and summer internship programs.' }
          ]),
          projects: JSON.stringify([]),
          socialLinks: JSON.stringify({ linkedin: 'https://linkedin.com/in/sarahjenkins', company: 'https://techcorp.io' })
        }
      }
    }
  });

  // 4. Create Company for Sarah (TechCorp)
  const company = await prisma.company.create({
    data: {
      recruiterId: sarah.id,
      name: 'TechCorp Innovations',
      tagline: 'Building the next generation of collaborative cloud and AI software.',
      description: 'TechCorp is a high-growth technology company empowering developers worldwide. We strongly believe in mentoring early-career talent, offering hands-on projects, competitive stipends, and fast-track career growth.',
      website: 'https://techcorp.io',
      logoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80',
      location: 'San Francisco, CA / Austin, TX / Remote',
      industry: 'Software & Cloud Infrastructure',
      companySize: '50-200 employees'
    }
  });

  // 5. Seed Jobs posted by Sarah
  await prisma.job.createMany({
    data: [
      {
        companyId: company.id,
        recruiterId: sarah.id,
        title: 'Junior Full-Stack Developer (2026 Cohort)',
        description: 'We are looking for enthusiastic junior developers to join our Core Product team! You will collaborate closely with senior engineers to design and build scalable web features using React, Node.js, and modern cloud databases.',
        requirements: '• Solid foundation in JavaScript/TypeScript and React\n• Basic understanding of backend APIs (Node/Express or Python)\n• Excitement to learn, write clean code, and participate in peer code reviews\n• Great communication and collaborative mindset',
        location: 'San Francisco, CA / Remote',
        workplaceType: 'Remote',
        jobType: 'Full-time',
        experienceLevel: 'Fresher',
        salaryRange: '$85,000 - $110,000 / year + Equity + Mentorship',
        requiredSkills: JSON.stringify(['React', 'JavaScript', 'Node.js', 'TypeScript', 'Tailwind CSS']),
        status: 'open'
      },
      {
        companyId: company.id,
        recruiterId: sarah.id,
        title: 'Frontend Engineering Intern (Summer 2026)',
        description: 'Join our Design Systems and UI Engineering team for a high-impact 12-week paid summer internship. You will build reusable components, polish user workflows, and ship features directly to thousands of active users.',
        requirements: '• Enrolled in or recently graduated with a CS/Design or related degree\n• Experience building responsive web applications with React or Vue\n• Passion for accessible UI/UX and micro-interactions',
        location: 'Austin, TX / Hybrid',
        workplaceType: 'Hybrid',
        jobType: 'Internship',
        experienceLevel: 'Internship',
        salaryRange: '$45 - $55 / hr + Housing Stipend',
        requiredSkills: JSON.stringify(['React', 'CSS / Tailwind', 'Figma', 'Web Accessibility (a11y)']),
        status: 'open'
      }
    ]
  });

  // 6. Seed Posts in Feed
  const post1 = await prisma.post.create({
    data: {
      authorId: alex.id,
      content: '🚀 Just published **DevMatch AI** — an open-source project designed to connect students with beginner-friendly repo issues! Built with React, Node.js, and SQLite. Would love feedback from other students and recruiters on the architecture! Check out the live project link in my profile bio 🌟',
      mediaUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1000&auto=format&fit=crop&q=80',
      category: 'Project Showcase',
      tags: JSON.stringify(['#React', '#NodeJS', '#BuildInPublic', '#StudentProject', '#OpenSource'])
    }
  });

  const post2 = await prisma.post.create({
    data: {
      authorId: sarah.id,
      content: '👋 Hey CareerZen community! We just opened applications for our **2026 Junior Engineering Cohort** and **Summer Internship Program** at TechCorp! \n\nWe prioritize portfolio projects, problem-solving curiosity, and enthusiasm over pedigree. Head over to the Jobs tab to apply or drop a comment below!',
      mediaUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1000&auto=format&fit=crop&q=80',
      category: 'Hiring',
      tags: JSON.stringify(['#Hiring', '#EarlyCareer', '#Freshers2026', '#TechCorp', '#Internships'])
    }
  });

  // 7. Seed Comments and Likes
  await prisma.postLike.createMany({
    data: [
      { postId: post1.id, userId: priya.id },
      { postId: post1.id, userId: sarah.id },
      { postId: post2.id, userId: alex.id }
    ],
    skipDuplicates: true
  });

  await prisma.postComment.createMany({
    data: [
      { postId: post1.id, userId: priya.id, content: 'This looks amazing Alex! Love the clean UI and how intuitive the matching feels. Great job on the responsiveness! 👏' },
      { postId: post1.id, userId: sarah.id, content: 'Impressive project Alex! Really like seeing student projects that solve real pain points. You should check out our Junior Full-Stack role!' }
    ],
    skipDuplicates: true
  });

  // 8. Seed Connection between Priya and Sarah (accepted)
  await prisma.connection.create({
    data: {
      senderId: priya.id,
      receiverId: sarah.id,
      status: 'accepted'
    }
  });

  // Seed notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: alex.id,
        actorId: priya.id,
        type: 'like',
        message: 'Priya Sharma liked your post: "Just published DevMatch AI..."',
        payload: JSON.stringify({ postId: post1.id })
      },
      {
        userId: alex.id,
        actorId: sarah.id,
        type: 'comment',
        message: 'Sarah Jenkins commented: "Impressive project Alex! Really like seeing student projects..."',
        payload: JSON.stringify({ postId: post1.id })
      }
    ],
    skipDuplicates: true
  });

  // 9. Seed Collaborations
  const collab1 = await prisma.collaboration.create({
    data: {
      creatorId: alex.id,
      title: 'EcoTrack AI — HackMIT 2026 Submission',
      projectType: 'Hackathon',
      description: 'Building an open-source AI computer vision app to track carbon footprint and categorize recyclable materials from smartphone camera photos. Looking for a frontend/design partner and a Python ML builder!',
      skillsNeeded: JSON.stringify(['React', 'TypeScript', 'Tailwind CSS', 'Python / OpenCV', 'UI/UX Design']),
      teamSize: 4,
      currentMembersCount: 2,
      status: 'open',
      contactInfo: 'alex@example.com / Discord: @alexchen_dev',
      members: {
        create: [
          { userId: alex.id, roleTitle: 'Project Lead / Backend', status: 'joined' }
        ]
      }
    }
  });

  const collab2 = await prisma.collaboration.create({
    data: {
      creatorId: priya.id,
      title: 'Accessible UI Component Library for Next.js',
      projectType: 'Open Source',
      description: 'Creating an open-source, keyboard-accessible component library specifically optimized for student portfolio websites. Need contributors with React and a11y experience!',
      skillsNeeded: JSON.stringify(['React', 'Next.js', 'Web Accessibility (a11y)', 'Tailwind CSS']),
      teamSize: 3,
      currentMembersCount: 1,
      status: 'open',
      contactInfo: 'priya@example.com / GitHub: @priyasharma',
      members: {
        create: [
          { userId: priya.id, roleTitle: 'Lead Designer & Frontend', status: 'joined' }
        ]
      }
    }
  });

  logger.info('✅ Initial database seed complete!');

  // Seed job posting packages
  const packageCount = await prisma.jobPackage.count();
  if (packageCount === 0) {
    logger.info('🌱 Seeding job posting packages...');
    await prisma.jobPackage.createMany({
      data: [
        {
          name: 'Basic',
          price: 0,
          jobLimit: 1,
          durationDays: 30,
          features: JSON.stringify(['1 job posting for 30 days', 'Standard listing', 'Basic analytics'])
        },
        {
          name: 'Standard',
          price: 29,
          jobLimit: 3,
          durationDays: 90,
          features: JSON.stringify(['3 job postings for 90 days', 'Featured in search results', 'Advanced analytics', 'Priority support'])
        },
        {
          name: 'Premium',
          price: 99,
          jobLimit: -1,
          durationDays: 180,
          features: JSON.stringify(['Unlimited job postings for 180 days', 'Top placement in search', 'Full analytics dashboard', 'Dedicated account manager', 'Featured company badge'])
        },
        {
          name: 'Enterprise',
          price: 299,
          jobLimit: -1,
          durationDays: 365,
          features: JSON.stringify(['Unlimited job postings for 1 year', 'API access', 'Custom integrations', 'Bulk posting tools', 'Advanced analytics', 'Dedicated success manager'])
        }
      ]
    });
    logger.info('✅ Job posting packages seeded!');
  }
}

export default prisma;