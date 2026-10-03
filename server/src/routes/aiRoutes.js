import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { run, get, query } from '../db.js';
import { authenticate, optionalAuth } from '../auth.js';

const router = express.Router();

// Initialize Google Gemini AI Client if API Key is configured
let geminiClient = null;
if (process.env.GEMINI_API_KEY) {
  try {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    console.log('✨ [AI Engine] Official Google Gemini Client initialized with Gemini 2.5 Flash');
  } catch (err) {
    console.warn('⚠️ [AI Engine] Google Gemini init warning:', err.message);
  }
} else {
  console.log('💡 [AI Engine] Running with high-fidelity Neural Heuristic Engine. Add GEMINI_API_KEY in server/.env for live LLM inference.');
}

// --- 1. AI RESUME ANALYZER & ATS SCORE OPTIMIZER ---
router.post('/resume-analyzer', optionalAuth, async (req, res) => {
  const { resumeText, jobId } = req.body;
  const currentUserId = req.user?.id;

  try {
    let candidateSkills = [];
    let candidateProfile = null;

    if (currentUserId) {
      const s = await query('SELECT name, proficiency FROM skills WHERE user_id = ?', [currentUserId]);
      candidateSkills = s.map((item) => item.name);
      candidateProfile = await get('SELECT * FROM profiles WHERE user_id = ?', [currentUserId]);
    }

    let targetJob = null;
    let targetSkills = [];
    if (jobId) {
      targetJob = await get('SELECT j.*, c.name as company_name FROM jobs j JOIN companies c ON j.company_id = c.id WHERE j.id = ?', [jobId]);
      if (targetJob) {
        targetSkills = JSON.parse(targetJob.required_skills || '[]');
      }
    }

    // Combine text from resumeText and profile projects/bio for comprehensive scan
    const combinedContent = `${resumeText || ''} ${candidateProfile?.bio || ''} ${candidateProfile?.headline || ''} ${candidateSkills.join(' ')} ${candidateProfile?.projects || ''}`.toLowerCase();

    // Default target skills if no job selected
    const standardTechKeywords = targetSkills.length > 0 ? targetSkills : [
      'react', 'javascript', 'typescript', 'node.js', 'sql', 'git', 'rest api', 'tailwind', 'python'
    ];

    // Compute matched & missing keywords
    const matchedKeywords = standardTechKeywords.filter((k) => combinedContent.includes(k.toLowerCase()));
    const missingKeywords = standardTechKeywords.filter((k) => !combinedContent.includes(k.toLowerCase()));

    // Action verb analysis
    const strongActionVerbs = ['architected', 'engineered', 'spearheaded', 'implemented', 'optimized', 'reduced', 'boosted', 'deployed', 'developed', 'collaborated'];
    const foundVerbs = strongActionVerbs.filter((v) => combinedContent.includes(v));

    // Quantifiable impact check (numbers, percentages, metrics)
    const hasMetrics = /\d+%|\d+x|\$\d+|\d+\s*(users|ms|seconds|hours|queries|stars)/i.test(combinedContent);

    // Calculate sub-scores
    const keywordScore = standardTechKeywords.length > 0 ? Math.round((matchedKeywords.length / standardTechKeywords.length) * 100) : 85;
    const actionVerbScore = Math.min(100, foundVerbs.length * 20);
    const metricScore = hasMetrics ? 90 : 50;
    const formattingScore = combinedContent.length > 150 ? 90 : 65;

    const overallScore = Math.round((keywordScore * 0.4) + (actionVerbScore * 0.25) + (metricScore * 0.2) + (formattingScore * 0.15));

    // Generated AI Recommendations
    const strengths = [];
    const improvements = [];

    if (matchedKeywords.length >= 3) {
      strengths.push(`Strong core stack presence: ${matchedKeywords.slice(0, 4).join(', ')} detected.`);
    }
    if (foundVerbs.length >= 2) {
      strengths.push(`Effective action verbs utilized (${foundVerbs.slice(0, 3).join(', ')}).`);
    }
    if (hasMetrics) {
      strengths.push('Good use of quantifiable metrics and performance statistics.');
    } else {
      improvements.push('Add quantifiable metrics (e.g. "improved page load by 35%", "scaled to 500+ active users").');
    }

    if (missingKeywords.length > 0) {
      improvements.push(`Incorporate high-priority keywords: ${missingKeywords.join(', ')} to boost ATS match.`);
    }

    if (combinedContent.length < 200) {
      improvements.push('Expand bullet points with specific technical challenges tackled and tools used.');
    }

    // AI Bullet Point Rewriter sample
    let bulletRewrites = [
      {
        before: "Built a web app using React and Node.js for student project.",
        after: "Architected a responsive full-stack web application using React 18 and Node.js Express, achieving sub-200ms API response times and 98+ Lighthouse performance score.",
        impact: "+40% ATS Keyword & Metric Boost"
      },
      {
        before: "Helped fix bugs and added database features.",
        after: "Engineered robust database migrations and normalized relational schemas in PostgreSQL, reducing query latency by 32% across 10,000+ mock records.",
        impact: "+35% Seniority & Technical Depth"
      }
    ];

    // If Google Gemini Client is available, run real LLM inference
    if (geminiClient && resumeText && resumeText.length > 50) {
      try {
        const prompt = `You are a Principal Technical Recruiter and ATS Expert. Analyze this candidate resume for "${targetJob ? targetJob.title : 'Junior Software Engineer'}". Return JSON format with { "strengths": ["...", "..."], "improvements": ["...", "..."], "rewrites": [{"before": "...", "after": "...", "impact": "..."}] }. Resume snippet: ${resumeText.slice(0, 2500)}`;
        const aiResponse = await geminiClient.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt
        });
        const match = aiResponse.text?.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed.strengths)) strengths.unshift(...parsed.strengths.slice(0, 2));
          if (Array.isArray(parsed.improvements)) improvements.unshift(...parsed.improvements.slice(0, 2));
          if (Array.isArray(parsed.rewrites)) bulletRewrites = parsed.rewrites;
        }
      } catch (geminiErr) {
        console.warn('Gemini resume generation fallback note:', geminiErr.message);
      }
    }


    res.json({
      overallScore: Math.min(100, Math.max(35, overallScore)),
      breakdown: {
        keywordMatch: keywordScore,
        actionVerbs: actionVerbScore,
        measurableImpact: metricScore,
        atsFormatting: formattingScore
      },
      targetJobTitle: targetJob ? targetJob.title : 'General Early-Career Full-Stack & Frontend Roles',
      targetCompanyName: targetJob ? targetJob.company_name : 'Tech Industry Standard',
      matchedKeywords,
      missingKeywords,
      strengths,
      improvements,
      bulletRewrites
    });
  } catch (err) {
    console.error('Resume analyzer error:', err);
    res.status(500).json({ error: 'Failed to analyze resume' });
  }
});

