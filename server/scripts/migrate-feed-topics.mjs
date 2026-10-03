import { run, get, query } from '../src/db.js';

const DEFAULT_TOPICS = [
  { tag: '#BuildInPublic', label: 'Build in Public', color: 'brand', sort_order: 0 },
  { tag: '#Freshers2026', label: 'Freshers 2026', color: 'purple', sort_order: 1 },
  { tag: '#React', label: 'React', color: 'emerald', sort_order: 2 },
  { tag: '#OpenSource', label: 'Open Source', color: 'amber', sort_order: 3 },
  { tag: '#InternshipHunt', label: 'Internship Hunt', color: 'indigo', sort_order: 4 },
  { tag: '#ResumeReview', label: 'Resume Review', color: 'rose', sort_order: 5 },
  { tag: '#AI', label: 'AI', color: 'cyan', sort_order: 6 },
];

async function main() {
  try {
    await run(
      `CREATE TABLE IF NOT EXISTS feed_topics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tag TEXT UNIQUE NOT NULL,
        label TEXT NOT NULL,
        description TEXT,
        color TEXT DEFAULT 'brand',
        enabled INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`
    );
    console.log('feed_topics table created');

    const existing = await query('SELECT COUNT(*) as c FROM feed_topics');
    const count = existing[0]?.c || 0;
    console.log('existing rows:', count);

    if (count === 0) {
      for (const t of DEFAULT_TOPICS) {
        await run(
          'INSERT INTO feed_topics (tag, label, color, enabled, sort_order) VALUES (?, ?, ?, 1, ?)',
          [t.tag, t.label, t.color, t.sort_order]
        );
      }
      console.log(`Seeded ${DEFAULT_TOPICS.length} default feed topics`);
    } else {
      console.log('Topics already seeded, skipping');
    }
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

main();