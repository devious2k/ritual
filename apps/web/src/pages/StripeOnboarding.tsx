import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, CheckCircle, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import Button from '@/components/shared/Button';
import Badge from '@/components/shared/Badge';

interface ConnectStatus {
  accountId?: string;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

export default function StripeOnboarding() {
  const [searchParams] = useSearchParams();
  const returnStatus = searchParams.get('status'); // 'success' or 'refresh'
  const [redirecting, setRedirecting] = useState(false);

  const { data: status, isLoading } = useQuery<ConnectStatus>({
    queryKey: ['stripe', 'connect', 'status'],
    queryFn: () => api.get('/stripe/connect/status').then((r) => r.data),
  });

  async function startOnboarding() {
    setRedirecting(true);
    try {
      const { data } = await api.post('/stripe/connect/onboard');
      window.location.href = data.url;
    } catch {
      setRedirecting(false);
    }
  }

  return (
    <div>
      <Link
        to="/settings"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Settings
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-blue-500" />
          Stripe Connect Onboarding
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Connect your lodge to accept online payments for dues, dining, and donations
        </p>
      </div>

      {/* Return status messages */}
      {returnStatus === 'success' && (
        <div className="mb-6 p-4 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-sm font-medium text-green-800 dark:text-green-300">
              Onboarding information submitted successfully. Stripe is reviewing your details.
            </p>
          </div>
        </div>
      )}

      {returnStatus === 'refresh' && (
        <div className="mb-6 p-4 rounded-lg bg-forge-orange/10 border border-forge-orange/30">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-forge-orange" />
            <p className="text-sm font-medium text-forge-orange">
              Your onboarding session expired. Please click below to continue.
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Checking connection status...</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          {/* Status Overview */}
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <span className="text-sm text-gray-700 dark:text-gray-300">Account Created</span>
              {status?.accountId ? (
                <Badge variant="success">
                  <CheckCircle className="w-3 h-3 mr-1 inline" /> Yes
                </Badge>
              ) : (
                <Badge variant="default">Not Yet</Badge>
              )}
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <span className="text-sm text-gray-700 dark:text-gray-300">Details Submitted</span>
              {status?.detailsSubmitted ? (
                <Badge variant="success">
                  <CheckCircle className="w-3 h-3 mr-1 inline" /> Complete
                </Badge>
              ) : (
                <Badge variant="warning">Pending</Badge>
              )}
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <span className="text-sm text-gray-700 dark:text-gray-300">Charges Enabled</span>
              {status?.chargesEnabled ? (
                <Badge variant="success">
                  <CheckCircle className="w-3 h-3 mr-1 inline" /> Enabled
                </Badge>
              ) : (
                <Badge variant="default">Not Yet</Badge>
              )}
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <span className="text-sm text-gray-700 dark:text-gray-300">Payouts Enabled</span>
              {status?.payoutsEnabled ? (
                <Badge variant="success">
                  <CheckCircle className="w-3 h-3 mr-1 inline" /> Enabled
                </Badge>
              ) : (
                <Badge variant="default">Not Yet</Badge>
              )}
            </div>
          </div>

          {/* Action */}
          {status?.onboardingComplete ? (
            <div className="text-center p-6 rounded-lg bg-green-50 dark:bg-green-900/10">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-green-800 dark:text-green-300">
                Onboarding Complete
              </h3>
              <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                Your lodge is ready to accept online payments.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {status?.accountId
                  ? 'Your onboarding is not yet complete. Click below to continue where you left off.'
                  : 'Set up a Stripe connected account to accept online payments for your lodge.'}
              </p>
              <Button onClick={startOnboarding} loading={redirecting}>
                {status?.accountId ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-1" /> Continue Onboarding
                  </>
                ) : (
                  'Start Onboarding'
                )}
              </Button>
            </div>
          )}

          {status?.accountId && (
            <p className="text-xs text-gray-400 mt-4 text-center">
              Stripe Account ID: {status.accountId}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
