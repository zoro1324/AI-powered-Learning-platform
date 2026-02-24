import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Sidebar } from '../components/Sidebar';
import AssessmentDialog from '../components/AssessmentDialog';
import {
    BookOpen,
    Clock,
    ChevronDown,
    ChevronRight,
    Loader2,
    ArrowLeft,
    GraduationCap,
    Layers,
    Brain,
    Hammer,
    BookMarked,
    Sparkles,
    CheckCircle,
    AlertCircle,
    Users,
} from 'lucide-react';
import { useAppSelector } from '../../store';
import { courseAPI, PublicCurriculum } from '../../services/api';
import { Course } from '../../types/api';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader } from '../components/ui/card';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

const DIFFICULTY_COLORS: Record<string, string> = {
    beginner: 'bg-green-100 text-green-800',
    intermediate: 'bg-yellow-100 text-yellow-800',
    advanced: 'bg-red-100 text-red-800',
};

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

const STUDY_METHOD_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    real_world: { label: 'Real-world Examples', icon: Hammer, color: 'text-orange-600 bg-orange-50' },
    theory_depth: { label: 'Theory & Depth', icon: BookMarked, color: 'text-purple-600 bg-purple-50' },
    project_based: { label: 'Project-Based', icon: Layers, color: 'text-blue-600 bg-blue-50' },
    custom: { label: 'Custom', icon: Sparkles, color: 'text-pink-600 bg-pink-50' },
};

const KNOWLEDGE_LEVEL_COLORS: Record<string, string> = {
    none: 'bg-gray-100 text-gray-700',
    basic: 'bg-green-100 text-green-700',
    beginner: 'bg-green-100 text-green-700',
    intermediate: 'bg-yellow-100 text-yellow-700',
    advanced: 'bg-red-100 text-red-700',
};

// ─────────────────────────────────────────────────────────
// Curriculum Card
// ─────────────────────────────────────────────────────────

interface CurriculumCardProps {
    curriculum: PublicCurriculum;
    index: number;
    courseId: number;
    isAuthenticated: boolean;
    onEnrolled: (enrollmentId: number) => void;
}

