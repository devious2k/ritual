import { Link } from 'react-router-dom';
import { Home, KeyRound } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 mb-6">
        <KeyRound className="w-8 h-8 text-slate-400" />
      </div>
      <h1 className="text-6xl font-bold text-blue-900 mb-3">404</h1>
      <p className="text-lg text-slate-600 mb-2">Page not found</p>
      <p className="text-sm text-slate-400 mb-8 max-w-sm">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-800 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
      >
        <Home className="w-4 h-4" />
        Back to Dashboard
      </Link>
    </div>
  );
}
