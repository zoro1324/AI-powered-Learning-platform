import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router';
import { Eye, EyeOff, BookOpen, ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

/**
 * Parse Django REST Framework field-level validation errors into readable strings.
 * Django returns errors like: { email: ["already exists"], password: ["too short", "must contain a number"] }
 */
function parseApiErrors(error: any): string[] {
  if (!error) return [];
  if (typeof error === 'string') return [error];
  if (error.detail) return [error.detail];

  const messages: string[] = [];
  for (const [field, fieldErrors] of Object.entries(error)) {
    if (field === 'non_field_errors') {
      // Non-field errors are general errors not tied to a specific field
      if (Array.isArray(fieldErrors)) {
        messages.push(...fieldErrors.map(String));
      } else {
        messages.push(String(fieldErrors));
      }
    } else {
      const label = field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' ');
      if (Array.isArray(fieldErrors)) {
        fieldErrors.forEach((msg) => messages.push(`${label}: ${msg}`));
      } else {
        messages.push(`${label}: ${fieldErrors}`);
      }
    }
  }
  return messages.length > 0 ? messages : ['Registration failed. Please try again.'];
}

export default function SignUpPage() {
  const navigate = useNavigate();
  const { handleRegister, isAuthenticated, loading, error, clearAuthError } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    // Redirect if already authenticated
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    // Clear error when component unmounts
    return () => {
      clearAuthError();
    };
  }, [clearAuthError]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');
    clearAuthError();

    if (formData.password !== formData.confirmPassword) {
      setValidationError('Passwords do not match!');
      return;
    }

    if (formData.password.length < 8) {
      setValidationError('Password must be at least 8 characters long!');
      return;
    }

    const result = await handleRegister({
      first_name: formData.firstName,
      last_name: formData.lastName,
      email: formData.email,
      password: formData.password,
      password2: formData.confirmPassword,
    });

    if (result.meta.requestStatus === 'fulfilled') {
      navigate('/dashboard');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const errorMessages = error ? parseApiErrors(error) : [];

  return (
    <div className="min-h-screen bg-[#f7f5f1] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back Button */}
        <Link to="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Login</span>
        </Link>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-900 rounded-full mb-4 shadow-md">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-semibold text-neutral-900 mb-2">LearnPath</h1>
          <p className="text-sm text-neutral-600">Build your learning identity.</p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-3xl shadow-sm p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Create Account</h2>
            <p className="text-gray-600">Start your personalized learning journey today</p>
          </div>

          {/* Error Messages */}
          {(errorMessages.length > 0 || validationError) && (
            <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">
                {validationError ? (
                  <p>{validationError}</p>
                ) : errorMessages.length === 1 ? (
                  <p>{errorMessages[0]}</p>
                ) : (
                  <ul className="list-disc pl-4 space-y-1">
                    {errorMessages.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSignUp} className="space-y-5">
            {/* First Name Input */}
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                First Name
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="Enter your first name"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                required
              />
            </div>

            {/* Last Name Input */}
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                Last Name
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Enter your last name"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                required
              />
            </div>

            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                required
              />
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Create a password"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password Input */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm your password"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Sign Up Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-xl font-medium hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Already have an account?{' '}
              <Link to="/" className="text-blue-600 hover:text-blue-700 font-medium">
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