// --- 2. AI CAREER COPILOT & ROADMAP GENERATOR ---
router.post('/career-copilot', optionalAuth, async (req, res) => {
  const { action, targetRole, query: userQuery, jobTitle, companyName, currentLevel = 'Student' } = req.body;

  try {
    if (action === 'roadmap') {
      const role = targetRole || 'Full-Stack Software Engineer';
      const roadmap = {
        title: `Early-Career Roadmap: ${currentLevel} ➔ ${role}`,
        duration: '12 - 16 Weeks Structured Plan',
        phases: [
          {
            phase: 'Phase 1 (Weeks 1-4): Core Foundations & Clean Architecture',
            goals: ['Master TypeScript strict typing', 'Understand asynchronous JavaScript event loop', 'Component lifecycle & state management patterns'],
            projectIdea: 'Build a production-grade Kanban Board with drag-and-drop and local cache synchronization.',
            skillsToLearn: ['TypeScript', 'Modern React', 'Tailwind CSS']
          },
          {
            phase: 'Phase 2 (Weeks 5-8): Scalable Backend & Database Design',
            goals: ['RESTful API best practices & error middlewares', 'Database normalization, indexing, and connection pooling', 'JWT & OAuth2 authentication security'],
            projectIdea: 'Develop a microservices-inspired auth & document collaboration API with WebSocket live sync.',
            skillsToLearn: ['Node.js', 'PostgreSQL / SQLite', 'WebSockets', 'Docker']
          },
          {
            phase: 'Phase 3 (Weeks 9-12): Cloud Deployment & AI Integration',
            goals: ['Containerization with Docker', 'Deploying on Cloud (AWS/GCP/Vercel) with CI/CD', 'Integrating LLM APIs & Vector Search embeddings'],
            projectIdea: 'Build an AI Career Assistant app with RAG search over PDF resumes.',
            skillsToLearn: ['Docker', 'CI/CD Pipelines', 'Vector Databases', 'OpenAI/Gemini APIs']
          },
          {
            phase: 'Phase 4 (Weeks 13-16): Interview Preparation & Portfolio Polish',
            goals: ['Top 50 LeetCode patterns (Arrays, Two Pointers, Trees)', 'Mock system design for junior engineers', 'Cold outreach & peer networking on CareerZen'],
            projectIdea: 'Deploy portfolio with live demos, lighthouse 100/100, and video walkthroughs.',
            skillsToLearn: ['System Design Basics', 'STAR Behavioral Method', 'Technical Communication']
          }
        ]
      };
      return res.json(roadmap);
    }

    if (action === 'cover_letter') {
      const title = jobTitle || 'Junior Software Engineer';
      const company = companyName || 'TechCorp';
      const candidateName = req.user?.full_name || 'Alex Chen';

      const coverLetter = `Dear ${company} Hiring Team,

I am writing to express my strong enthusiasm for the ${title} position at ${company}. As an early-career developer specializing in modern full-stack web technologies (React, Node.js, and TypeScript), I have focused my academic and open-source journey on building high-performance, accessible software that solves real user pain points.

Recently, I architected and deployed full-stack open-source applications featuring real-time WebSocket sync and optimized relational database schemas. What excites me most about ${company} is your commitment to technical excellence and your supportive engineering culture for junior engineers.

I would love the opportunity to discuss how my proactive problem-solving mindset, fast learning curve, and hands-on project experience can contribute to your engineering squad.

Thank you for your time and consideration.

Warm regards,
${candidateName}
Portfolio & GitHub: Attached on CareerZen Profile`;

      return res.json({ coverLetter });
    }

    if (action === 'portfolio_ideas') {
      const ideas = [
        {
          title: '⚡ Real-Time Collaborative Whiteboard & Code Canvas',
          description: 'A canvas where multiple students can sketch architecture diagrams and write code in real time with WebSocket CRDT conflict resolution.',
          techStack: ['React', 'TypeScript', 'WebSockets', 'Canvas API', 'Node.js'],
          difficulty: 'Intermediate',
          whyRecruitersLoveIt: 'Proves you understand real-time distributed state, WebSocket protocols, and low-level DOM/Canvas manipulation.'
        },
        {
          title: '🤖 RAG-Powered AI Documentation & Code Search',
          description: 'Semantic vector search engine that indexes open-source GitHub repositories and answers questions with precise source code citations.',
          techStack: ['React', 'Python / Node.js', 'Vector DB (Chroma/Pinecone)', 'Gemini API'],
          difficulty: 'Intermediate / Advanced',
          whyRecruitersLoveIt: 'Demonstrates modern AI engineering fundamentals beyond simple API wrapper calls.'
        },
        {
          title: '📊 Student Micro-SaaS Analytics Dashboard',
          description: 'Lightweight, privacy-focused web analytics widget that students can embed into their portfolio sites to track real visitor traffic with zero cookies.',
          techStack: ['Next.js', 'Tailwind CSS', 'PostgreSQL', 'Chart.js'],
          difficulty: 'Intermediate',
          whyRecruitersLoveIt: 'Highlights product intuition, data aggregation, and database indexing capabilities.'
        }
      ];
      return res.json({ ideas });
    }

    if (action === 'cold_outreach') {
      const template = {
        linkedinDm: `Hi [Recruiter Name], I saw TechCorp is expanding its early-talent engineering team! I recently built an open-source project in React & Node that achieved 98+ Lighthouse score. Would love to stay on your radar for upcoming 2026 junior developer cohorts!`,
        email: `Subject: Early-Career Software Engineer — Application for [Role Title] at [Company]\n\nHi [Name],\n\nHope you're having a great week! I recently applied for the [Role Title] position at [Company] through CareerZen.\n\nWith hands-on experience building full-stack web applications with React, TypeScript, and Node.js, I would love to contribute to your engineering milestones. You can check out my live projects and code on my profile.\n\nThanks for your time!\n[Your Name]`
      };
      return res.json(template);
    }

    // If Gemini client is active, generate custom real-world mentor response
    if (geminiClient && (userQuery || action === 'chat')) {
      try {
        const queryText = userQuery || `Give me strategic advice on becoming a standout ${targetRole || 'Full-Stack Developer'} as an early-career applicant.`;
        const aiResponse = await geminiClient.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `You are CareerZen AI, a senior engineering mentor and career strategist for college students, freshers, and early-career developers. Question: "${queryText}". Provide a sharp, encouraging, metric-driven response (under 160 words) structured with actionable steps.`
        });
        if (aiResponse.text) {
          return res.json({ reply: aiResponse.text });
        }
      } catch (geminiErr) {
        console.warn('Gemini copilot generation fallback note:', geminiErr.message);
      }
    }

    // Default general AI response
    res.json({
      reply: `As a student or fresher targeting early-career roles, the #1 differentiator is shipping 2-3 deep, end-to-end projects with clean code and live demos rather than 10 tutorial clones. Highlight trade-offs you made (e.g. why SQLite over MongoDB, how you managed state) in your CareerZen profile!`
    });

  } catch (err) {
    console.error('Career copilot error:', err);
    res.status(500).json({ error: 'Career copilot error' });
  }
});

