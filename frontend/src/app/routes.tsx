import { createBrowserRouter, Navigate } from 'react-router';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import DashboardPage from './pages/DashboardPage';
import CourseEntryPage from './pages/CourseEntryPage';
import ProgressPage from './pages/ProgressPage';
import ModulesPage from './pages/ModulesPage';
import SettingsPage from './pages/SettingsPage';
import LearningPreferencePage from './pages/LearningPreferencePage';
import AssessmentPage from './pages/AssessmentPage';
import LearningPathPage from './pages/LearningPathPage';
import FinalQuizPage from './pages/FinalQuizPage';

// Note: Protected routes are handled by checking localStorage in each component
// Alternatively, use a layout wrapper with auth checking

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/login',
    Component: LoginPage,
  },
  {
    path: '/signup',
    Component: SignUpPage,
  },
  {
    path: '/forgot-password',
    Component: ForgotPasswordPage,
  },
  {
    path: '/dashboard',
    Component: DashboardPage,
  },
  {
    path: '/course-entry',
    Component: CourseEntryPage,
  },
  {
    path: '/progress',
    Component: ProgressPage,
  },
  {
    path: '/modules',
    Component: ModulesPage,
  },
  {
    path: '/settings',
    Component: SettingsPage,
  },
  {
    path: '/learning-preference',
    Component: LearningPreferencePage,
  },
  {
    path: '/assessment',
    Component: AssessmentPage,
  },
  {
    path: '/learning-path',
    Component: LearningPathPage,
  },
  {
    path: '/final-quiz',
    Component: FinalQuizPage,
  },
]);
