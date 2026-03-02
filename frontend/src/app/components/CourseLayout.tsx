import { useState, useEffect } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchSyllabus } from '../../store/slices/syllabusSlice';
import { CourseOutlineSidebar } from './CourseOutlineSidebar';
import { StudioPanel } from './StudioPanel';
import { Loader2 } from 'lucide-react';

export function CourseLayout() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { enrollmentId } = useParams();
  const eId = enrollmentId ? parseInt(enrollmentId) : null;

  const { syllabus, loading, error, enrollmentId: storedEId } = useAppSelector(
    (state) => state.syllabus
  );

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // Fetch syllabus if not already loaded for this enrollment
  useEffect(() => {
    if (eId && (!syllabus || storedEId !== eId)) {
      dispatch(fetchSyllabus(eId));
    }
  }, [eId, syllabus, storedEId, dispatch]);

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading your course...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <p className="text-red-500 font-medium mb-2">
            Failed to load course
          </p>
          <p className="text-gray-500 text-sm mb-4">{error}</p>
          <button
            onClick={() => eId && dispatch(fetchSyllabus(eId))}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {/* Left: Course Outline Sidebar */}
      <CourseOutlineSidebar
        collapsed={leftCollapsed}
        onToggle={() => setLeftCollapsed(!leftCollapsed)}
      />

      {/* Center: Main Content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* Right: Studio Panel */}
      <StudioPanel
        collapsed={rightCollapsed}
        onToggle={() => setRightCollapsed(!rightCollapsed)}
      />
    </div>
  );
}