// --- 3. AI MOCK INTERVIEW COACH ---
const INTERVIEW_QUESTIONS = {
  'React & Frontend': [
    {
      id: 'react_1',
      question: 'Explain how React’s Virtual DOM and Reconciliation algorithm work. Why is updating state in React considered faster than direct DOM manipulation in large apps?',
      idealAnswer: 'The Virtual DOM is an in-memory lightweight JavaScript object representation of the real DOM. When state changes, React creates a new VDOM tree and uses the Diffing (Reconciliation) algorithm (Fiber) to compare the new tree with the previous one (O(n) complexity heuristics). It batches changes and computes the minimal set of real DOM mutations, avoiding costly layout reflows and repaints in the browser.',
      keywords: ['in-memory', 'diffing', 'fiber', 'batching', 'reflow', 'repaint', 'reconciliation']
    },
    {
      id: 'react_2',
      question: 'What is the difference between `useEffect`, `useLayoutEffect`, and `useCallback`? When would you use `useCallback` to prevent performance bottlenecks?',
      idealAnswer: '`useEffect` runs asynchronously after the render is committed to screen. `useLayoutEffect` runs synchronously immediately after DOM mutations before the browser paints, ideal for measuring DOM layout. `useCallback` memoizes a callback function instance between renders, preventing child components wrapped in `React.memo` from unnecessary re-renders when passing functions as props.',
      keywords: ['asynchronous', 'synchronous', 'paint', 'memoize', 're-render', 'react.memo', 'props']
    }
  ],
  'Full-Stack & APIs': [
    {
      id: 'fs_1',
      question: 'How do JWT (JSON Web Token) authentication flows work? What are the security risks with storing JWTs in localStorage vs httpOnly Cookies, and how do you mitigate them?',
      idealAnswer: 'JWT consists of Header, Payload, and Signature. Upon login, the server signs the token with a secret key. In localStorage, tokens are vulnerable to XSS (Cross-Site Scripting) attacks because any injected script can read `localStorage`. Storing tokens in `httpOnly, Secure, SameSite=Strict` cookies protects them from XSS since JavaScript cannot access them, while CSRF protection tokens or SameSite flags prevent Cross-Site Request Forgery.',
      keywords: ['header', 'payload', 'signature', 'xss', 'csrf', 'httponly', 'samesite', 'secure']
    },
    {
      id: 'fs_2',
      question: 'Explain database indexing. How does a B-Tree index speed up SELECT queries, and what is the trade-off with INSERT and UPDATE operations?',
      idealAnswer: 'Database indexing creates a separate B-Tree data structure sorted by the indexed column(s). Instead of a full table scan (O(N)), the database performs a binary search path through tree nodes in O(log N). The trade-off is write overhead: every INSERT, UPDATE, or DELETE must also update the index tree, and indexes consume additional disk space and memory.',
      keywords: ['b-tree', 'full table scan', 'o(log n)', 'binary search', 'write overhead', 'disk space']
    }
  ],
  'Behavioral & Leadership (STAR)': [
    {
      id: 'beh_1',
      question: 'Tell me about a challenging technical bug or blocker you encountered in a project or hackathon under a tight deadline. How did you diagnose and resolve it?',
      idealAnswer: 'Structure using STAR: Situation: Facing a WebSocket connection crash 3 hours before hackathon submission. Task: I was responsible for diagnosing the real-time syncing module. Action: I isolated the issue using browser DevTools network frames, identified an unhandled JSON parse exception on heartbeat pings, and implemented a robust reconnection retry backoff. Result: All team devices reconnected seamlessly and we successfully demoed the project to the judges.',
      keywords: ['situation', 'task', 'action', 'result', 'isolate', 'diagnose', 'debug', 'metric', 'outcome']
    }
  ]
};

