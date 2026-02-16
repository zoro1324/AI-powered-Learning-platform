import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { courseAPI, moduleAPI, enrollmentAPI, dashboardAPI } from '../../services/api';
import { Course, Module, Enrollment, DashboardData } from '../../types/api';

interface CourseState {
  courses: Course[];
  currentCourse: Course | null;
  modules: Module[];
  enrollments: Enrollment[];
  currentEnrollment: Enrollment | null;
  dashboard: DashboardData | null;
  loading: boolean;
  error: string | null;
}

const initialState: CourseState = {
  courses: [],
  currentCourse: null,
  modules: [],
  enrollments: [],
  currentEnrollment: null,
  dashboard: null,
  loading: false,
  error: null,
};

// Async thunks
export const fetchCourses = createAsyncThunk(
  'course/fetchCourses',
  async (params: any = {}, { rejectWithValue }) => {
    try {
      const response = await courseAPI.list(params);
      return response.results;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to fetch courses');
    }
  }
);

export const fetchCourse = createAsyncThunk(
  'course/fetchCourse',
  async (id: number, { rejectWithValue }) => {
    try {
      const course = await courseAPI.get(id);
      return course;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to fetch course');
    }
  }
);

export const fetchCourseModules = createAsyncThunk(
  'course/fetchCourseModules',
  async (courseId: number, { rejectWithValue }) => {
    try {
      const modules = await courseAPI.getModules(courseId);
      return modules;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to fetch modules');
    }
  }
);

export const fetchEnrollments = createAsyncThunk(
  'course/fetchEnrollments',
  async (params: any = {}, { rejectWithValue }) => {
    try {
      const response = await enrollmentAPI.list(params);
      return response.results;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to fetch enrollments');
    }
  }
);

export const createEnrollment = createAsyncThunk(
  'course/createEnrollment',
  async (data: { course_id: number; learning_goals?: string }, { rejectWithValue }) => {
    try {
      const enrollment = await enrollmentAPI.create(data);
      return enrollment;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to create enrollment');
    }
  }
);

export const fetchEnrollmentProgress = createAsyncThunk(
  'course/fetchEnrollmentProgress',
  async (id: number, { rejectWithValue }) => {
    try {
      const progress = await enrollmentAPI.getProgress(id);
      return progress;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to fetch progress');
    }
  }
);

export const fetchDashboard = createAsyncThunk(
  'course/fetchDashboard',
  async (_, { rejectWithValue }) => {
    try {
      const dashboard = await dashboardAPI.get();
      return dashboard;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to fetch dashboard');
    }
  }
);

const courseSlice = createSlice({
  name: 'course',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setCurrentCourse: (state, action: PayloadAction<Course | null>) => {
      state.currentCourse = action.payload;
    },
    setCurrentEnrollment: (state, action: PayloadAction<Enrollment | null>) => {
      state.currentEnrollment = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Fetch courses
    builder
      .addCase(fetchCourses.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCourses.fulfilled, (state, action: PayloadAction<Course[]>) => {
        state.loading = false;
        state.courses = action.payload;
      })
      .addCase(fetchCourses.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Fetch course
    builder
      .addCase(fetchCourse.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCourse.fulfilled, (state, action: PayloadAction<Course>) => {
        state.loading = false;
        state.currentCourse = action.payload;
      })
      .addCase(fetchCourse.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Fetch course modules
    builder
      .addCase(fetchCourseModules.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchCourseModules.fulfilled, (state, action: PayloadAction<Module[]>) => {
        state.loading = false;
        state.modules = action.payload;
      })
      .addCase(fetchCourseModules.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Fetch enrollments
    builder
      .addCase(fetchEnrollments.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchEnrollments.fulfilled, (state, action: PayloadAction<Enrollment[]>) => {
        state.loading = false;
        state.enrollments = action.payload;
      })
      .addCase(fetchEnrollments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Create enrollment
    builder
      .addCase(createEnrollment.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createEnrollment.fulfilled, (state, action: PayloadAction<Enrollment>) => {
        state.loading = false;
        state.enrollments.push(action.payload);
        state.currentEnrollment = action.payload;
      })
      .addCase(createEnrollment.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Fetch enrollment progress
    builder
      .addCase(fetchEnrollmentProgress.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchEnrollmentProgress.fulfilled, (state, action) => {
        state.loading = false;
        // Update current enrollment with progress data
        if (state.currentEnrollment) {
          state.currentEnrollment = { ...state.currentEnrollment, ...action.payload.enrollment };
        }
      })
      .addCase(fetchEnrollmentProgress.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Fetch dashboard
    builder
      .addCase(fetchDashboard.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchDashboard.fulfilled, (state, action: PayloadAction<DashboardData>) => {
        state.loading = false;
        state.dashboard = action.payload;
      })
      .addCase(fetchDashboard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, setCurrentCourse, setCurrentEnrollment } = courseSlice.actions;
export default courseSlice.reducer;
