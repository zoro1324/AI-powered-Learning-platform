import { useState } from 'react';
import { Link } from 'react-router';
import { BookOpen, ArrowLeft, Mail, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // TODO: Implement actual Supabase password reset
    // For now, just show success message
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-[#f7f5f1] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Back Button */}
          <Link to="/" className="inline-flex items-center gap-2 text-neutral-600 hover:text-neutral-900 mb-4 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Login</span>
          </Link>

          {/* Success Card */}
          <div className="bg-white border border-neutral-200 rounded-3xl shadow-sm p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-6">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            
            <h2 className="text-2xl font-semibold text-neutral-900 mb-3">Check Your Email</h2>
            <p className="text-neutral-600 mb-6">
              We've sent a password reset link to <span className="font-medium text-neutral-900">{email}</span>
            </p>
            
            <div className="bg-neutral-100 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm text-neutral-900 mb-2">
                <strong>Next steps:</strong>
              </p>
              <ul className="text-sm text-neutral-800 space-y-1 list-disc list-inside">
                <li>Check your email inbox</li>
                <li>Click the reset link in the email</li>
                <li>Create a new password</li>
              </ul>
            </div>

            <Link
              to="/"
              className="inline-block w-full bg-neutral-900 text-white py-3 rounded-xl font-medium hover:bg-neutral-800 transition-all shadow-lg hover:shadow-xl"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f5f1] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back Button */}
        <Link to="/" className="inline-flex items-center gap-2 text-neutral-600 hover:text-neutral-900 mb-4 transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Login</span>
        </Link>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-900 rounded-full mb-4 shadow-md">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-semibold text-neutral-900 mb-2">LearnPath</h1>
          <p className="text-sm text-neutral-600">Securely recover access to your workspace.</p>
        </div>

        {/* Forgot Password Card */}
        <div className="bg-white border border-neutral-200 rounded-3xl shadow-sm p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-neutral-900 mb-2">Forgot Password?</h2>
            <p className="text-neutral-600">No worries! Enter your email and we'll send you a reset link.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:border-transparent transition-all"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full bg-neutral-900 text-white py-3 rounded-xl font-medium hover:bg-neutral-800 transition-all shadow-lg hover:shadow-xl"
            >
              Send Reset Link
            </button>
          </form>

          {/* Additional Help */}
          <div className="mt-6 text-center">
            <p className="text-neutral-600 text-sm">
              Remember your password?{' '}
              <Link to="/" className="text-neutral-700 hover:text-neutral-900 font-medium">
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
