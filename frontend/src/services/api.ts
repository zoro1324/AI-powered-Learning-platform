import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import {
  User,
  LearningProfile,
  Course,
  Module,
  Lesson,
  Resource,
  Enrollment,
  Question,
  QuizAttempt,
  QuizAnswer,
  ModuleProgress,
  LearningRoadmap,
  Achievement,
  UserAchievement,
  ActivityLog,
  DashboardData,
  LoginCredentials,
  RegisterData,
  AuthResponse,
  PaginatedResponse,
} from '../types/api';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${api.defaults.baseURL}/auth/token/refresh/`, {
            refresh: refreshToken,
          });

          const { access } = response.data;
          localStorage.setItem('access_token', access);

          // Retry original request with new token
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${access}`;
          }
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed - clear tokens and redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// ============================================================================
// AUTHENTICATION API
// ============================================================================

export const authAPI = {
  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/register/', data);
    return response.data;
  },

  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login/', credentials);
    return response.data;
  },

  logout: async (refreshToken: string): Promise<void> => {
    await api.post('/auth/logout/', { refresh: refreshToken });
  },

  refreshToken: async (refreshToken: string): Promise<{ access: string }> => {
    const response = await api.post<{ access: string }>('/auth/token/refresh/', {
      refresh: refreshToken,
    });
    return response.data;
  },
};

// ============================================================================
// USER API
// ============================================================================

export const userAPI = {
  getProfile: async (): Promise<User> => {
    const response = await api.get<User>('/users/me/');
    return response.data;
  },

  updateProfile: async (data: Partial<User>): Promise<User> => {
    const response = await api.patch<User>('/users/me/', data);
    return response.data;
  },

  getLearningProfile: async (): Promise<LearningProfile> => {
    const response = await api.get<LearningProfile>('/users/me/learning-profile/');
    return response.data;
  },

  updateLearningProfile: async (data: Partial<LearningProfile>): Promise<LearningProfile> => {
    const response = await api.patch<LearningProfile>('/users/me/learning-profile/', data);
    return response.data;
  },
};

// ============================================================================
// COURSE API
// ============================================================================

