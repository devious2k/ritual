import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import MemberProfile from './pages/MemberProfile';
import Meetings from './pages/Meetings';
import MeetingDetail from './pages/MeetingDetail';
import Ceremonies from './pages/Ceremonies';
import CeremonyWizard from './pages/CeremonyWizard';
import Dining from './pages/Dining';
import Settings from './pages/Settings';
import MemberArea from './pages/MemberArea';
import StripeOnboarding from './pages/StripeOnboarding';
import PaymentSuccess from './pages/PaymentSuccess';
import PublicLodgeSite from './pages/PublicLodgeSite';
import Lodges from './pages/Lodges';
import LodgeDetail from './pages/LodgeDetail';
import TenantGate from './pages/TenantGate';
import PublicRsvp from './pages/PublicRsvp';
import Treasurer from './pages/Treasurer';
import Incus from './pages/Incus';
import Events from './pages/Events';
import { isTenantSubdomain } from './lib/subdomain';
import NotFound from './pages/NotFound';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const onTenantSubdomain = isTenantSubdomain();

  return (
    <Routes>
      <Route path="/site/:lodgeId" element={<PublicLodgeSite />} />
      <Route path="/rsvp/:token" element={<PublicRsvp />} />
      {onTenantSubdomain && <Route path="/" element={<TenantGate />} />}
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/payment-success" element={<PaymentSuccess />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/members" element={<Members />} />
                <Route path="/members/:id" element={<MemberProfile />} />
                <Route path="/meetings" element={<Meetings />} />
                <Route path="/meetings/:id" element={<MeetingDetail />} />
                <Route path="/ceremonies" element={<Ceremonies />} />
                <Route path="/ceremonies/:id/plan" element={<CeremonyWizard />} />
                <Route path="/dining" element={<Dining />} />
                <Route path="/member-area" element={<MemberArea />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/settings/payments" element={<StripeOnboarding />} />
                <Route path="/lodges" element={<Lodges />} />
                <Route path="/lodges/new" element={<Lodges />} />
                <Route path="/lodges/:id" element={<LodgeDetail />} />
                <Route path="/summons" element={<Navigate to="/meetings" replace />} />
                <Route path="/candidates" element={<Navigate to="/ceremonies" replace />} />
                <Route path="/degrees" element={<Navigate to="/ceremonies" replace />} />
                <Route path="/officers" element={<Navigate to="/members" replace />} />
                <Route path="/finance" element={<Treasurer />} />
                <Route path="/treasurer" element={<Navigate to="/finance" replace />} />
                <Route path="/incus" element={<Incus />} />
                <Route path="/events" element={<Events />} />
                <Route path="/dues" element={<Navigate to="/dining" replace />} />
                <Route path="/charity" element={<Navigate to="/" replace />} />
                <Route path="/almoner" element={<Navigate to="/" replace />} />
                <Route path="/visitors" element={<Navigate to="/" replace />} />
                <Route path="/correspondence" element={<Navigate to="/" replace />} />
                <Route path="/equipment" element={<Navigate to="/" replace />} />
                <Route path="/honours" element={<Navigate to="/" replace />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
