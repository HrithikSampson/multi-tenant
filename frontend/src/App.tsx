import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import WorkspaceSelection from './pages/WorkspaceSelection';
import Projects from './pages/Projects';
import ProjectTasks from './pages/ProjectTasks';

const AppRoutes: React.FC = () => {
  const { isAuthenticated, organizationId } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to="/workspace" replace /> : <Login />} 
      />
      <Route 
        path="/register" 
        element={isAuthenticated ? <Navigate to="/workspace" replace /> : <Register />} 
      />
      
      {/* Protected routes */}
      <Route
        path="/workspace"
        element={
          <ProtectedRoute>
            {organizationId ? <Navigate to="/projects" replace /> : <WorkspaceSelection />}
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            {!organizationId ? <Navigate to="/workspace" replace /> : <Projects />}
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/projects/:projectId/tasks"
        element={
          <ProtectedRoute>
            {!organizationId ? <Navigate to="/workspace" replace /> : <ProjectTasks />}
          </ProtectedRoute>
        }
      />
      
      {/* Default redirect */}
      <Route 
        path="/" 
        element={<Navigate to={isAuthenticated ? "/workspace" : "/login"} replace />} 
      />
      
      {/* Catch all */}
      <Route 
        path="*" 
        element={<Navigate to={isAuthenticated ? "/workspace" : "/login"} replace />} 
      />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <AppRoutes />
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;
