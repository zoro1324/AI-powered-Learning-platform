import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  assessmentAPI,
  videoAPI,
  resourceAPI,
  Syllabus,
  AssessmentQuestion,
  Resource,
} from '../../services/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TopicKey {
  moduleIndex: number;
  topicIndex: number;
}

function topicId(moduleIndex: number, topicIndex: number): string {
  return `${moduleIndex}-${topicIndex}`;
}

interface GeneratedContent {
  lessonId: number;
  content: string;
  generatedAt: string;
}

interface GeneratedQuiz {
  questions: AssessmentQuestion[];
  generatedAt: string;
}

interface QuizResult {
  score: string;
  scorePercent: number;
  correctCount: number;
  totalQuestions: number;
  weakAreas: string[];
}

interface VideoTask {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}

export interface SyllabusState {
  enrollmentId: number | null;
  courseName: string;
  syllabus: Syllabus | null;
  generatedByModel: string;
  loading: boolean;
  error: string | null;

  // Per-topic state keyed by "moduleIndex-topicIndex"
  topicCompletion: Record<string, boolean>;
  generatedContent: Record<string, GeneratedContent>;
  generatedQuizzes: Record<string, GeneratedQuiz>;
  quizResults: Record<string, QuizResult>;
  videoTasks: Record<string, VideoTask>;
  resources: Record<string, Resource[]>; // lessonId -> resources

  // Loading state per operation
  contentLoading: Record<string, boolean>;
  quizLoading: Record<string, boolean>;
  quizEvaluating: Record<string, boolean>;
  videoLoading: Record<string, boolean>;
  resourcesLoading: Record<string, boolean>; // lessonId -> loading
}

const initialState: SyllabusState = {
  enrollmentId: null,
  courseName: '',
  syllabus: null,
  generatedByModel: '',
  loading: false,
  error: null,
  topicCompletion: {},
  generatedContent: {},
  generatedQuizzes: {},
  quizResults: {},
  videoTasks: {},
  resources: {},
  contentLoading: {},
  quizLoading: {},
  quizEvaluating: {},
  videoLoading: {},
  resourcesLoading: {},
};

// ─── Async Thunks ────────────────────────────────────────────────────────────

export const fetchSyllabus = createAsyncThunk(
  'syllabus/fetchSyllabus',
  async (enrollmentId: number, { rejectWithValue }) => {
    try {
      const response = await assessmentAPI.getSyllabus(enrollmentId);
      return response;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Failed to fetch syllabus'
      );
    }
  }
);

export const generateTopicContent = createAsyncThunk(
  'syllabus/generateTopicContent',
  async (
    data: {
      enrollmentId: number;
      moduleId: number;
      topicName: string;
      moduleIndex: number;
      topicIndex: number;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await assessmentAPI.generateTopicContent({
        enrollment_id: data.enrollmentId,
        module_id: data.moduleId,
        topic_name: data.topicName,
      });
      return {
        ...response,
        moduleIndex: data.moduleIndex,
        topicIndex: data.topicIndex,
      };
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Failed to generate content'
      );
    }
  }
);

export const generateTopicQuiz = createAsyncThunk(
  'syllabus/generateTopicQuiz',
  async (
    data: {
      lessonId: number;
      topicName: string;
      moduleIndex: number;
      topicIndex: number;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await assessmentAPI.generateTopicQuiz({
        lesson_id: data.lessonId,
        topic_name: data.topicName,
      });
      return {
        ...response,
        moduleIndex: data.moduleIndex,
        topicIndex: data.topicIndex,
      };
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Failed to generate quiz'
      );
    }
  }
);

export const evaluateTopicQuiz = createAsyncThunk(
  'syllabus/evaluateTopicQuiz',
  async (
    data: {
      enrollmentId: number;
      moduleId: number;
      questions: AssessmentQuestion[];
      answers: string[];
      moduleIndex: number;
      topicIndex: number;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await assessmentAPI.evaluateTopicQuiz({
        enrollment_id: data.enrollmentId,
        module_id: data.moduleId,
        questions: data.questions,
        answers: data.answers,
      });
      return {
        ...response,
        moduleIndex: data.moduleIndex,
        topicIndex: data.topicIndex,
      };
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Failed to evaluate quiz'
      );
    }
  }
);

