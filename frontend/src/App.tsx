import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth, RequireTenantRole } from '@/auth/RouteGuards';
import { useAuth } from '@/auth/AuthContext';
import { PageSpinner } from '@/components/ui';
import { PublicLayout } from '@/components/PublicLayout';
import { LandingPage } from '@/pages/LandingPage';
import { DemoPage } from '@/pages/DemoPage';
import { AbroadPage } from '@/pages/AbroadPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { BusinessPage } from '@/pages/business/BusinessPage';
import { BookingFlow } from '@/pages/business/BookingFlow';
import { BookingSuccessPage } from '@/pages/business/BookingSuccessPage';
import { QueuePage } from '@/pages/business/QueuePage';
import { MyBookingsPage } from '@/pages/my/MyBookingsPage';
import { CreateBusinessPage } from '@/pages/CreateBusinessPage';

const DisplayBoard = lazy(() => import('@/pages/business/DisplayBoard'));
const DashboardLayout = lazy(() => import('@/pages/dashboard/DashboardLayout'));
const OverviewPage = lazy(() => import('@/pages/dashboard/OverviewPage'));
const CalendarPage = lazy(() => import('@/pages/dashboard/CalendarPage'));
const QueueConsolePage = lazy(() => import('@/pages/dashboard/QueueConsolePage'));
const ServicesPage = lazy(() => import('@/pages/dashboard/ServicesPage'));
const StaffPage = lazy(() => import('@/pages/dashboard/StaffPage'));
const BlackoutsPage = lazy(() => import('@/pages/dashboard/BlackoutsPage'));
const SettingsPage = lazy(() => import('@/pages/dashboard/SettingsPage'));
const AuditLogPage = lazy(() => import('@/pages/dashboard/AuditLogPage'));

function DashboardRedirect() {
  const { memberships } = useAuth();
  if (memberships.length === 0) {
    return <Navigate to="/start" replace />;
  }
  return <Navigate to={`/dashboard/${memberships[0].tenantSlug}`} replace />;
}

const ownerOnly = (element: JSX.Element) => (
  <RequireTenantRole roles={['OWNER']}>{element}</RequireTenantRole>
);

export function App() {
  return (
    <Suspense fallback={<PageSpinner label="Loading" />}>
      <Routes>
        <Route path="/b/:slug/display" element={<DisplayBoard />} />
        <Route element={<PublicLayout />}>
          <Route index element={<LandingPage />} />
          <Route path="demo" element={<DemoPage />} />
          <Route path="abroad" element={<AbroadPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="b/:slug" element={<BusinessPage />} />
          <Route path="b/:slug/book" element={<BookingFlow />} />
          <Route path="b/:slug/book/success" element={<BookingSuccessPage />} />
          <Route path="b/:slug/queue" element={<QueuePage />} />
          <Route
            path="my/bookings"
            element={
              <RequireAuth>
                <MyBookingsPage />
              </RequireAuth>
            }
          />
          <Route
            path="start"
            element={
              <RequireAuth>
                <CreateBusinessPage />
              </RequireAuth>
            }
          />
          <Route
            path="dashboard"
            element={
              <RequireAuth>
                <DashboardRedirect />
              </RequireAuth>
            }
          />
        </Route>
        <Route
          path="/dashboard/:slug"
          element={
            <RequireAuth>
              <RequireTenantRole roles={['OWNER', 'STAFF']}>
                <DashboardLayout />
              </RequireTenantRole>
            </RequireAuth>
          }
        >
          <Route index element={<OverviewPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="queue" element={<QueueConsolePage />} />
          <Route path="blackouts" element={<BlackoutsPage />} />
          <Route path="services" element={ownerOnly(<ServicesPage />)} />
          <Route path="staff" element={ownerOnly(<StaffPage />)} />
          <Route path="settings" element={ownerOnly(<SettingsPage />)} />
          <Route path="audit" element={ownerOnly(<AuditLogPage />)} />
        </Route>
        <Route element={<PublicLayout />}>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