function CurriculumCard({ curriculum, index, courseId, isAuthenticated, onEnrolled }: CurriculumCardProps) {
    const navigate = useNavigate();
    const [expanded, setExpanded] = useState(index === 0); // first card open by default
    const [enrolling, setEnrolling] = useState(false);
    const [enrolled, setEnrolled] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const studyMeta = STUDY_METHOD_LABELS[curriculum.study_method] || {
        label: curriculum.study_method,
        icon: BookOpen,
        color: 'text-blue-600 bg-blue-50',
    };
    const StudyIcon = studyMeta.icon;

    const handleRegister = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }
        try {
            setEnrolling(true);
            setError(null);
            const result = await courseAPI.enrollWithSyllabus(courseId, curriculum.enrollment_id);
            setEnrolled(true);
            setTimeout(() => onEnrolled(result.enrollment_id), 800);
        } catch (err: any) {
            const msg =
                err?.response?.data?.error ||
                err?.response?.data?.detail ||
                'Failed to enroll. Please try again.';
            setError(msg);
        } finally {
            setEnrolling(false);
        }
    };

    return (
        <Card className="border border-gray-200 hover:shadow-lg transition-shadow overflow-hidden">
            {/* Card Header — always visible */}
            <CardHeader
                className="cursor-pointer select-none"
                onClick={() => setExpanded((v) => !v)}
            >
                <div className="flex items-start justify-between gap-4">
                    {/* Left: badges + stats */}
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                            {/* Knowledge Level */}
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${KNOWLEDGE_LEVEL_COLORS[curriculum.knowledge_level] || 'bg-gray-100 text-gray-700'}`}>
                                <Brain className="w-3 h-3" />
                                {curriculum.knowledge_level.charAt(0).toUpperCase() + curriculum.knowledge_level.slice(1)} level
                            </span>
                            {/* Study Method */}
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${studyMeta.color}`}>
                                <StudyIcon className="w-3 h-3" />
                                {studyMeta.label}
                            </span>
                        </div>

                        {/* Stats row */}
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                                <Layers className="w-4 h-4 text-blue-500" />
                                {curriculum.total_modules} modules
                            </span>
                            <span className="flex items-center gap-1">
                                <BookOpen className="w-4 h-4 text-purple-500" />
                                {curriculum.total_topics} topics
                            </span>
                        </div>
                    </div>

                    {/* Right: chevron */}
                    <div className="flex-shrink-0 mt-1">
                        {expanded
                            ? <ChevronDown className="w-5 h-5 text-gray-400" />
                            : <ChevronRight className="w-5 h-5 text-gray-400" />}
                    </div>
                </div>
            </CardHeader>

            {/* Expanded: module + topic list */}
            {expanded && (
                <CardContent className="pt-0">
                    <div className="border-t border-gray-100 pt-4 space-y-4">
                        {curriculum.modules.map((mod, mIdx) => (
                            <div key={mIdx} className="rounded-lg bg-gray-50 border border-gray-100 overflow-hidden">
                                {/* Module header */}
                                <div className="flex items-start gap-3 px-4 py-3 bg-white border-b border-gray-100">
                                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                                        {mIdx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-gray-900 text-sm">{mod.module_name}</p>
                                        {mod.description && (
                                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{mod.description}</p>
                                        )}
                                        <div className="flex items-center gap-3 mt-1.5">
                                            {mod.difficulty_level && (
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFFICULTY_COLORS[mod.difficulty_level] || 'bg-gray-100 text-gray-700'}`}>
                                                    {mod.difficulty_level}
                                                </span>
                                            )}
                                            {mod.estimated_duration_minutes > 0 && (
                                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {mod.estimated_duration_minutes} min
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Topics */}
                                {mod.topics.length > 0 && (
                                    <ul className="divide-y divide-gray-100">
                                        {mod.topics.map((topic, tIdx) => (
                                            <li key={tIdx} className="flex items-start gap-2 px-4 py-2.5">
                                                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-400 mt-2" />
                                                <div>
                                                    <p className="text-sm text-gray-800 font-medium">{topic.topic_name}</p>
                                                    {topic.description && (
                                                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{topic.description}</p>
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mt-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Register CTA */}
                    <div className="mt-5">
                        {enrolled ? (
                            <div className="flex items-center gap-2 text-green-600 font-medium text-sm">
                                <CheckCircle className="w-5 h-5" />
                                Enrolled! Redirecting…
                            </div>
                        ) : (
                            <Button
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={handleRegister}
                                disabled={enrolling}
                            >
                                {enrolling ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Enrolling…
                                    </>
                                ) : (
                                    <>
                                        <GraduationCap className="w-4 h-4 mr-2" />
                                        Register with this Curriculum
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </CardContent>
            )}
        </Card>
    );
}

// ─────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────

export default function CourseDetailsPage() {
    const { courseId } = useParams<{ courseId: string }>();
    const navigate = useNavigate();
    const { isAuthenticated } = useAppSelector((state) => state.auth);

    const [course, setCourse] = useState<Course | null>(null);
    const [curricula, setCurricula] = useState<PublicCurriculum[]>([]);
    const [loading, setLoading] = useState(true);
    const [curricula_loading, setCurriculaLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Own-assessment dialog
    const [assessmentOpen, setAssessmentOpen] = useState(false);

    const id = Number(courseId);

    useEffect(() => {
        if (!id) return;
        const fetchAll = async () => {
            try {
                setLoading(true);
                const courseData = await courseAPI.get(id);
                setCourse(courseData);
                setError(null);
            } catch {
                setError('Failed to load course details.');
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, [id]);

    useEffect(() => {
        if (!id) return;
        const fetchCurricula = async () => {
            try {
                setCurriculaLoading(true);
                const result = await courseAPI.getPublicSyllabi(id);
                setCurricula(result.curricula || []);
            } catch {
                // Silently handle — curricula section just shows empty state
            } finally {
                setCurriculaLoading(false);
            }
        };
        fetchCurricula();
    }, [id]);

    const handleEnrolled = (enrollmentId: number) => {
        navigate(`/course/${enrollmentId}`);
    };

    const handleOwnAssessmentComplete = (enrollmentId: number) => {
        navigate(`/course/${enrollmentId}`);
    };

    // ── Loading ──────────────────────────────────────────
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

    // ── Error ────────────────────────────────────────────
    if (error || !course) {
        return (
            <div className="flex min-h-screen bg-gray-50">
                <Sidebar />
                <main className="flex-1 ml-64 flex items-center justify-center">
                    <div className="text-center">
                        <p className="text-red-600 mb-4">{error || 'Course not found.'}</p>
                        <Button onClick={() => navigate('/courses/popular')}>← Back to courses</Button>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-gray-50">
            <Sidebar />

            <main className="flex-1 ml-64">
                {/* Hero */}
                <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700 text-white">
                    {/* Thumbnail overlay */}
                    {course.thumbnail && (
                        <div className="absolute inset-0 overflow-hidden opacity-15">
                            <img src={course.thumbnail} alt="" className="w-full h-full object-cover" />
                        </div>
                    )}

                    <div className="relative z-10 p-8">
                        {/* Back button */}
                        <button
                            onClick={() => navigate(-1)}
                            className="flex items-center gap-2 text-blue-200 hover:text-white mb-6 transition-colors text-sm"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </button>

                        {/* Badges */}
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                            <Badge className="bg-white/20 text-white border-0 text-xs">
                                {CATEGORY_LABELS[course.category] || course.category}
                            </Badge>
                            <Badge className="bg-white/20 text-white border-0 text-xs capitalize">
                                {course.difficulty_level}
                            </Badge>
                            {course.estimated_duration > 0 && (
                                <Badge className="bg-white/20 text-white border-0 text-xs flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {course.estimated_duration} min
                                </Badge>
                            )}
                        </div>

                        {/* Title + description */}
                        <h1 className="text-4xl font-bold mb-3 leading-tight">{course.title}</h1>
                        {course.description && (
                            <p className="text-blue-100 text-lg max-w-2xl leading-relaxed">{course.description}</p>
                        )}

                        {/* Enroll your own way */}
                        {isAuthenticated ? (
                            <div className="mt-8">
                                <Button
                                    className="bg-white text-blue-700 hover:bg-blue-50 font-semibold px-6 py-3 h-auto text-base shadow-lg"
                                    onClick={() => setAssessmentOpen(true)}
                                >
                                    <Sparkles className="w-5 h-5 mr-2" />
                                    Enroll & Get My Personalized Curriculum
                                </Button>
                                <p className="text-blue-200 text-sm mt-2">
                                    Take a short assessment and we'll build a curriculum just for you
                                </p>
                            </div>
                        ) : (
                            <div className="mt-8">
                                <Button
                                    className="bg-white text-blue-700 hover:bg-blue-50 font-semibold px-6 py-3 h-auto text-base shadow-lg"
                                    onClick={() => navigate('/login')}
                                >
                                    <GraduationCap className="w-5 h-5 mr-2" />
                                    Login to Enroll
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Curricula Section */}
                <div className="p-8">
                    <div className="max-w-4xl mx-auto">
                        <div className="mb-6 flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                                <Users className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Community Curricula</h2>
                                <p className="text-gray-500 text-sm">
                                    Browse learning plans created by other students — use one as your starting point
                                </p>
                            </div>
                        </div>

                        {/* Loading curricula */}
                        {curricula_loading && (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                            </div>
                        )}

                        {/* Empty state */}
                        {!curricula_loading && curricula.length === 0 && (
                            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <BookOpen className="w-8 h-8 text-blue-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">No curricula yet</h3>
                                <p className="text-gray-500 max-w-sm mx-auto text-sm">
                                    Be the first to enroll in this course and your curriculum will appear here for others to discover.
                                </p>
                                {isAuthenticated && (
                                    <Button
                                        className="mt-6 bg-blue-600 hover:bg-blue-700 text-white"
                                        onClick={() => setAssessmentOpen(true)}
                                    >
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Create the first curriculum
                                    </Button>
                                )}
                            </div>
                        )}

                        {/* Curricula cards */}
                        {!curricula_loading && curricula.length > 0 && (
                            <div className="space-y-4">
                                {curricula.map((curriculum, idx) => (
                                    <CurriculumCard
                                        key={curriculum.enrollment_id}
                                        curriculum={curriculum}
                                        index={idx}
                                        courseId={id}
                                        isAuthenticated={isAuthenticated}
                                        onEnrolled={handleEnrolled}
                                    />
                                ))}

                                {/* Divider + own enrollment prompt */}
                                <div className="mt-8 pt-6 border-t border-gray-200 text-center">
                                    <p className="text-gray-500 text-sm mb-3">
                                        Want a curriculum tailored specifically to you?
                                    </p>
                                    {isAuthenticated ? (
                                        <Button
                                            variant="outline"
                                            className="border-blue-300 text-blue-700 hover:bg-blue-50"
                                            onClick={() => setAssessmentOpen(true)}
                                        >
                                            <Sparkles className="w-4 h-4 mr-2" />
                                            Get My Personalized Curriculum
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            className="border-blue-300 text-blue-700 hover:bg-blue-50"
                                            onClick={() => navigate('/login')}
                                        >
                                            Login to enroll
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Assessment Dialog (own curriculum) */}
            {course && (
                <AssessmentDialog
                    open={assessmentOpen}
                    onOpenChange={setAssessmentOpen}
                    courseId={course.id}
                    courseName={course.title}
                    onEnrollmentComplete={handleOwnAssessmentComplete}
                />
            )}
        </div>
    );
}