export const generateVideo = createAsyncThunk(
  'syllabus/generateVideo',
  async (
    data: {
      topicName: string;
      lessonId?: number;
      moduleIndex: number;
      topicIndex: number;
    },
    { rejectWithValue }
  ) => {
    try {
      console.log('🎥 generateVideo thunk called with:', data);
      const response = await videoAPI.generate({
        topic: data.topicName,
        lesson_id: data.lessonId,
      });
      console.log('✅ Video API response:', response);
      return {
        taskId: response.task_id,
        moduleIndex: data.moduleIndex,
        topicIndex: data.topicIndex,
      };
    } catch (error: any) {
      console.error('❌ Video generation failed:', error);
      return rejectWithValue(
        error.response?.data?.error || 'Failed to start video generation'
      );
    }
  }
);

export const pollVideoStatus = createAsyncThunk(
  'syllabus/pollVideoStatus',
  async (
    data: {
      taskId: string;
      moduleIndex: number;
      topicIndex: number;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await videoAPI.getStatus(data.taskId);
      console.log('📊 Video status poll response:', response);
      return {
        ...response,
        taskId: data.taskId,
        moduleIndex: data.moduleIndex,
        topicIndex: data.topicIndex,
      };
    } catch (error: any) {
      console.error('❌ Video status poll failed:', error);
      return rejectWithValue(
        error.response?.data?.error || 'Failed to check video status'
      );
    }
  }
);

export const fetchResources = createAsyncThunk(
  'syllabus/fetchResources',
  async (lessonId: number, { rejectWithValue }) => {
    try {
      const resources = await resourceAPI.listByLesson(lessonId);
      return { lessonId, resources };
    } catch (error: any) {
      console.error('❌ Failed to fetch resources:', error);
      return rejectWithValue(
        error.response?.data?.error || 'Failed to fetch resources'
      );
    }
  }
);

// ─── Slice ───────────────────────────────────────────────────────────────────

