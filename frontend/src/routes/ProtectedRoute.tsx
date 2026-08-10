import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PATHS } from './paths';

interface ProtectedRouteProps {
  children: React.ReactElement;
  requireAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#090D16]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login while saving target path location context
    return <Navigate to={PATHS.LOGIN} state={{ from: location }} replace />;
  }

  if (requireAdmin && user?.role !== 'admin') {
    // Regular users accessing Admin space get sent to user Dashboard
    return <Navigate to={PATHS.DASHBOARD} replace />;
  }

  return children;
};
