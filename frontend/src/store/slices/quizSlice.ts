import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { quizAPI, enrollmentAPI, roadmapAPI } from '../../services/api';
import { Question, QuizAttempt, LearningRoadmap } from '../../types/api';

interface QuizState {
  questions: Question[];
  currentAttempt: QuizAttempt | null;
  userAnswers: { [questionId: number]: string };
  roadmap: LearningRoadmap | null;
  loading: boolean;
  error: string | null;
  submitting: boolean;
}

const initialState: QuizState = {
  questions: [],
  currentAttempt: null,
  userAnswers: {},
  roadmap: null,
  loading: false,
  error: null,
  submitting: false,
};

// Async thunks
export const startDiagnosticQuiz = createAsyncThunk(
  'quiz/startDiagnosticQuiz',
  async (enrollmentId: number, { rejectWithValue }) => {
    try {
      const response = await enrollmentAPI.startDiagnosticQuiz(enrollmentId);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to start quiz');
    }
  }
);

export const fetchQuestions = createAsyncThunk(
  'quiz/fetchQuestions',
  async (params: any, { rejectWithValue }) => {
    try {
      const response = await quizAPI.getQuestions(params);
      return response.results;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to fetch questions');
    }
  }
);

export const submitQuiz = createAsyncThunk(
  'quiz/submitQuiz',
  async (
    data: {
      attempt_id: string;
      answers: Array<{ question_id: number; selected_option: string }>;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await quizAPI.submitQuiz(data);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to submit quiz');
    }
  }
);

export const generateRoadmap = createAsyncThunk(
  'quiz/generateRoadmap',
  async (enrollmentId: number, { rejectWithValue }) => {
    try {
      const roadmap = await roadmapAPI.generate(enrollmentId);
      return roadmap;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to generate roadmap');
    }
  }
);

export const fetchRoadmap = createAsyncThunk(
  'quiz/fetchRoadmap',
  async (params: { enrollment_id: number }, { rejectWithValue }) => {
    try {
      const response = await roadmapAPI.list(params);
      return response.results[0] || null;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to fetch roadmap');
    }
  }
);

const quizSlice = createSlice({
  name: 'quiz',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setAnswer: (state, action: PayloadAction<{ questionId: number; answer: string }>) => {
      state.userAnswers[action.payload.questionId] = action.payload.answer;
    },
    clearAnswers: (state) => {
      state.userAnswers = {};
    },
    resetQuiz: (state) => {
      state.questions = [];
      state.currentAttempt = null;
      state.userAnswers = {};
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Start diagnostic quiz
    builder
      .addCase(startDiagnosticQuiz.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        startDiagnosticQuiz.fulfilled,
        (state, action: PayloadAction<{ attempt_id: string; questions: Question[] }>) => {
          state.loading = false;
          state.questions = action.payload.questions;
          state.currentAttempt = {
            id: action.payload.attempt_id,
            user: 0,
            quiz_type: 'diagnostic',
            started_at: new Date().toISOString(),
          };
          state.userAnswers = {};
        }
      )
      .addCase(startDiagnosticQuiz.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Fetch questions
    builder
      .addCase(fetchQuestions.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchQuestions.fulfilled, (state, action: PayloadAction<Question[]>) => {
        state.loading = false;
        state.questions = action.payload;
      })
      .addCase(fetchQuestions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Submit quiz
    builder
      .addCase(submitQuiz.pending, (state) => {
        state.submitting = true;
        state.error = null;
      })
      .addCase(submitQuiz.fulfilled, (state, action) => {
        state.submitting = false;
        if (state.currentAttempt) {
          state.currentAttempt = {
            ...state.currentAttempt,
            ...action.payload.quiz_attempt,
          };
        }
      })
      .addCase(submitQuiz.rejected, (state, action) => {
        state.submitting = false;
        state.error = action.payload as string;
      });

    // Generate roadmap
    builder
      .addCase(generateRoadmap.pending, (state) => {
        state.loading = true;
      })
      .addCase(generateRoadmap.fulfilled, (state, action: PayloadAction<LearningRoadmap>) => {
        state.loading = false;
        state.roadmap = action.payload;
      })
      .addCase(generateRoadmap.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Fetch roadmap
    builder
      .addCase(fetchRoadmap.pending, (state) => {
        state.loading = true;
      })
      .addCase(
        fetchRoadmap.fulfilled,
        (state, action: PayloadAction<LearningRoadmap | null>) => {
          state.loading = false;
          state.roadmap = action.payload;
        }
      )
      .addCase(fetchRoadmap.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, setAnswer, clearAnswers, resetQuiz } = quizSlice.actions;
export default quizSlice.reducer;
