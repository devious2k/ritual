import { Link } from 'react-router-dom';
import { CheckCircle2, Home, KeyRound } from 'lucide-react';

export default function PaymentSuccess() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-4">
      <div className="w-full max-w-md text-center">
        {/* Branding */}
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg mb-6">
          <KeyRound className="w-6 h-6 text-slate-900" />
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-5">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-2">Payment Successful</h1>
          <p className="text-sm text-slate-500 mb-8 max-w-xs mx-auto">
            Thank you for your payment. A confirmation has been sent to your email address.
          </p>

          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-800 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
          >
            <Home className="w-4 h-4" />
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
