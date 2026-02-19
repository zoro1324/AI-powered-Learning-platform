// TypeScript interfaces matching backend models

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  avatar?: string;
  bio?: string;
  total_study_time: number;
  streak_days: number;
  date_joined: string;
  learning_profile?: LearningProfile;
}

export interface LearningProfile {
  id: number;
  user: number;
  learning_style: 'visual' | 'auditory' | 'reading_writing' | 'kinesthetic';
  preferred_depth: 'beginner' | 'intermediate' | 'advanced';
  learning_pace: 'slow' | 'moderate' | 'fast';
  daily_study_time?: number;
  preferred_content_types: string[];
  focus_areas: string[];
}

export interface Course {
  id: number;
  name: string;  // Backward compatibility
  title: string;
  description: string;
  category: 'web_dev' | 'data_science' | 'ai_ml' | 'mobile_dev' | 'cloud' | 'design' | 'devops' | 'cybersecurity' | 'blockchain' | 'other';
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  estimated_duration: number;
  thumbnail?: string;
  is_popular?: boolean;
  created_at: string;
  updated_at: string;
  modules?: Module[];
  modules_count?: number;
  enrolled_count?: number;
}

export interface Module {
  id: number;
  course: number;
  title: string;
  description: string;
  order: number;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  estimated_duration: number;
  lessons?: Lesson[];
  lessons_count?: number;
}

export interface Lesson {
  id: number;
  module: number;
  title: string;
  description: string;
  content: string;
  order: number;
  duration_minutes: number;
  resources?: Resource[];
}

export interface Resource {
  id: number;
  lesson: number;
  title: string;
  resource_type: 'video' | 'pdf' | 'quiz' | 'mindmap' | 'notes' | 'audio' | 'image' | 'reel' | 'video_script' | 'ppt' | 'external_link';
  file?: string;
  file_url?: string;
  content_text?: string;
  content_json?: any;
  external_url?: string;
  description?: string;
  duration_seconds?: number;
  is_generated?: boolean;
  created_at: string;
}

export interface Enrollment {
  id: number;
  user: number;
  course: Course;
  status: 'active' | 'completed' | 'paused';
  enrolled_at: string;
  completed_at?: string;
  overall_progress: number;
  learning_goals?: string;
}

export interface Question {
  id: number;
  course?: number;
  module?: number;
  question_type: 'diagnostic' | 'topic_quiz' | 'final_quiz';
  question_text: string;
  options: { [key: string]: string };
  correct_option: string;
  explanation?: string;
  difficulty_level: 'easy' | 'medium' | 'hard';
  created_at: string;
}

export interface QuizAttempt {
  id: string;
  user: number;
  enrollment?: number;
  quiz_type: 'diagnostic' | 'topic_quiz' | 'final_quiz';
  started_at: string;
  submitted_at?: string;
  score?: number;
  total_questions?: number;
  questions?: Question[];
  answers?: QuizAnswer[];
}

export interface QuizAnswer {
  id: number;
  quiz_attempt: string;
  question: number;
  selected_option: string;
  is_correct: boolean;
}

export interface ModuleProgress {
  id: number;
  enrollment: number;
  module: Module;
  status: 'not_started' | 'in_progress' | 'completed';
  progress_percentage: number;
  started_at?: string;
  completed_at?: string;
  last_accessed_lesson?: number;
}

export interface LearningRoadmap {
  id: number;
  enrollment: Enrollment;
  personalization_factors: { [key: string]: any };
  recommended_modules: Module[];
  ai_recommendations?: string;
  generated_at: string;
}

export interface Achievement {
  id: number;
  name: string;
  description: string;
  icon: string;
  category: 'completion' | 'streak' | 'mastery' | 'engagement';
  criteria: { [key: string]: any };
}

export interface UserAchievement {
  id: number;
  user: number;
  achievement: Achievement;
  earned_at: string;
  progress?: number;
}

export interface ActivityLog {
  id: number;
  user: number;
  activity_type: string;
  description: string;
  timestamp: string;
  related_course?: number;
  related_module?: number;
  related_lesson?: number;
}

export interface DashboardData {
  user: User;
  stats: {
    total_courses: number;
    active_courses: number;
    completed_courses: number;
    average_progress: number;
    study_time_hours: number;
    streak_days: number;
    achievements_earned: number;
  };
  recent_activities: ActivityLog[];
  active_enrollments: Enrollment[];
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  password2: string;
  first_name: string;
  last_name: string;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface ApiError {
  detail?: string;
  [key: string]: any;
}

// Pagination
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Course Planning Task
export interface CoursePlanningTask {
  id: string;
  course_title: string;
  course_description: string;
  category: Course['category'];
  difficulty_level: Course['difficulty_level'];
  estimated_duration: number;
  thumbnail: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress_message: string;
  result_data: {
    is_broad: boolean;
    total_courses: number;
    courses: Array<{
      course_name: string;
      description: string;
      difficulty: string;
      prerequisites: string[];
    }>;
  } | null;
  created_courses: string[] | null;
  error_message: string;
  created_at: string;
  completed_at: string | null;
}
