import sqlite3 from 'sqlite3';
import path from 'path';
const db = new sqlite3.Database(path.resolve('prisma/careerconnect.db'));
const run = (sql, params=[]) => new Promise((res,rej)=>db.run(sql,params,function(e){if(e)rej(e);else res({id:this.lastID});}));
try {
  const r = await run(
    `INSERT INTO collaborations (creator_id, title, project_type, description, skills_needed, team_size, current_members_count, status, contact_info)
     VALUES (?, ?, ?, ?, ?, ?, 1, 'open', ?)`,
    [1, 'AI Drone', 'Hackathon', 'desc', JSON.stringify(['React','Three.js','Python']), 4, 'alex@example.com / test']
  );
  console.log('OK id=' + r.id);
} catch(e) { console.error('FAIL', e.message); }
db.close();