import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  assessmentAPI,
  videoAPI,
  resourceAPI,
  enrollmentAPI,
  Syllabus,
  AssessmentQuestion,
  Resource,
  MindMapData,
} from '../../services/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TopicKey {
  moduleIndex: number;
  topicIndex: number;
}

function topicId(enrollmentId: number | null, moduleIndex: number, topicIndex: number): string {
  return `${enrollmentId}-${moduleIndex}-${topicIndex}`;
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

interface RemediationItem {
  sub_topic: string;
  content: string;
  generatedAt: string;
}

export type ActiveResourceViewType = 'text' | 'video' | 'audio' | 'notes' | 'create-note';

export interface ActiveResourceView {
  type: ActiveResourceViewType;
  resourceId?: number;
}

export interface SyllabusState {
  enrollmentId: number | null;
  courseName: string;
  syllabus: Syllabus | null;
  generatedByModel: string;
  loading: boolean;
  error: string | null;

  mindMapData: MindMapData | null;
  mindMapLoading: boolean;

  // Per-topic state keyed by "enrollmentId-moduleIndex-topicIndex"
  topicCompletion: Record<string, boolean>;
  generatedContent: Record<string, GeneratedContent>;
  generatedQuizzes: Record<string, GeneratedQuiz>;
  quizResults: Record<string, QuizResult>;
  videoTasks: Record<string, VideoTask>;
  resources: Record<string, Resource[]>; // lessonId -> resources
  remediationContent: Record<string, RemediationItem[]>; // topicKey -> remediation notes
  activeResourceView: Record<string, ActiveResourceView>; // topicKey -> which resource is shown

  // Loading state per operation
  contentLoading: Record<string, boolean>;
  contentErrors: Record<string, string>;
  quizLoading: Record<string, boolean>;
  quizEvaluating: Record<string, boolean>;
  videoLoading: Record<string, boolean>;
  resourcesLoading: Record<string, boolean>; // lessonId -> loading
  remediationLoading: Record<string, boolean>;
}

const initialState: SyllabusState = {
  enrollmentId: null,
  courseName: '',
  syllabus: null,
  generatedByModel: '',
  loading: false,
  error: null,
  mindMapData: null,
  mindMapLoading: false,
  topicCompletion: {},
  generatedContent: {},
  generatedQuizzes: {},
  quizResults: {},
  videoTasks: {},
  resources: {},
  remediationContent: {},
  activeResourceView: {},
  contentLoading: {},
  contentErrors: {},
  quizLoading: {},
  quizEvaluating: {},
  videoLoading: {},
  resourcesLoading: {},
  remediationLoading: {},
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

export const generateCourseMindMap = createAsyncThunk(
  'syllabus/generateCourseMindMap',
  async (enrollmentId: number, { rejectWithValue }) => {
    try {
      const response = await enrollmentAPI.generateMindMap(enrollmentId);
      return response;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Failed to generate mind map'
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
      regenerate?: boolean;
    },
    { rejectWithValue }
  ) => {
    try {
      console.log('🚀 generateTopicContent thunk called with:', data);
      const response = await assessmentAPI.generateTopicContent({
        enrollment_id: data.enrollmentId,
        module_id: data.moduleId,
        topic_name: data.topicName,
        regenerate: data.regenerate,
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
      questionIds: number[];
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
        question_ids: data.questionIds,
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

export const generateRemediationContent = createAsyncThunk(
  'syllabus/generateRemediationContent',
  async (
    data: {
      enrollmentId: number;
      lessonId: number;
      topicName: string;
      weakAreas: string[];
      moduleIndex: number;
      topicIndex: number;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await assessmentAPI.generateRemediationContent({
        enrollment_id: data.enrollmentId,
        lesson_id: data.lessonId,
        topic_name: data.topicName,
        weak_areas: data.weakAreas,
      });
      return {
        ...response,
        moduleIndex: data.moduleIndex,
        topicIndex: data.topicIndex,
      };
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Failed to generate remediation content'
      );
    }
  }
);

export const createNote = createAsyncThunk(
  'syllabus/createNote',
  async (
    data: {
      lessonId: number;
      title: string;
      content: string;
      moduleIndex: number;
      topicIndex: number;
    },
    { rejectWithValue }
  ) => {
    try {
      const resource = await resourceAPI.createNote({
        lesson: data.lessonId,
        title: data.title,
        content_text: data.content,
      });
      return {
        resource,
        lessonId: data.lessonId,
        moduleIndex: data.moduleIndex,
        topicIndex: data.topicIndex,
      };
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Failed to create note'
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
      const key = topicId(state.enrollmentId, action.payload.moduleIndex, action.payload.topicIndex);
      state.topicCompletion[key] = !state.topicCompletion[key];
    },
    markTopicComplete: (state, action: PayloadAction<TopicKey>) => {
      const key = topicId(state.enrollmentId, action.payload.moduleIndex, action.payload.topicIndex);
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
    setActiveResourceView: (
      state,
      action: PayloadAction<{
        moduleIndex: number;
        topicIndex: number;
        view: ActiveResourceView | null;
      }>
    ) => {
      const key = topicId(state.enrollmentId, action.payload.moduleIndex, action.payload.topicIndex);
      if (action.payload.view) {
        state.activeResourceView[key] = action.payload.view;
      } else {
        delete state.activeResourceView[key];
      }
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
        const key = topicId(state.enrollmentId, action.meta.arg.moduleIndex, action.meta.arg.topicIndex);
        state.contentLoading[key] = true;
      })
      .addCase(generateTopicContent.fulfilled, (state, action) => {
        const key = topicId(state.enrollmentId, action.payload.moduleIndex, action.payload.topicIndex);
        state.contentLoading[key] = false;
        state.generatedContent[key] = {
          lessonId: action.payload.lesson_id,
          content: action.payload.content,
          generatedAt: new Date().toISOString(),
        };
      })
      .addCase(generateTopicContent.rejected, (state, action) => {
        const key = topicId(state.enrollmentId, action.meta.arg.moduleIndex, action.meta.arg.topicIndex);
        state.contentLoading[key] = false;
        state.contentErrors[key] = action.payload as string;
      });

    // generateTopicQuiz
    builder
      .addCase(generateTopicQuiz.pending, (state, action) => {
        const key = topicId(state.enrollmentId, action.meta.arg.moduleIndex, action.meta.arg.topicIndex);
        state.quizLoading[key] = true;
      })
      .addCase(generateTopicQuiz.fulfilled, (state, action) => {
        const key = topicId(state.enrollmentId, action.payload.moduleIndex, action.payload.topicIndex);
        state.quizLoading[key] = false;
        state.generatedQuizzes[key] = {
          questions: action.payload.questions,
          generatedAt: new Date().toISOString(),
        };
      })
      .addCase(generateTopicQuiz.rejected, (state, action) => {
        const key = topicId(state.enrollmentId, action.meta.arg.moduleIndex, action.meta.arg.topicIndex);
        state.quizLoading[key] = false;
      });

    // evaluateTopicQuiz
    builder
      .addCase(evaluateTopicQuiz.pending, (state, action) => {
        const key = topicId(state.enrollmentId, action.meta.arg.moduleIndex, action.meta.arg.topicIndex);
        state.quizEvaluating[key] = true;
      })
      .addCase(evaluateTopicQuiz.fulfilled, (state, action) => {
        const key = topicId(state.enrollmentId, action.payload.moduleIndex, action.payload.topicIndex);
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
        const key = topicId(state.enrollmentId, action.meta.arg.moduleIndex, action.meta.arg.topicIndex);
        state.quizEvaluating[key] = false;
      });

    // generateVideo
    builder
      .addCase(generateVideo.pending, (state, action) => {
        const key = topicId(state.enrollmentId, action.meta.arg.moduleIndex, action.meta.arg.topicIndex);
        state.videoLoading[key] = true;
      })
      .addCase(generateVideo.fulfilled, (state, action) => {
        const key = topicId(state.enrollmentId, action.payload.moduleIndex, action.payload.topicIndex);
        state.videoLoading[key] = false;
        state.videoTasks[key] = {
          taskId: action.payload.taskId,
          status: 'pending',
        };
      })
      .addCase(generateVideo.rejected, (state, action) => {
        const key = topicId(state.enrollmentId, action.meta.arg.moduleIndex, action.meta.arg.topicIndex);
        state.videoLoading[key] = false;
      });

    // pollVideoStatus
    builder.addCase(pollVideoStatus.fulfilled, (state, action) => {
      const key = topicId(state.enrollmentId, action.payload.moduleIndex, action.payload.topicIndex);
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

    // generateRemediationContent
    builder
      .addCase(generateRemediationContent.pending, (state, action) => {
        const key = topicId(state.enrollmentId, action.meta.arg.moduleIndex, action.meta.arg.topicIndex);
        state.remediationLoading[key] = true;
      })
      .addCase(generateRemediationContent.fulfilled, (state, action) => {
        const key = topicId(state.enrollmentId, action.payload.moduleIndex, action.payload.topicIndex);
        state.remediationLoading[key] = false;
        const notes = action.payload.remediation_notes.map((note: any) => ({
          sub_topic: note.sub_topic,
          content: note.content,
          generatedAt: new Date().toISOString(),
        }));
        // Append to existing remediation notes (don't overwrite)
        const existing = state.remediationContent[key] || [];
        state.remediationContent[key] = [...existing, ...notes];
      })
      .addCase(generateRemediationContent.rejected, (state, action) => {
        const key = topicId(state.enrollmentId, action.meta.arg.moduleIndex, action.meta.arg.topicIndex);
        state.remediationLoading[key] = false;
      });

    // createNote — add the new resource into the resources array for the lesson
    builder
      .addCase(createNote.fulfilled, (state, action) => {
        const { resource, lessonId } = action.payload;
        const existing = state.resources[lessonId] || [];
        state.resources[lessonId] = [...existing, resource];
      });

    // generateCourseMindMap
    builder
      .addCase(generateCourseMindMap.pending, (state) => {
        state.mindMapLoading = true;
      })
      .addCase(generateCourseMindMap.fulfilled, (state, action) => {
        state.mindMapLoading = false;
        state.mindMapData = action.payload;
      })
      .addCase(generateCourseMindMap.rejected, (state, action) => {
        state.mindMapLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  clearSyllabus,
  toggleTopicCompletion,
  markTopicComplete,
  setSyllabusFromEvaluation,
  setActiveResourceView,
} = syllabusSlice.actions;

// ─── Selectors ───────────────────────────────────────────────────────────────

export const selectTopicContent = (
  state: { syllabus: SyllabusState },
  moduleIndex: number,
  topicIndex: number
) => state.syllabus.generatedContent[topicId(state.syllabus.enrollmentId, moduleIndex, topicIndex)];

export const selectTopicQuiz = (
  state: { syllabus: SyllabusState },
  moduleIndex: number,
  topicIndex: number
) => state.syllabus.generatedQuizzes[topicId(state.syllabus.enrollmentId, moduleIndex, topicIndex)];

export const selectQuizResult = (
  state: { syllabus: SyllabusState },
  moduleIndex: number,
  topicIndex: number
) => state.syllabus.quizResults[topicId(state.syllabus.enrollmentId, moduleIndex, topicIndex)];

export const selectVideoTask = (
  state: { syllabus: SyllabusState },
  moduleIndex: number,
  topicIndex: number
) => state.syllabus.videoTasks[topicId(state.syllabus.enrollmentId, moduleIndex, topicIndex)];

export const selectResources = (
  state: { syllabus: SyllabusState },
  lessonId: number
) => state.syllabus.resources[lessonId] || [];

export const selectIsTopicComplete = (
  state: { syllabus: SyllabusState },
  moduleIndex: number,
  topicIndex: number
) => !!state.syllabus.topicCompletion[topicId(state.syllabus.enrollmentId, moduleIndex, topicIndex)];

export const selectRemediationContent = (
  state: { syllabus: SyllabusState },
  moduleIndex: number,
  topicIndex: number
) => state.syllabus.remediationContent[topicId(state.syllabus.enrollmentId, moduleIndex, topicIndex)] || [];

export const selectTopicContentError = (
  state: { syllabus: SyllabusState },
  moduleIndex: number,
  topicIndex: number
) => state.syllabus.contentErrors[topicId(state.syllabus.enrollmentId, moduleIndex, topicIndex)];

export const selectRemediationLoading = (
  state: { syllabus: SyllabusState },
  moduleIndex: number,
  topicIndex: number
) => !!state.syllabus.remediationLoading[topicId(state.syllabus.enrollmentId, moduleIndex, topicIndex)];

/**
 * A module is unlocked if:
 *  - It is module 0 (always unlocked), OR
 *  - ALL topics in the previous module are completed AND
 *    every topic in the previous module scored >= 80% on the quiz.
 */
export const selectIsModuleUnlocked = (
  state: { syllabus: SyllabusState },
  moduleIndex: number
): boolean => {
  if (moduleIndex === 0) return true;

  const { syllabus, topicCompletion, quizResults, enrollmentId } = state.syllabus;
  if (!syllabus) return false;

  const prevModule = syllabus.modules[moduleIndex - 1];
  if (!prevModule) return false;

  // Every topic in the previous module must be completed
  for (let t = 0; t < prevModule.topics.length; t++) {
    const key = topicId(enrollmentId, moduleIndex - 1, t);
    if (!topicCompletion[key]) return false;
  }

  // Every topic in the previous module must have a quiz score >= 80%
  for (let t = 0; t < prevModule.topics.length; t++) {
    const key = topicId(enrollmentId, moduleIndex - 1, t);
    const result = quizResults[key];
    if (!result || result.scorePercent < 80) return false;
  }

  return true;
};

/**
 * Returns the best (highest) quiz score percent for the given module,
 * looking at all topic-level quizResults within that module.
 * Returns undefined if no quiz has been taken yet.
 */
export const selectModuleBestScore = (
  state: { syllabus: SyllabusState },
  moduleIndex: number
): number | undefined => {
  const { syllabus, quizResults, enrollmentId } = state.syllabus;
  if (!syllabus) return undefined;
  const mod = syllabus.modules[moduleIndex];
  if (!mod) return undefined;

  let best: number | undefined;
  for (let t = 0; t < mod.topics.length; t++) {
    const result = quizResults[topicId(enrollmentId, moduleIndex, t)];
    if (result) {
      if (best === undefined || result.scorePercent > best) {
        best = result.scorePercent;
      }
    }
  }
  return best;
};

export const selectActiveResourceView = (
  state: { syllabus: SyllabusState },
  moduleIndex: number,
  topicIndex: number
): ActiveResourceView | null =>
  state.syllabus.activeResourceView[topicId(state.syllabus.enrollmentId, moduleIndex, topicIndex)] || null;

export const selectMindMapData = (state: { syllabus: SyllabusState }) => state.syllabus.mindMapData;
export const selectMindMapLoading = (state: { syllabus: SyllabusState }) => state.syllabus.mindMapLoading;

export default syllabusSlice.reducer;
