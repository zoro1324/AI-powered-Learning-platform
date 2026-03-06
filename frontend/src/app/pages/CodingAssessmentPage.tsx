import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Code2, Loader2, Play, Send } from 'lucide-react';
import { codingAPI } from '../../services/api';
import type { CodingProblem, CodeSubmission } from '../../types/api';
import { Button } from '../components/ui/button';

export default function CodingAssessmentPage() {
  const navigate = useNavigate();
  const { enrollmentId, moduleIndex, topicIndex, problemId } = useParams();
  const eId = enrollmentId ? parseInt(enrollmentId, 10) : null;
  const pId = problemId ? parseInt(problemId, 10) : null;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<CodingProblem | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<CodeSubmission | null>(null);

  useEffect(() => {
    if (!pId) {
      setError('Invalid coding assessment id');
      setLoading(false);
      return;
    }

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await codingAPI.getProblem(pId);
        setProblem(data);
        setCode(data.starter_code || 'def solve(raw_input: str) -> str:\n    return ""\n');
      } catch (err: any) {
        setError(err?.response?.data?.error || err?.message || 'Failed to load coding assessment');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [pId]);

  const testResults = useMemo(() => {
    const raw = submission?.feedback?.test_results;
    return Array.isArray(raw) ? raw : [];
  }, [submission]);

  const handleRun = async () => {
    if (!eId || !pId || !code.trim()) {
      setError('Enrollment, problem, and source code are required');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await codingAPI.submitCode({
        enrollment_id: eId,
        problem_id: pId,
        source_code: code,
        language: 'python',
      });
      setSubmission(result.submission);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to run code');
    } finally {
      setSubmitting(false);
    }
  };

  const backPath =
    eId !== null && moduleIndex !== undefined && topicIndex !== undefined
      ? `/course/${eId}/module/${moduleIndex}/topic/${topicIndex}`
      : '/modules';

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate(backPath)} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Topic
          </Button>
          <div className="text-xs text-gray-500">
            Model: <span className="font-medium">qwen2.5-coder:7b</span>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 flex items-center justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-cyan-600" />
          </div>
        ) : error && !problem ? (
          <div className="bg-white rounded-2xl border border-red-200 p-6 text-red-700">{error}</div>
        ) : problem ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center">
                  <Code2 className="w-5 h-5 text-cyan-700" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">{problem.title}</h1>
                  <p className="text-sm text-gray-500">Difficulty: {problem.difficulty}</p>
                </div>
              </div>

              <div>
                <h2 className="text-sm font-semibold text-gray-800 mb-2">Problem</h2>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{problem.problem_statement}</p>
              </div>

              {problem.constraints && Object.keys(problem.constraints).length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-800 mb-2">Constraints</h2>
                  <pre className="bg-gray-100 rounded-lg p-3 text-xs text-gray-700 overflow-x-auto">
                    <code>{JSON.stringify(problem.constraints, null, 2)}</code>
                  </pre>
                </div>
              )}

              {problem.test_cases?.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-800 mb-2">Sample Tests</h2>
                  <div className="space-y-2">
                    {problem.test_cases.map((test, idx) => (
                      <div key={test.id} className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                        <p className="text-xs text-gray-500 font-medium mb-1">Case {idx + 1}</p>
                        <p className="text-xs text-gray-700"><span className="font-semibold">Input:</span> {test.input_data || '(empty)'}</p>
                        <p className="text-xs text-gray-700"><span className="font-semibold">Expected:</span> {test.expected_output || '(empty)'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800">Compiler (Python)</h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCode(problem.starter_code || '')}
                  >
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleRun}
                    disabled={submitting || !code.trim()}
                    className="gap-2"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    Run Tests
                  </Button>
                </div>
              </div>

              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                title="Python code editor"
                placeholder="Write your solve(raw_input: str) function here"
                className="w-full h-[380px] resize-y rounded-xl border border-gray-200 bg-[#0b1220] text-[#e6edf3] p-4 font-mono text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                spellCheck={false}
              />

              <Button
                onClick={handleRun}
                disabled={submitting || !code.trim()}
                className="w-full gap-2 bg-cyan-600 hover:bg-cyan-700"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Submit Solution
              </Button>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
              )}

              {submission && (
                <div className="rounded-xl border border-gray-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-800">Result</p>
                    <p className="text-sm text-gray-600">
                      {submission.passed_tests}/{submission.total_tests} passed ({submission.score_percent}%)
                    </p>
                  </div>

                  {testResults.length > 0 && (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {testResults.map((t: any, idx: number) => (
                        <div
                          key={`${t.test_case_id}-${idx}`}
                          className={`rounded-lg border p-2 text-xs ${t.passed ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}
                        >
                          <p className="font-medium">Test {idx + 1}: {t.passed ? 'Passed' : 'Failed'}</p>
                          {!t.passed && t.error_message && <p className="mt-1">Error: {t.error_message}</p>}
                          {!t.is_hidden && t.actual_output !== undefined && (
                            <p className="mt-1">Actual: {t.actual_output || '(empty)'}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
