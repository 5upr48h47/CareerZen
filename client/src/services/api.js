const API_BASE = '/api';

// Build a query string from optional params.
// URLSearchParams serializes undefined/null into the literal strings
// "undefined"/"null", which backends then treat as real filter values and
// match zero rows. Drop empty entries so an unfiltered list stays unfiltered.
function buildQuery(params = {}) {
  const clean = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ''
  );
  const queryStr = new URLSearchParams(clean).toString();
  return queryStr ? `?${queryStr}` : '';
}

function getHeaders() {
  const token = localStorage.getItem('careerzen_token');
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, config);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || data.message || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg);
    // Keep the server's diagnostic detail so callers can surface the real cause.
    if (data.details) err.details = data.details;
    throw err;
  }

  return data;
}

export const api = {
  // Auth
  register: (body) => request('/register', { method: 'POST', body }),
  login: (body) => request('/login', { method: 'POST', body }),
  getMe: () => request('/me'),

  // Google OAuth
  googleAuth: (body) => request('/auth/google', { method: 'POST', body }),

  // Aadhaar & Student KYC Verification
  sendAadhaarOtp: (body) => request('/kyc/aadhaar/send-otp', { method: 'POST', body }),
  verifyAadhaar: (body) => request('/kyc/aadhaar/verify', { method: 'POST', body }),
  uploadStudentId: (body) => request('/kyc/student-id/upload', { method: 'POST', body }),
  enrollBiometric: (body) => request('/kyc/biometric/enroll', { method: 'POST', body }),
  getBiometricStatus: () => request('/kyc/biometric/status'),
  biometricLogin: (body) => request('/auth/biometric/login', { method: 'POST', body }),



  // Admin
  getAdminOverview: () => request('/admin/overview'),
  getAdminUsers: (params = {}) => request(`/admin/users${buildQuery(params)}`),
  updateAdminUser: (id, body) => request(`/admin/users/${id}`, { method: 'PATCH', body }),
  getAdminJobs: () => request('/admin/jobs'),
  updateAdminJob: (id, body) => request(`/admin/jobs/${id}`, { method: 'PATCH', body }),
  getAdminApplications: () => request('/admin/applications'),
  updateAdminApplication: (id, body) => request(`/admin/applications/${id}`, { method: 'PATCH', body }),
  getAdminPosts: () => request('/admin/posts'),
  deleteAdminPost: (id) => request(`/admin/posts/${id}`, { method: 'DELETE' }),
  getAdminAuditLogs: () => request('/admin/audit-logs'),
  getAdminSystem: () => request('/admin/system'),
  adminSsoUrl: () => `${API_BASE}/auth/admin-sso`,

  // Profiles & Users
  getProfile: (idOrUsername) => request(`/users/${idOrUsername}`),
  updateProfile: (body) => request('/profile', { method: 'PUT', body }),
  uploadAvatar: (formData) => {
    const token = localStorage.getItem('careerzen_token');
    return fetch('/api/upload/avatar', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    }).then(r => r.json());
  },
  uploadBanner: (formData) => {
    const token = localStorage.getItem('careerzen_token');
    return fetch('/api/upload/banner', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    }).then(r => r.json());
  },
  uploadPostMedia: (formData) => {
    const token = localStorage.getItem('careerzen_token');
    return fetch('/api/posts/upload-media', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    }).then(r => r.json());
  },
  addSkill: (body) => request('/skills', { method: 'POST', body }),
  deleteSkill: (id) => request(`/skills/${id}`, { method: 'DELETE' }),

  // Posts & Feed
  getFeedTopics: () => request('/feed-topics'),
  getPosts: (params = {}) => request(`/posts${buildQuery(params)}`),
  createPost: (body) => request('/posts', { method: 'POST', body }),
  escalateApplication: (id) => request(`/applications/${id}/escalate`, { method: 'POST' }),
  flagJobPremium: (id) => request(`/jobs/${id}/premium`, { method: 'POST' }),
  toggleLike: (postId) => request(`/posts/${postId}/like`, { method: 'POST' }),
  getComments: (postId) => request(`/posts/${postId}/comments`),
  addComment: (postId, body) => request(`/posts/${postId}/comments`, { method: 'POST', body }),
  deletePost: (postId) => request(`/posts/${postId}`, { method: 'DELETE' }),
  updatePost: (postId, body) => request(`/posts/${postId}`, { method: 'PUT', body }),

  // Connections
  getConnections: () => request('/connections'),
  getSuggestions: () => request('/connections/suggestions'),
  sendConnectionRequest: (targetUserId) => request('/connections/request', { method: 'POST', body: { targetUserId } }),
  acceptConnection: (requestId) => request(`/connections/${requestId}/accept`, { method: 'POST' }),
  rejectConnection: (requestId) => request(`/connections/${requestId}/reject`, { method: 'POST' }),
  removeConnection: (targetUserId) => request(`/connections/${targetUserId}`, { method: 'DELETE' }),
  removeConnectionRequest: (targetUserId) => request(`/connections/request/${targetUserId}`, { method: 'DELETE' }),

  // Jobs
  getJobs: (params = {}) => request(`/jobs${buildQuery(params)}`),
  getJob: (id) => request(`/jobs/${id}`),
  createJob: (body) => request('/jobs', { method: 'POST', body }),
  updateCompany: (body) => request('/companies', { method: 'POST', body }),
  uploadCompanyLogo: (formData) => {
    const token = localStorage.getItem('careerzen_token');
    return fetch('/api/companies/upload-logo', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    }).then((r) => r.json());
  },
  getRecruiterDashboard: () => request('/recruiter/dashboard'),

  // Search
  searchJobs: (params = {}) => request(`/search/jobs${buildQuery(params)}`),
  searchProfiles: (params = {}) => request(`/search/profiles${buildQuery(params)}`),
  searchPosts: (params = {}) => request(`/search/posts${buildQuery(params)}`),

  // Payments & Packages
  getPackages: () => request('/packages'),
  createPaymentOrder: (body) => request('/payment/create-order', { method: 'POST', body }),
  verifyPayment: (body) => request('/payment/verify', { method: 'POST', body }),
  getPaymentHistory: () => request('/payment/history'),
  getSubscription: () => request('/payment/subscription'),
  processWebhook: (body) => request('/payment/webhook', { method: 'POST', body }),

  // Premium Features
  getPremiumFeaturesByPlan: (plan) => request(`/premium/features/${plan}`),
  getMyPremium: () => request('/premium/me'),
  upgradePremium: (body) => request('/premium/upgrade', { method: 'POST', body }),
  createAdminPackage: (body) => request('/admin/packages', { method: 'POST', body }),
  updateAdminPackage: (id, body) => request(`/admin/packages/${id}`, { method: 'PUT', body }),
  deleteAdminPackage: (id) => request(`/admin/packages/${id}`, { method: 'DELETE', body }),

  // Feed Topics (Student & Fresher Topics)
  getAdminFeedTopics: () => request('/admin/feed-topics'),
  createAdminFeedTopic: (body) => request('/admin/feed-topics', { method: 'POST', body }),
  updateAdminFeedTopic: (id, body) => request(`/admin/feed-topics/${id}`, { method: 'PUT', body }),
  deleteAdminFeedTopic: (id) => request(`/admin/feed-topics/${id}`, { method: 'DELETE', body }),

  getAdminPremiumPlans: () => request('/admin/premium-plans'),
  updateAdminPremiumPlans: (body) => request('/admin/premium-plans', { method: 'PUT', body }),
  getAdminPremiumSubscriptions: () => request('/admin/premium-subscriptions'),
  adminPremiumAction: (userId, body) => request(`/admin/premium-subscriptions/${userId}`, { method: 'POST', body }),
  getPremiumFeatures: () => request('/admin/premium-features'),
  createPremiumFeature: (body) => request('/admin/premium-features', { method: 'POST', body }),
  updatePremiumFeature: (id, body) => request(`/admin/premium-features/${id}`, { method: 'PUT', body }),
  getPaymentSettings: () => request('/admin/payment-settings'),
  // Multipart upload — must NOT set Content-Type, the browser adds the boundary
  updatePaymentSettings: (formData) => {
    const token = localStorage.getItem('careerzen_token');
    return fetch('/api/admin/payment-settings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    }).then((r) => r.json());
  },
  getPaymentRequests: () => request('/admin/payment-requests'),
  getAdminPaymentOptions: () => request('/admin/payment-options'),
  createAdminPaymentOption: (formData) => {
    const token = localStorage.getItem('careerzen_token');
    return fetch('/api/admin/payment-options', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    }).then((r) => r.json());
  },
  updateAdminPaymentOption: (id, formData) => {
    const token = localStorage.getItem('careerzen_token');
    return fetch(`/api/admin/payment-options/${id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    }).then((r) => r.json());
  },
  deleteAdminPaymentOption: (id) => request(`/admin/payment-options/${id}`, { method: 'DELETE' }),
  verifyPaymentRequest: (id, body) => request(`/admin/payment-requests/${id}/verify`, { method: 'POST', body }),
  getPaymentInfo: () => request('/premium/payment-info'),
  getPaymentOptions: () => request('/premium/payment-options'),
  submitPaymentProof: (body) => request('/premium/submit-proof', { method: 'POST', body }),
  uploadPaymentProof: (formData) => {
    const token = localStorage.getItem('careerzen_token');
    return fetch('/api/premium/upload-proof', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    }).then((r) => r.json());
  },
  getCoupons: () => request('/admin/coupons'),
  createCoupon: (body) => request('/admin/coupons', { method: 'POST', body }),
  updateCoupon: (id, body) => request(`/admin/coupons/${id}`, { method: 'PUT', body }),
  deleteCoupon: (id) => request(`/admin/coupons/${id}`, { method: 'DELETE' }),
  applyCoupon: (body) => request('/coupons/apply', { method: 'POST', body }),
  cancelPremium: () => request('/premium/cancel', { method: 'POST' }),

  // Analytics
  getAnalyticsDashboard: () => request('/analytics/dashboard'),
  getAnalyticsSystem: () => request('/analytics/system'),
  getAnalyticsReports: (params = {}) => request(`/analytics/reports${buildQuery(params)}`),

  // Applications
  applyToJob: (body) => request('/applications', { method: 'POST', body }),
  getMyApplications: () => request('/applications/my'),
  getJobApplicants: (jobId) => request(`/applications/job/${jobId}`),
  updateApplicationStatus: (appId, status) => request(`/applications/${appId}/status`, { method: 'PUT', body: { status } }),
  uploadResume: (formData) => {
    const token = localStorage.getItem('careerzen_token');
    return fetch('/api/applications/upload-resume', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    }).then((r) => r.json());
  },

  // Messages
  getConversations: () => request('/conversations'),
  getMessages: (otherUserId) => request(`/conversations/${otherUserId}/messages`),
  sendMessage: (body) => request('/messages', { method: 'POST', body }),

  // Notifications
  getNotifications: () => request('/notifications'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'PUT' }),
  getUnreadNotificationsCount: () => request('/notifications/unread-count'),

  // AI Career Hub & Intelligence
  analyzeResume: (body) => request('/ai/resume-analyzer', { method: 'POST', body }),
  careerCopilot: (body) => request('/ai/career-copilot', { method: 'POST', body }),
  startInterview: (body) => request('/ai/interview-coach/start', { method: 'POST', body }),
  evaluateInterview: (body) => request('/ai/interview-coach/evaluate', { method: 'POST', body }),
  getSkillGap: (jobId) => request(`/ai/skill-gap/${jobId}`),
  getSavedJobs: () => request('/ai/saved-jobs'),
  toggleSaveJob: (jobId) => request(`/ai/saved-jobs/${jobId}`, { method: 'POST' }),

  // Student Project & Hackathon Collaborations
  getCollaborations: (params = {}) => request(`/collaborations${buildQuery(params)}`),
  createCollaboration: (body) => request('/collaborations', { method: 'POST', body }),
  joinCollaboration: (id, body) => request(`/collaborations/${id}/join`, { method: 'POST', body }),
  getMyCollaborations: () => request('/collaborations/my'),
  getCollaborationMembers: (id) => request(`/collaborations/${id}/members`),
  manageCollaborationMember: (id, userId, action) =>
    request(`/collaborations/${id}/members/${userId}`, { method: 'PUT', body: { action } }),
};