export const courseAPI = {
  list: async (params?: any): Promise<PaginatedResponse<Course>> => {
    const response = await api.get<PaginatedResponse<Course>>('/courses/', { params });
    return response.data;
  },

  get: async (id: number): Promise<Course> => {
    const response = await api.get<Course>(`/courses/${id}/`);
    return response.data;
  },

  getModules: async (courseId: number): Promise<Module[]> => {
    const response = await api.get<Module[]>(`/courses/${courseId}/modules/`);
    return response.data;
  },

  create: async (data: Partial<Course>): Promise<Course> => {
    const response = await api.post<Course>('/courses/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<Course>): Promise<Course> => {
    const response = await api.patch<Course>(`/courses/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/courses/${id}/`);
  },
};

// ============================================================================
// MODULE API
// ============================================================================

export const moduleAPI = {
  list: async (params?: any): Promise<PaginatedResponse<Module>> => {
    const response = await api.get<PaginatedResponse<Module>>('/modules/', { params });
    return response.data;
  },

  get: async (id: number): Promise<Module> => {
    const response = await api.get<Module>(`/modules/${id}/`);
    return response.data;
  },

  getLessons: async (moduleId: number): Promise<Lesson[]> => {
    const response = await api.get<Lesson[]>(`/modules/${moduleId}/lessons/`);
    return response.data;
  },
};

// ============================================================================
// LESSON API
// ============================================================================

export const lessonAPI = {
  list: async (params?: any): Promise<PaginatedResponse<Lesson>> => {
    const response = await api.get<PaginatedResponse<Lesson>>('/lessons/', { params });
    return response.data;
  },

  get: async (id: number): Promise<Lesson> => {
    const response = await api.get<Lesson>(`/lessons/${id}/`);
    return response.data;
  },

  getResources: async (lessonId: number): Promise<Resource[]> => {
    const response = await api.get<Resource[]>(`/lessons/${lessonId}/resources/`);
    return response.data;
  },
};

// ============================================================================
// ENROLLMENT API
// ============================================================================

export const enrollmentAPI = {
  list: async (params?: any): Promise<PaginatedResponse<Enrollment>> => {
    const response = await api.get<PaginatedResponse<Enrollment>>('/enrollments/', { params });
    return response.data;
  },

  get: async (id: number): Promise<Enrollment> => {
    const response = await api.get<Enrollment>(`/enrollments/${id}/`);
    return response.data;
  },

  create: async (data: { course_id: number; learning_goals?: string }): Promise<Enrollment> => {
    const response = await api.post<Enrollment>('/enrollments/', data);
    return response.data;
  },

  getProgress: async (id: number): Promise<any> => {
    const response = await api.get(`/enrollments/${id}/progress/`);
    return response.data;
  },

  startDiagnosticQuiz: async (id: number): Promise<{ attempt_id: string; questions: Question[] }> => {
    const response = await api.post(`/enrollments/${id}/diagnostic_quiz/`);
    return response.data;
  },
};

// ============================================================================
// QUIZ API
// ============================================================================

export const quizAPI = {
  getQuestions: async (params?: any): Promise<PaginatedResponse<Question>> => {
    const response = await api.get<PaginatedResponse<Question>>('/questions/', { params });
    return response.data;
  },

  getAttempt: async (id: string): Promise<QuizAttempt> => {
    const response = await api.get<QuizAttempt>(`/quiz-attempts/${id}/`);
    return response.data;
  },

  submitQuiz: async (data: {
    attempt_id: string;
    answers: Array<{ question_id: number; selected_option: string }>;
  }): Promise<{
    score: number;
    correct_answers: number;
    total_questions: number;
    quiz_attempt: QuizAttempt;
  }> => {
    const response = await api.post('/quiz-attempts/submit/', data);
    return response.data;
  },

  getAnswers: async (attemptId: string): Promise<QuizAnswer[]> => {
    const response = await api.get<PaginatedResponse<QuizAnswer>>('/quiz-answers/', {
      params: { quiz_attempt: attemptId },
    });
    return response.data.results;
  },
};

// ============================================================================
// PROGRESS API
// ============================================================================

export const progressAPI = {
  getModuleProgress: async (params?: any): Promise<PaginatedResponse<ModuleProgress>> => {
    const response = await api.get<PaginatedResponse<ModuleProgress>>('/module-progress/', {
      params,
    });
    return response.data;
  },

  updateModuleProgress: async (
    id: number,
    data: Partial<ModuleProgress>
  ): Promise<ModuleProgress> => {
    const response = await api.patch<ModuleProgress>(`/module-progress/${id}/`, data);
    return response.data;
  },
};

// ============================================================================
// ROADMAP API
// ============================================================================

export const roadmapAPI = {
  list: async (params?: any): Promise<PaginatedResponse<LearningRoadmap>> => {
    const response = await api.get<PaginatedResponse<LearningRoadmap>>('/learning-roadmaps/', {
      params,
    });
    return response.data;
  },

  get: async (id: number): Promise<LearningRoadmap> => {
    const response = await api.get<LearningRoadmap>(`/learning-roadmaps/${id}/`);
    return response.data;
  },

  generate: async (enrollmentId: number): Promise<LearningRoadmap> => {
    const response = await api.post<LearningRoadmap>('/learning-roadmaps/generate/', {
      enrollment_id: enrollmentId,
    });
    return response.data;
  },
};

// ============================================================================
// ACHIEVEMENT API
// ============================================================================

export const achievementAPI = {
  list: async (params?: any): Promise<PaginatedResponse<Achievement>> => {
    const response = await api.get<PaginatedResponse<Achievement>>('/achievements/', { params });
    return response.data;
  },

  getUserAchievements: async (params?: any): Promise<PaginatedResponse<UserAchievement>> => {
    const response = await api.get<PaginatedResponse<UserAchievement>>('/user-achievements/', {
      params,
    });
    return response.data;
  },
};

// ============================================================================
// ACTIVITY LOG API
// ============================================================================

export const activityAPI = {
  list: async (params?: any): Promise<PaginatedResponse<ActivityLog>> => {
    const response = await api.get<PaginatedResponse<ActivityLog>>('/activity-logs/', { params });
    return response.data;
  },
};

// ============================================================================
// DASHBOARD API
// ============================================================================

export const dashboardAPI = {
  get: async (): Promise<DashboardData> => {
    const response = await api.get<DashboardData>('/dashboard/');
    return response.data;
  },
};

// ============================================================================
// VIDEO GENERATION API
// ============================================================================

export const videoAPI = {
  generate: async (data: { topic: string; lesson_id?: number }): Promise<any> => {
    const response = await api.post('/videos/generate/', data);
    return response.data;
  },

  getStatus: async (taskId: string): Promise<any> => {
    const response = await api.get(`/videos/status/${taskId}/`);
    return response.data;
  },
};

export default api;
