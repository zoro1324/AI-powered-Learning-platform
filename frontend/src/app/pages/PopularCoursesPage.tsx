import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Sidebar } from '../components/Sidebar';
import AssessmentDialog from '../components/AssessmentDialog';
import {
  BookOpen,
  Clock,
  TrendingUp,
  Plus,
  Loader2,
  Filter,
  Search,
  GraduationCap,
  ChevronDown,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { useAppSelector } from '../../store';
import { courseAPI, coursePlanningAPI, enrollmentAPI } from '../../services/api';
import { Course, CoursePlanningTask } from '../../types/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

const CATEGORY_LABELS: Record<string, string> = {
  web_dev: 'Web Development',
  data_science: 'Data Science',
  ai_ml: 'AI & ML',
  mobile_dev: 'Mobile Development',
  cloud: 'Cloud Computing',
  design: 'Design',
  devops: 'DevOps',
  cybersecurity: 'Cybersecurity',
  blockchain: 'Blockchain',
  other: 'Other',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-green-100 text-green-800',
  intermediate: 'bg-yellow-100 text-yellow-800',
  advanced: 'bg-red-100 text-red-800',
};

interface CourseGroup {
  mainCourse: Course;
  subCourses: Course[];
}

export default function PopularCoursesPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [planningTaskId, setPlanningTaskId] = useState<string | null>(null);
  const [planningStatus, setPlanningStatus] = useState<string>('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [enrolledCourseMap, setEnrolledCourseMap] = useState<Record<number, number>>({});

  // Assessment dialog state
  const [assessmentDialogOpen, setAssessmentDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  // Form state
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    category: Course['category'];
    difficulty_level: Course['difficulty_level'];
    estimated_duration: number;
    thumbnail: string;
  }>({
    title: '',
    description: '',
    category: 'web_dev',
    difficulty_level: 'beginner',
    estimated_duration: 60,
    thumbnail: '',
  });

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const [coursesRes, enrollmentsRes] = await Promise.all([
        courseAPI.list({ is_popular: true }),
        isAuthenticated ? enrollmentAPI.list() : Promise.resolve({ results: [] })
      ]);
      const allCourses: Course[] = coursesRes.results || [];
      setCourses(allCourses);

      // Build enrollment map: courseId -> enrollmentId
      const enrollments = enrollmentsRes.results || [];
      const enrolledMap: Record<number, number> = {};
      enrollments.forEach((e: any) => {
        const courseId = typeof e.course === 'object' ? e.course.id : e.course;
        enrolledMap[courseId] = e.id;
      });
      setEnrolledCourseMap(enrolledMap);

      // Default: expand all groups
      const mainCourseTitles = allCourses
        .filter((c) => c.is_sub_topic === false)
        .map((c) => c.title);
      setExpandedGroups(new Set(mainCourseTitles));
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load courses');
      console.error('Error fetching courses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      setPlanningStatus('Analyzing topic and creating course plan...');

      const planningTask = await coursePlanningAPI.create({
        course_title: formData.title,
        course_description: formData.description,
        category: formData.category,
        difficulty_level: formData.difficulty_level,
        estimated_duration: formData.estimated_duration,
        thumbnail: formData.thumbnail,
      });

      setPlanningTaskId(planningTask.id);

      const pollInterval = setInterval(async () => {
        try {
          const status = await coursePlanningAPI.getStatus(planningTask.id);
          setPlanningStatus(status.progress_message || 'Processing...');

          if (status.status === 'completed') {
            clearInterval(pollInterval);
            setCreating(false);
            setPlanningStatus('');
            setPlanningTaskId(null);

            const coursesCreated = status.created_courses?.length || 0;
            const message = status.result_data?.is_broad
              ? `Successfully created ${coursesCreated} courses! The topic was broad and has been split into a structured learning path.`
              : 'Successfully created course!';
            alert(message);

            setDialogOpen(false);
            setFormData({
              title: '',
              description: '',
              category: 'web_dev',
              difficulty_level: 'beginner',
              estimated_duration: 60,
              thumbnail: '',
            });
            fetchCourses();
          } else if (status.status === 'failed') {
            clearInterval(pollInterval);
            setCreating(false);
            setPlanningStatus('');
            setPlanningTaskId(null);
            alert('Failed to create course: ' + (status.error_message || 'Unknown error'));
          }
        } catch (err: any) {
          clearInterval(pollInterval);
          setCreating(false);
          setPlanningStatus('');
          setPlanningTaskId(null);
          console.error('Error checking task status:', err);
          alert('Failed to check course planning status');
        }
      }, 2000);

    } catch (err: any) {
      setCreating(false);
      setPlanningStatus('');
      setPlanningTaskId(null);
      console.error('Error creating course:', err);
      alert('Failed to create course: ' + (err.message || 'Unknown error'));
    }
  };

  const handleEnrollClick = (e: React.MouseEvent, course: Course) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (course.is_sub_topic === false) {
      alert(`Please choose a learnable sub-topic for "${course.title}" from the course details page.`);
      navigate(`/courses/${course.id}`);
      return;
    }
    setSelectedCourse(course);
    setAssessmentDialogOpen(true);
  };

  const handleEnrollmentComplete = (enrollmentId: number) => {
    console.log('Enrollment created:', enrollmentId);
    navigate(`/course/${enrollmentId}`);
  };

  const toggleGroup = (mainCourseTitle: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(mainCourseTitle)) {
        next.delete(mainCourseTitle);
      } else {
        next.add(mainCourseTitle);
      }
      return next;
    });
  };

  // Group courses: main courses with their sub-courses
  const buildGroups = (): { groups: CourseGroup[]; orphanSubs: Course[] } => {
    const mainCourses = courses.filter(
      (c) => c.is_sub_topic === false
    );
    const subCourses = courses.filter(
      (c) => c.is_sub_topic === true
    );

    const groups: CourseGroup[] = mainCourses.map((main) => ({
      mainCourse: main,
      subCourses: subCourses.filter(
        (sub) => sub.parent_topic_name?.toLowerCase() === main.title?.toLowerCase()
      ),
    }));

    const groupedSubTitles = groups.flatMap((g) => g.subCourses.map((s) => s.id));
    const orphanSubs = subCourses.filter((s) => !groupedSubTitles.includes(s.id));

    return { groups, orphanSubs };
  };

  // Apply search/category filters to groups
  const getFilteredGroups = () => {
    const { groups, orphanSubs } = buildGroups();
    const q = searchQuery.toLowerCase();

    const filteredGroups = groups
      .map((group) => {
        const mainMatches =
          (categoryFilter === 'all' || group.mainCourse.category === categoryFilter) &&
          (q === '' ||
            group.mainCourse.title.toLowerCase().includes(q) ||
            group.mainCourse.description.toLowerCase().includes(q));

        const filteredSubs = group.subCourses.filter((sub) => {
          const catMatch = categoryFilter === 'all' || sub.category === categoryFilter;
          const searchMatch =
            q === '' ||
            sub.title.toLowerCase().includes(q) ||
            sub.description.toLowerCase().includes(q);
          return catMatch && searchMatch;
        });

        // Show the group if main matches (show all its subs) OR any sub matches
        if (mainMatches) {
          return {
            ...group, subCourses: group.subCourses.filter((sub) => {
              const catMatch = categoryFilter === 'all' || sub.category === categoryFilter;
              return catMatch;
            })
          };
        }
        if (filteredSubs.length > 0) {
          return { ...group, subCourses: filteredSubs };
        }
        return null;
      })
      .filter(Boolean) as CourseGroup[];

    const filteredOrphans = orphanSubs.filter((sub) => {
      const catMatch = categoryFilter === 'all' || sub.category === categoryFilter;
      const searchMatch =
        q === '' ||
        sub.title.toLowerCase().includes(q) ||
        sub.description.toLowerCase().includes(q);
      return catMatch && searchMatch;
    });

    const totalLearnable =
      filteredGroups.reduce((acc, g) => acc + g.subCourses.length, 0) +
      filteredOrphans.length;

    return { filteredGroups, filteredOrphans, totalLearnable };
  };

  const renderSubCourseCard = (course: Course) => {
    const isEnrolled = course.id in enrolledCourseMap;
    const enrollmentId = enrolledCourseMap[course.id];

    return (
      <Card
        key={course.id}
        className="hover:shadow-xl transition-shadow cursor-pointer"
        onClick={() => navigate(`/courses/${course.id}`)}
      >
        {/* Thumbnail */}
        {course.thumbnail && (
          <div className="w-full h-40 overflow-hidden rounded-t-lg">
            <img
              src={course.thumbnail}
              alt={course.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}

        <CardHeader>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {CATEGORY_LABELS[course.category] || course.category}
              </Badge>
              {isEnrolled && (
                <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs hover:bg-blue-100 hover:text-blue-800">
                  Enrolled
                </Badge>
              )}
            </div>
            <Badge className={`text-xs ${DIFFICULTY_COLORS[course.difficulty_level]}`}>
              {course.difficulty_level}
            </Badge>
          </div>
          <CardTitle className="text-lg line-clamp-2">
            {course.title}
          </CardTitle>
        </CardHeader>

        <CardContent>
          <CardDescription className="line-clamp-3 mb-4">
            {course.description}
          </CardDescription>

          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{course.estimated_duration} min</span>
            </div>
            {course.modules_count !== undefined && (
              <div className="flex items-center gap-1">
                <BookOpen className="w-4 h-4" />
                <span>{course.modules_count} modules</span>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex gap-2">
          {isAuthenticated ? (
            <>
              {isEnrolled ? (
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/course/${enrollmentId}`);
                  }}
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  Resume Learning
                </Button>
              ) : (
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={(e) => handleEnrollClick(e, course)}
                >
                  <GraduationCap className="w-4 h-4 mr-2" />
                  Enroll Now
                </Button>
              )}
              <Button
                variant="outline"
                className="flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/courses/${course.id}`);
                }}
              >
                View Details
              </Button>
            </>
          ) : (
            <Button
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/login');
              }}
            >
              Login to Enroll
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  };

  const renderGroup = (group: CourseGroup) => {
    const isExpanded = expandedGroups.has(group.mainCourse.title);
    const { mainCourse, subCourses } = group;

    return (
      <div key={mainCourse.id} className="mb-8">
        {/* Group Header — Main / Broad Course */}
        <div
          className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 cursor-pointer hover:shadow-md transition-shadow mb-1"
          onClick={() => toggleGroup(mainCourse.title)}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Layers className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-gray-900">{mainCourse.title}</h2>
                <Badge variant="secondary" className="text-xs">
                  {CATEGORY_LABELS[mainCourse.category] || mainCourse.category}
                </Badge>
                <Badge className={`text-xs ${DIFFICULTY_COLORS[mainCourse.difficulty_level]}`}>
                  {mainCourse.difficulty_level}
                </Badge>
              </div>
              <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{mainCourse.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 ml-4 flex-shrink-0">
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {subCourses.length} sub-course{subCourses.length !== 1 ? 's' : ''}
            </span>
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>

        {/* Sub-Courses Grid */}
        {isExpanded && subCourses.length > 0 && (
          <div className="pl-4 border-l-2 border-blue-100 ml-5 mt-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subCourses.map((sub) => renderSubCourseCard(sub))}
            </div>
          </div>
        )}

        {isExpanded && subCourses.length === 0 && (
          <div className="pl-4 border-l-2 border-blue-100 ml-5 mt-3">
            <p className="text-sm text-gray-400 italic py-3 px-2">No sub-topics yet for this course.</p>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 ml-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 ml-64 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchCourses}>Retry</Button>
          </div>
        </main>
      </div>
    );
  }

  const { filteredGroups, filteredOrphans, totalLearnable } = getFilteredGroups();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 ml-64">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <TrendingUp className="w-10 h-10 text-blue-600" />
                Popular Courses
              </h1>
              <p className="text-gray-600 text-lg">
                Discover the most popular courses across all categories
              </p>
            </div>

            {/* Create Course Button */}
            {isAuthenticated && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus className="w-5 h-5 mr-2" />
                    Create New Course
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                  <form onSubmit={handleCreateCourse}>
                    <DialogHeader>
                      <DialogTitle>Create New Course</DialogTitle>
                      <DialogDescription>
                        Fill in the details below to create a new course.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="title">Course Title *</Label>
                        <Input
                          id="title"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          placeholder="e.g., Full-Stack Web Development"
                          required
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="description">Description *</Label>
                        <textarea
                          id="description"
                          className="flex min-h-[120px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Describe what students will learn..."
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="category">Category *</Label>
                          <Select
                            value={formData.category}
                            onValueChange={(value) => setFormData({ ...formData, category: value as Course['category'] })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="difficulty">Difficulty Level *</Label>
                          <Select
                            value={formData.difficulty_level}
                            onValueChange={(value) => setFormData({ ...formData, difficulty_level: value as Course['difficulty_level'] })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="beginner">Beginner</SelectItem>
                              <SelectItem value="intermediate">Intermediate</SelectItem>
                              <SelectItem value="advanced">Advanced</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="duration">Estimated Duration (minutes) *</Label>
                        <Input
                          id="duration"
                          type="number"
                          min="30"
                          value={formData.estimated_duration}
                          onChange={(e) => setFormData({ ...formData, estimated_duration: parseInt(e.target.value) || 60 })}
                          required
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="thumbnail">Thumbnail URL (optional)</Label>
                        <Input
                          id="thumbnail"
                          type="url"
                          value={formData.thumbnail}
                          onChange={(e) => setFormData({ ...formData, thumbnail: e.target.value })}
                          placeholder="https://example.com/image.jpg"
                        />
                      </div>
                    </div>

                    {creating && planningStatus && (
                      <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-md">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{planningStatus}</span>
                      </div>
                    )}

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDialogOpen(false)}
                        disabled={creating}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={creating}>
                        {creating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Planning Course...
                          </>
                        ) : (
                          'Create Course'
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Filters */}
          <div className="mb-6 flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search courses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[240px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stats */}
          <div className="mb-6 text-gray-600">
            Showing {filteredGroups.length} course group{filteredGroups.length !== 1 ? 's' : ''} &middot; {totalLearnable} learnable topic{totalLearnable !== 1 ? 's' : ''}
          </div>

          {/* Course Groups */}
          {filteredGroups.length === 0 && filteredOrphans.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No courses found</h3>
              <p className="text-gray-600">
                {searchQuery || categoryFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Be the first to create a course!'}
              </p>
            </div>
          ) : (
            <>
              {filteredGroups.map((group) => renderGroup(group))}

              {/* Orphan sub-courses (no matching parent) */}
              {filteredOrphans.length > 0 && (
                <div className="mb-8">
                  <div
                    className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 cursor-pointer hover:shadow-md transition-shadow mb-1"
                    onClick={() => toggleGroup('__orphans__')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <BookOpen className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">Other Courses</h2>
                        <p className="text-sm text-gray-500">Standalone learnable topics</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">
                        {filteredOrphans.length} course{filteredOrphans.length !== 1 ? 's' : ''}
                      </span>
                      {expandedGroups.has('__orphans__') ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {expandedGroups.has('__orphans__') && (
                    <div className="pl-4 border-l-2 border-purple-100 ml-5 mt-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredOrphans.map((sub) => renderSubCourseCard(sub))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Assessment Dialog */}
      {selectedCourse && (
        <AssessmentDialog
          open={assessmentDialogOpen}
          onOpenChange={setAssessmentDialogOpen}
          courseId={selectedCourse.id}
          courseName={selectedCourse.title}
          onEnrollmentComplete={handleEnrollmentComplete}
        />
      )}
    </div>
  );
}
