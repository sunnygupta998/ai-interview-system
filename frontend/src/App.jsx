import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

// Public Pages
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';

// Candidate Pages
import CandidateDashboard from './pages/candidate/Dashboard';
import UploadResume from './pages/candidate/UploadResume';
import TakeTest from './pages/candidate/TakeTest';
import ViewResults from './pages/candidate/ViewResults';
import LiveInterview from './pages/candidate/LiveInterview';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import AllResults from './pages/admin/AllResults';
import Settings from './pages/admin/Settings';

// Helper Redirect Component for / path
const RootRedirect = () => {
  const { user, token } = useAuth();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  } else {
    return <Navigate to="/candidate/dashboard" replace />;
  }
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Navbar />
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          
          {/* Candidate protected routes */}
          <Route 
            path="/candidate/dashboard" 
            element={
              <ProtectedRoute allowedRoles={['candidate']}>
                <CandidateDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/candidate/upload" 
            element={
              <ProtectedRoute allowedRoles={['candidate']}>
                <UploadResume />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/candidate/test/:id" 
            element={
              <ProtectedRoute allowedRoles={['candidate']}>
                <TakeTest />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/candidate/interview/:id" 
            element={
              <ProtectedRoute allowedRoles={['candidate']}>
                <LiveInterview />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/candidate/interview/practice/:id" 
            element={
              <ProtectedRoute allowedRoles={['candidate']}>
                <LiveInterview />
              </ProtectedRoute>
            } 
          />
          
          {/* Result view is shared: Candidate views their own, Admin views any */}
          <Route 
            path="/candidate/results/:id" 
            element={
              <ProtectedRoute allowedRoles={['candidate', 'admin']}>
                <ViewResults />
              </ProtectedRoute>
            } 
          />

          {/* Admin protected routes */}
          <Route 
            path="/admin/dashboard" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/results" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AllResults />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/settings" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Settings />
              </ProtectedRoute>
            } 
          />

          {/* Catch-all redirects */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
