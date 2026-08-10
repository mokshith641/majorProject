import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PATHS } from './paths';
import { ProtectedRoute } from './ProtectedRoute';

// Layouts
import { GuestLayout } from '../layouts/GuestLayout';
import { AuthLayout } from '../layouts/AuthLayout';

// Pages
import { Landing } from '../pages/Landing';
import { Login } from '../pages/Login';
import { Register } from '../pages/Register';
import { ForgotPassword } from '../pages/ForgotPassword';
import { ResetPassword } from '../pages/ResetPassword';
import { Dashboard } from '../pages/Dashboard';
import { CreateMeeting } from '../pages/CreateMeeting';
import { LiveMeeting } from '../pages/LiveMeeting';
import { MeetingDetails } from '../pages/MeetingDetails';
import { MeetingHistory } from '../pages/MeetingHistory';
import { Analytics } from '../pages/Analytics';
import { Settings } from '../pages/Settings';
import { UserProfile } from '../pages/UserProfile';
import { AdminDashboard } from '../pages/AdminDashboard';
import { NotFound } from '../pages/NotFound';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* 1. Public Guest Pages */}
      <Route element={<GuestLayout />}>
        <Route path={PATHS.LANDING} element={<Landing />} />
        <Route path={PATHS.LOGIN} element={<Login />} />
        <Route path={PATHS.REGISTER} element={<Register />} />
        <Route path={PATHS.FORGOT_PASSWORD} element={<ForgotPassword />} />
        <Route path={PATHS.RESET_PASSWORD} element={<ResetPassword />} />
      </Route>

      {/* 2. Protected User Pages */}
      <Route
        element={
          <ProtectedRoute>
            <AuthLayout />
          </ProtectedRoute>
        }
      >
        <Route path={PATHS.DASHBOARD} element={<Dashboard />} />
        <Route path={PATHS.CREATE_MEETING} element={<CreateMeeting />} />
        <Route path={PATHS.LIVE_MEETING} element={<LiveMeeting />} />
        <Route path={PATHS.MEETING_DETAILS} element={<MeetingDetails />} />
        <Route path={PATHS.MEETING_HISTORY} element={<MeetingHistory />} />
        <Route path={PATHS.ANALYTICS} element={<Analytics />} />
        <Route path={PATHS.SETTINGS} element={<Settings />} />
        <Route path={PATHS.PROFILE} element={<UserProfile />} />
        
        {/* Reports route fallback/links redirecting to History archive */}
        <Route path="/reports" element={<Navigate to={PATHS.MEETING_HISTORY} replace />} />
      </Route>

      {/* 3. Protected Admin Pages */}
      <Route
        element={
          <ProtectedRoute requireAdmin={true}>
            <AuthLayout />
          </ProtectedRoute>
        }
      >
        <Route path={PATHS.ADMIN_DASHBOARD} element={<AdminDashboard />} />
      </Route>

      {/* 4. Fallback 404 Route */}
      <Route element={<GuestLayout />}>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
};