router.post('/interview-coach/start', (req, res) => {
  const { topic = 'React & Frontend' } = req.body;
  const questionsList = INTERVIEW_QUESTIONS[topic] || INTERVIEW_QUESTIONS['React & Frontend'];
  const randomQ = questionsList[Math.floor(Math.random() * questionsList.length)];

  res.json({
    topic,
    question: randomQ.question,
    questionId: randomQ.id
  });
});

router.post('/interview-coach/evaluate', async (req, res) => {
  const { topic = 'React & Frontend', question, userAnswer } = req.body;
  const userId = req.user?.id;

  if (!userAnswer || userAnswer.trim().length < 15) {
    return res.status(400).json({ error: 'Please provide a more detailed answer for AI evaluation (at least 2-3 sentences).' });
  }

  const answerLower = userAnswer.toLowerCase();

  // Find matching question for ideal model answer
  const questionsList = INTERVIEW_QUESTIONS[topic] || [];
  const foundQ = questionsList.find((q) => q.question === question) || questionsList[0];

  const keywords = foundQ?.keywords || ['concept', 'trade-off', 'performance', 'architecture'];
  const matchedKeywords = keywords.filter((k) => answerLower.includes(k));

  // Compute scoring
  const lengthBonus = Math.min(30, Math.floor(userAnswer.split(' ').length * 0.6));
  const keywordScore = Math.round((matchedKeywords.length / Math.max(1, keywords.length)) * 50);
  const structureScore = /first|because|second|result|however|for example|trade-off/i.test(answerLower) ? 20 : 10;

  const totalScore = Math.min(100, Math.max(40, lengthBonus + keywordScore + structureScore));

  const strengths = [];
  const improvements = [];

  if (matchedKeywords.length >= 2) {
    strengths.push(`Accurately covered key concepts: ${matchedKeywords.join(', ')}.`);
  } else {
    improvements.push(`Mention key technical terms like: ${keywords.slice(0, 3).join(', ')}.`);
  }

  if (userAnswer.length > 180) {
    strengths.push('Great depth and thorough explanation.');
  } else {
    improvements.push('Elaborate on the "Why" and technical trade-offs behind your choice.');
  }

  if (topic.includes('Behavioral')) {
    if (/situation|task|action|result/i.test(answerLower)) {
      strengths.push('Excellent adherence to the STAR framework.');
    } else {
      improvements.push('Structure your story explicitly with Situation, Task, Action, and Measurable Result.');
    }
  }

  // If Gemini client is active, evaluate with Gemini 2.5 Flash
  if (geminiClient && userAnswer && userAnswer.length > 20) {
    try {
      const prompt = `You are a Principal Engineering Interviewer evaluating a candidate. Topic: "${topic}". Question: "${question}". Candidate Answer: "${userAnswer}". Return JSON only: { "score": number between 40 and 95, "strengths": ["...", "..."], "improvements": ["...", "..."], "modelAnswer": "concise senior engineer benchmark answer" }`;
      const aiResponse = await geminiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      const match = aiResponse.text?.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return res.json({
          score: parsed.score || totalScore,
          strengths: parsed.strengths || strengths,
          improvements: parsed.improvements || improvements,
          modelAnswer: parsed.modelAnswer || foundQ?.idealAnswer,
          matchedKeywords
        });
      }
    } catch (geminiErr) {
      console.warn('Gemini interview evaluation fallback note:', geminiErr.message);
    }
  }

  // Save to DB if authenticated
  if (userId) {
    await run(
      `INSERT INTO mock_interviews (user_id, role_topic, question, user_answer, score, feedback)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        topic,
        question,
        userAnswer,
        totalScore,
        JSON.stringify({ strengths, improvements })
      ]
    );
  }

  res.json({
    score: totalScore,
    strengths,
    improvements,
    modelIdealAnswer: foundQ?.idealAnswer || 'In an ideal answer, describe the core mechanism, outline real-world trade-offs, and cite a concrete project example.'
  });
});

// --- 4. SMART SKILL GAP ANALYZER ---
router.get('/skill-gap/:jobId', optionalAuth, async (req, res) => {
  const jobId = Number(req.params.jobId);
  const userId = req.user?.id;

  try {
    const job = await get(
      `SELECT j.*, c.name as company_name FROM jobs j JOIN companies c ON j.company_id = c.id WHERE j.id = ?`,
      [jobId]
    );
    if (!job) return res.status(404).json({ error: 'Job not found' });

    let userSkills = [];
    if (userId) {
      const s = await query('SELECT name FROM skills WHERE user_id = ?', [userId]);
      userSkills = s.map((sk) => sk.name.toLowerCase());
    }

    const requiredSkills = JSON.parse(job.required_skills || '[]');
    const matched = requiredSkills.filter((sk) => userSkills.includes(sk.toLowerCase()));
    const missing = requiredSkills.filter((sk) => !userSkills.includes(sk.toLowerCase()));

    const matchPercent = requiredSkills.length > 0 ? Math.round((matched.length / requiredSkills.length) * 100) : 100;

    // Actionable learning path for missing skills
    const learningPath = missing.map((sk) => ({
      skill: sk,
      estimatedTime: '2 - 3 Days',
      recommendedProject: `Build a mini application incorporating ${sk} with clean documentation.`,
      resources: [`Official ${sk} Documentation & Tutorials`, 'FreeCodeCamp Interactive Lab']
    }));

    res.json({
      jobTitle: job.title,
      companyName: job.company_name,
      matchPercentage: matchPercent,
      matchedSkills: matched,
      missingSkills: missing,
      learningPath
    });
  } catch (err) {
    console.error('Skill gap error:', err);
    res.status(500).json({ error: 'Failed to analyze skill gap' });
  }
});

// --- 5. SAVED JOBS ---
router.get('/saved-jobs', authenticate, async (req, res) => {
  try {
    const saved = await query(
      `SELECT 
        j.*, c.name as company_name, c.logo_url as company_logo, c.location as company_location
       FROM saved_jobs sj
       JOIN jobs j ON sj.job_id = j.id
       JOIN companies c ON j.company_id = c.id
       WHERE sj.user_id = ?
       ORDER BY sj.created_at DESC`,
      [req.user.id]
    );

    res.json(saved.map((j) => ({ ...j, required_skills: JSON.parse(j.required_skills || '[]') })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch saved jobs' });
  }
});

router.post('/saved-jobs/:jobId', authenticate, async (req, res) => {
  const jobId = Number(req.params.jobId);
  const userId = req.user.id;

  try {
    const existing = await get('SELECT id FROM saved_jobs WHERE user_id = ? AND job_id = ?', [userId, jobId]);
    let isSaved = false;

    if (existing) {
      await run('DELETE FROM saved_jobs WHERE id = ?', [existing.id]);
      isSaved = false;
    } else {
      await run('INSERT INTO saved_jobs (user_id, job_id) VALUES (?, ?)', [userId, jobId]);
      isSaved = true;
    }

    res.json({ isSaved });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle saved job' });
  }
});

export default router;
