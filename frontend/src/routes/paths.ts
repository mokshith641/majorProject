export const PATHS = {
  // Public
  LANDING: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',

  // Protected User Space
  DASHBOARD: '/dashboard',
  CREATE_MEETING: '/meetings/create',
  LIVE_MEETING: '/meetings/:id/live',
  MEETING_DETAILS: '/meetings/:id',
  MEETING_HISTORY: '/meetings/history',
  ANALYTICS: '/analytics',
  REPORTS: '/reports',
  SEARCH: '/search',
  SETTINGS: '/settings',
  PROFILE: '/profile',
  NOTIFICATIONS: '/notifications',

  // Protected Admin Space
  ADMIN_DASHBOARD: '/admin/dashboard',
};
