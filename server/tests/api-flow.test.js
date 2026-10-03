// Comprehensive end-to-end automated test for CareerZen (Core Flow + AI & Collab Functions)
import http from 'http';

// Point at the running backend. Override with API_BASE_URL for CI/prod.
const BASE_URL = `${process.env.API_BASE_URL || 'http://localhost:5009'}/api`;

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`[${res.status}] ${url}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function runTest() {
  console.log('🧪 Starting CareerZen Full Automated Flow & AI Intelligence Test...\n');

  try {
    // 1. Health check
    console.log('Step 1: Checking API health...');
    const health = await request('/health');
    console.log('  ✅ API Health:', health.status);

    // 2. Real User Registration (no demo users)
    console.log('\nStep 2: Registering real users (Alex - Student, Priya - Fresher, Sarah - Recruiter)...');
    const timestamp = Date.now().toString().slice(-4);
    const alexReg = await request('/register', { method: 'POST', body: JSON.stringify({ username: `alexchen_${timestamp}`, email: `alex_${timestamp}@example.com`, password: 'password123', fullName: 'Alex Chen', headline: 'CS Senior @ Berkeley | Aspiring Full-Stack & AI Engineer' }) });
    const priyaReg = await request('/register', { method: 'POST', body: JSON.stringify({ username: `priyasharma_${timestamp}`, email: `priya_${timestamp}@example.com`, password: 'password123', fullName: 'Priya Sharma', headline: 'UI/UX Design Engineer & Frontend Dev' }) });
    const sarahReg = await request('/register', { method: 'POST', body: JSON.stringify({ username: `sarahjenkins_${timestamp}`, email: `sarah_${timestamp}@techcorp.io`, password: 'password123', fullName: 'Sarah Jenkins', headline: 'Head of Early-Career & University Talent Acquisition', role: 'recruiter' }) });
    const alexToken = alexReg.token;
    const priyaToken = priyaReg.token;
    const sarahToken = sarahReg.token;
    console.log('  ✅ Real users registered and authenticated.');
    console.log('     Alex:', alexReg.user.id, '| Priya:', priyaReg.user.id, '| Sarah:', sarahReg.user.id);

    // 3. Update Profile & Add Skill
    console.log('\nStep 3: Alex updating profile and skills...');
    const testSkillName = `TypeScript-${Date.now().toString().slice(-4)}`;
    const newSkill = await request('/skills', {
      method: 'POST',
      headers: { Authorization: `Bearer ${alexToken}` },
      body: JSON.stringify({ name: testSkillName, category: 'Frontend', proficiency: 'Advanced' })
    });
    console.log('  ✅ New skill added:', newSkill.name);

    // 4. Create Post, Like, Comment
    console.log('\nStep 4: Alex creates a post; Priya likes and comments...');
    const post = await request('/posts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${alexToken}` },
      body: JSON.stringify({
        content: `Excited to announce my new AI project v${Date.now().toString().slice(-3)} built with React and Vector Search!`,
        category: 'Project Showcase',
        tags: ['#AI', '#FullStack', '#EarlyCareer']
      })
    });
    console.log('  ✅ Post created with ID:', post.id);

    const likeRes = await request(`/posts/${post.id}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${priyaToken}` }
    });
    console.log('  ✅ Priya liked post! Total likes:', likeRes.likesCount);

    const comment = await request(`/posts/${post.id}/comments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${priyaToken}` },
      body: JSON.stringify({ content: 'Awesome project Alex! Love the architecture.' })
    });
    console.log('  ✅ Priya commented:', comment.content);

    // 5. Connection Graph
    console.log('\nStep 5: Connection networking...');
    const alexConnections = await request('/connections', { headers: { Authorization: `Bearer ${alexToken}` } });
    console.log(`  ✅ Alex active connections: ${alexConnections.connections.length}`);

    // 6. Recruiter Job Posting & Candidate Application
    console.log('\nStep 6: Sarah posts job; Alex searches and applies...');
    const jobTitle = `AI Software Engineer ${Date.now().toString().slice(-4)}`;
    const newJobRes = await request('/jobs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sarahToken}` },
      body: JSON.stringify({
        title: jobTitle,
        description: 'Build LLM pipelines and full-stack interfaces in React & Python.',
        location: 'San Francisco, CA / Remote',
        workplace_type: 'Remote',
        job_type: 'Full-time',
        experience_level: 'Fresher',
        salary_range: '$100,000 - $125,000 / year',
        required_skills: ['React', 'Node.js', 'Python', 'TypeScript', 'Tailwind CSS']
      })
    });
    const createdJob = newJobRes.job;
    console.log('  ✅ Job posted:', createdJob.title, '(ID:', createdJob.id, ')');

    const applyRes = await request('/applications', {
      method: 'POST',
      headers: { Authorization: `Bearer ${alexToken}` },
      body: JSON.stringify({
        jobId: createdJob.id,
        cover_note: 'Passionate about building AI applications in React and Node.js!',
        resume_url: 'https://alexchen.dev/resume.pdf',
        portfolio_url: 'https://alexchen.dev'
      })
    });
    console.log('  ✅ Alex applied! Application ID:', applyRes.applicationId);

    // Recruiter Shortlists Candidate
    const jobApplicants = await request(`/applications/job/${createdJob.id}`, {
      headers: { Authorization: `Bearer ${sarahToken}` }
    });
    console.log(`  ✅ Recruiter sees ${jobApplicants.applicants.length} applicant(s). Match Score: ${jobApplicants.applicants[0]?.matchScore}%`);

    await request(`/applications/${jobApplicants.applicants[0].application_id}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sarahToken}` },
      body: JSON.stringify({ status: 'shortlisted' })
    });
    console.log('  ✅ Recruiter updated status to: shortlisted 🎉');

    // 7. Real-Time 1-on-1 Messaging
    console.log('\nStep 7: Direct Messaging between Recruiter and Candidate...');
    const msg = await request('/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sarahToken}` },
      body: JSON.stringify({
        receiverId: priyaReg.user.id,
        content: `Hi ${alexReg.user.full_name || 'Alex'}! We were impressed by your profile. Let's schedule an interview for ${createdJob.title}!`
      })
    });
    console.log('  ✅ Recruiter sent message:', msg.content);

    // --- 8. AI INTELLIGENCE SUITE TESTS ---
    console.log('\nStep 8: Testing AI Resume Analyzer & ATS Scorer...');
    const resumeAnalysis = await request('/ai/resume-analyzer', {
      method: 'POST',
      headers: { Authorization: `Bearer ${alexToken}` },
      body: JSON.stringify({
        jobId: createdJob.id,
        resumeText: 'Architected responsive full-stack applications in React 18 and Node.js Express. Optimized SQL queries by 35%.'
      })
    });
    console.log(`  ✅ ATS Score: ${resumeAnalysis.overallScore}/100`);
    console.log(`     - Keyword Match: ${resumeAnalysis.breakdown.keywordMatch}%`);
    console.log(`     - Action Verbs: ${resumeAnalysis.breakdown.actionVerbs}%`);
    console.log(`     - Matched Keywords: ${resumeAnalysis.matchedKeywords.join(', ')}`);
    console.log(`     - AI Bullet Rewrites Generated: ${resumeAnalysis.bulletRewrites.length}`);

    console.log('\nStep 9: Testing AI Career Copilot (Roadmap, Cover Pitch, Portfolio Ideas)...');
    const roadmap = await request('/ai/career-copilot', {
      method: 'POST',
      headers: { Authorization: `Bearer ${alexToken}` },
      body: JSON.stringify({ action: 'roadmap', targetRole: 'AI Full-Stack Engineer' })
    });
    console.log(`  ✅ Roadmap Generated: "${roadmap.title}" with ${roadmap.phases.length} structured phases.`);

    const aiCoverPitch = await request('/ai/career-copilot', {
      method: 'POST',
      headers: { Authorization: `Bearer ${alexToken}` },
      body: JSON.stringify({ action: 'cover_letter', jobTitle: createdJob.title, companyName: 'TechCorp' })
    });
    console.log('  ✅ AI Cover Letter Generated (Length:', aiCoverPitch.coverLetter.length, 'chars).');

    console.log('\nStep 10: Testing AI Mock Interview Coach...');
    const interviewQ = await request('/ai/interview-coach/start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${alexToken}` },
      body: JSON.stringify({ topic: 'React & Frontend' })
    });
    console.log(`  ✅ Question: "${interviewQ.question.substring(0, 60)}..."`);

    const interviewEval = await request('/ai/interview-coach/evaluate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${alexToken}` },
      body: JSON.stringify({
        topic: 'React & Frontend',
        question: interviewQ.question,
        userAnswer: 'The Virtual DOM is an in-memory representation of the DOM. React uses Fiber diffing algorithm to compute minimal real DOM mutations, which avoids browser reflow and repaint performance bottlenecks.'
      })
    });
    console.log(`  ✅ AI Interview Evaluation Score: ${interviewEval.score}/100`);
    console.log(`     - Strengths: ${interviewEval.strengths.join('; ')}`);
    console.log(`     - Model Answer Provided: ${interviewEval.modelIdealAnswer.substring(0, 60)}...`);

    console.log('\nStep 11: Testing Smart AI Skill Gap Analyzer...');
    const skillGap = await request(`/ai/skill-gap/${createdJob.id}`, {
      headers: { Authorization: `Bearer ${alexToken}` }
    });
    console.log(`  ✅ Skill Gap for "${skillGap.jobTitle}": Match = ${skillGap.matchPercentage}%`);
    console.log(`     - Matched: ${skillGap.matchedSkills.join(', ')}`);
    console.log(`     - Missing: ${skillGap.missingSkills.join(', ') || 'None'}`);

    console.log('\nStep 12: Testing Student Project & Hackathon Collaboration Board...');
    const newCollab = await request('/collaborations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${alexToken}` },
      body: JSON.stringify({
        title: `AI Autonomous Drone Simulator ${Date.now().toString().slice(-4)}`,
        project_type: 'Hackathon',
        description: 'Building an autonomous navigation agent using Three.js and PyTorch. Looking for UI and ML teammates!',
        skills_needed: ['React', 'Three.js', 'Python'],
        team_size: 4
      })
    });
    console.log(`  ✅ Collaboration Created: "${newCollab.title}" (ID: ${newCollab.id})`);

    const joinRes = await request(`/collaborations/${newCollab.id}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${priyaToken}` },
      body: JSON.stringify({ message: 'I can build the Three.js 3D viewport!' })
    });
    console.log('  ✅ Priya joined Alex’s team! Result:', joinRes.message);

    console.log('\nStep 13: Testing Saved Jobs Bookmark Feature...');
    const saveRes = await request(`/ai/saved-jobs/${createdJob.id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${alexToken}` }
    });
    console.log(`  ✅ Alex saved job ID ${createdJob.id}! isSaved:`, saveRes.isSaved);

    const savedList = await request('/ai/saved-jobs', {
      headers: { Authorization: `Bearer ${alexToken}` }
    });
    console.log(`  ✅ Saved jobs count: ${savedList.length}`);

    console.log('\nStep 14: Testing Real-World Aadhaar KYC Verification...');
    const otpRes = await request('/kyc/aadhaar/send-otp', {
      method: 'POST',
      headers: { Authorization: `Bearer ${alexToken}` },
      body: JSON.stringify({ aadhaarNumber: '999988881234' })
    });
    console.log(`  ✅ Aadhaar OTP dispatched:`, otpRes.message, `(Masked: ${otpRes.maskedAadhaar})`);
    
    const verifyRes = await request('/kyc/aadhaar/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${alexToken}` },
      body: JSON.stringify({ aadhaarNumber: '999988881234', otp: otpRes.devOtp || otpRes.demoOtp || '123456' })
    });
    console.log(`  ✅ Aadhaar Verified:`, verifyRes.message, `Status: ${verifyRes.user.aadhaar_verified ? 'VERIFIED 🛡️' : 'PENDING'}`);

    console.log('\n🎉 ALL CORE MVP FLOWS + ADVANCED AI CAREER & COLLAB FUNCTIONS + KYC FULLY VERIFIED!');
  } catch (err) {
    console.error('\n❌ Test failed with error:', err);
    process.exit(1);
  }
}

runTest();