const syllabusSlice = createSlice({
  name: 'syllabus',
  initialState,
  reducers: {
    clearSyllabus: () => initialState,
    toggleTopicCompletion: (state, action: PayloadAction<TopicKey>) => {
      const key = topicId(action.payload.moduleIndex, action.payload.topicIndex);
      state.topicCompletion[key] = !state.topicCompletion[key];
    },
    markTopicComplete: (state, action: PayloadAction<TopicKey>) => {
      const key = topicId(action.payload.moduleIndex, action.payload.topicIndex);
      state.topicCompletion[key] = true;
    },
    setSyllabusFromEvaluation: (
      state,
      action: PayloadAction<{
        enrollmentId: number;
        courseName: string;
        syllabus: Syllabus;
      }>
    ) => {
      state.enrollmentId = action.payload.enrollmentId;
      state.courseName = action.payload.courseName;
      state.syllabus = action.payload.syllabus;
    },
  },
  extraReducers: (builder) => {
    // fetchSyllabus
    builder
      .addCase(fetchSyllabus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSyllabus.fulfilled, (state, action) => {
        state.loading = false;
        state.enrollmentId = action.payload.enrollment_id;
        state.courseName = action.payload.course_name;
        state.syllabus = action.payload.syllabus;
        state.generatedByModel = action.payload.generated_by_model;
      })
      .addCase(fetchSyllabus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // generateTopicContent
    builder
      .addCase(generateTopicContent.pending, (state, action) => {
        const key = topicId(action.meta.arg.moduleIndex, action.meta.arg.topicIndex);
        state.contentLoading[key] = true;
      })
      .addCase(generateTopicContent.fulfilled, (state, action) => {
        const key = topicId(action.payload.moduleIndex, action.payload.topicIndex);
        state.contentLoading[key] = false;
        state.generatedContent[key] = {
          lessonId: action.payload.lesson_id,
          content: action.payload.content,
          generatedAt: new Date().toISOString(),
        };
      })
      .addCase(generateTopicContent.rejected, (state, action) => {
        const key = topicId(action.meta.arg.moduleIndex, action.meta.arg.topicIndex);
        state.contentLoading[key] = false;
      });

    // generateTopicQuiz
    builder
      .addCase(generateTopicQuiz.pending, (state, action) => {
        const key = topicId(action.meta.arg.moduleIndex, action.meta.arg.topicIndex);
        state.quizLoading[key] = true;
      })
      .addCase(generateTopicQuiz.fulfilled, (state, action) => {
        const key = topicId(action.payload.moduleIndex, action.payload.topicIndex);
        state.quizLoading[key] = false;
        state.generatedQuizzes[key] = {
          questions: action.payload.questions,
          generatedAt: new Date().toISOString(),
        };
      })
      .addCase(generateTopicQuiz.rejected, (state, action) => {
        const key = topicId(action.meta.arg.moduleIndex, action.meta.arg.topicIndex);
        state.quizLoading[key] = false;
      });

    // evaluateTopicQuiz
    builder
      .addCase(evaluateTopicQuiz.pending, (state, action) => {
        const key = topicId(action.meta.arg.moduleIndex, action.meta.arg.topicIndex);
        state.quizEvaluating[key] = true;
      })
      .addCase(evaluateTopicQuiz.fulfilled, (state, action) => {
        const key = topicId(action.payload.moduleIndex, action.payload.topicIndex);
        state.quizEvaluating[key] = false;
        state.quizResults[key] = {
          score: action.payload.evaluation.score,
          scorePercent: action.payload.evaluation.score_percent,
          correctCount: action.payload.evaluation.correct_count,
          totalQuestions: action.payload.evaluation.total_questions,
          weakAreas: action.payload.evaluation.weak_areas,
        };
      })
      .addCase(evaluateTopicQuiz.rejected, (state, action) => {
        const key = topicId(action.meta.arg.moduleIndex, action.meta.arg.topicIndex);
        state.quizEvaluating[key] = false;
      });

    // generateVideo
    builder
      .addCase(generateVideo.pending, (state, action) => {
        const key = topicId(action.meta.arg.moduleIndex, action.meta.arg.topicIndex);
        state.videoLoading[key] = true;
      })
      .addCase(generateVideo.fulfilled, (state, action) => {
        const key = topicId(action.payload.moduleIndex, action.payload.topicIndex);
        state.videoLoading[key] = false;
        state.videoTasks[key] = {
          taskId: action.payload.taskId,
          status: 'pending',
        };
      })
      .addCase(generateVideo.rejected, (state, action) => {
        const key = topicId(action.meta.arg.moduleIndex, action.meta.arg.topicIndex);
        state.videoLoading[key] = false;
      });

    // pollVideoStatus
    builder.addCase(pollVideoStatus.fulfilled, (state, action) => {
      const key = topicId(action.payload.moduleIndex, action.payload.topicIndex);
      const existing = state.videoTasks[key];
      console.log('🔄 Updating video task for key:', key);
      console.log('📦 Payload:', action.payload);
      console.log('🎯 Current task:', existing);
      
      if (existing) {
        existing.status = action.payload.status;
        console.log('📝 Updated status to:', action.payload.status);
        
        if (action.payload.status === 'completed') {
          existing.videoUrl = action.payload.video_url;
          console.log('✅ Video completed! URL:', action.payload.video_url);
        }
        if (action.payload.status === 'failed') {
          existing.error = action.payload.error_message || action.payload.error || 'Video generation failed';
          console.log('❌ Video failed:', existing.error);
        }
      } else {
        console.warn('⚠️ No existing video task found for key:', key);
      }
    });

    // fetchResources
    builder
      .addCase(fetchResources.pending, (state, action) => {
        state.resourcesLoading[action.meta.arg] = true;
      })
      .addCase(fetchResources.fulfilled, (state, action) => {
        state.resourcesLoading[action.payload.lessonId] = false;
        state.resources[action.payload.lessonId] = action.payload.resources;
      })
      .addCase(fetchResources.rejected, (state, action) => {
        state.resourcesLoading[action.meta.arg] = false;
      });
  },
});

export const {
  clearSyllabus,
  toggleTopicCompletion,
  markTopicComplete,
  setSyllabusFromEvaluation,
} = syllabusSlice.actions;

// ─── Selectors ───────────────────────────────────────────────────────────────

export const selectTopicContent = (
  state: { syllabus: SyllabusState },
  moduleIndex: number,
  topicIndex: number
) => state.syllabus.generatedContent[topicId(moduleIndex, topicIndex)];

export const selectTopicQuiz = (
  state: { syllabus: SyllabusState },
  moduleIndex: number,
  topicIndex: number
) => state.syllabus.generatedQuizzes[topicId(moduleIndex, topicIndex)];

export const selectQuizResult = (
  state: { syllabus: SyllabusState },
  moduleIndex: number,
  topicIndex: number
) => state.syllabus.quizResults[topicId(moduleIndex, topicIndex)];

export const selectVideoTask = (
  state: { syllabus: SyllabusState },
  moduleIndex: number,
  topicIndex: number
) => state.syllabus.videoTasks[topicId(moduleIndex, topicIndex)];

export const selectResources = (
  state: { syllabus: SyllabusState },
  lessonId: number
) => state.syllabus.resources[lessonId] || [];

export const selectIsTopicComplete = (
  state: { syllabus: SyllabusState },
  moduleIndex: number,
  topicIndex: number
) => !!state.syllabus.topicCompletion[topicId(moduleIndex, topicIndex)];

export default syllabusSlice.reducer;
