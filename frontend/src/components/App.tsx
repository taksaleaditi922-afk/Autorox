import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Layout from '../layouts/Layout';
import ProtectedRoute from './ProtectedRoute';
import Toast from './Toast';
import ErrorBoundary from './ErrorBoundary';
import Loader from './Loader';

// Pages load on demand. Shipping every screen in the first bundle made the
// app — and the estimate workflow in particular — slow to become interactive.
const Login = lazy(() => import('../pages/Login/Login'));
// Customer-facing approval page — opened from a link, so it must render without a session.
const PublicApproval = lazy(() => import('../pages/PublicApproval/PublicApproval'));
const Dashboard = lazy(() => import('../pages/Dashboard/Dashboard'));
const JobCards = lazy(() => import('../pages/JobCards/JobCards'));
const JobCardForm = lazy(() => import('../pages/JobCardForm/JobCardForm'));
const JobCardDetails = lazy(() => import('../pages/JobCardDetails/JobCardDetails'));
const Estimates = lazy(() => import('../pages/Estimates/Estimates'));
const EstimateWizard = lazy(() => import('../pages/EstimateWizard/EstimateWizard'));
const Customers = lazy(() => import('../pages/Customers/Customers'));
const Advisors = lazy(() => import('../pages/Advisors/Advisors'));
const Vehicles = lazy(() => import('../pages/Vehicles/Vehicles'));
const Reports = lazy(() => import('../pages/Reports/Reports'));
const Inventory = lazy(() => import('../pages/Inventory/Inventory'));
const Settings = lazy(() => import('../pages/Settings/Settings'));
const SellProducts = lazy(() => import('../pages/SellProducts/SellProducts'));
const BillDetails = lazy(() => import('../pages/BillDetails/BillDetails'));

export default function App() {
  const isAuth = useSelector((state) => state.auth.isAuthenticated);
  const lang = useSelector((state) => state.language.lang);

  // Reflect the selected language on <html> and flip direction for RTL locales.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  return (
    <>
      <Toast />
      {/* A crash inside a page keeps the shell usable instead of blanking the app. */}
      <ErrorBoundary>
        <Suspense fallback={<Loader label="Loading…" />}>
          <Routes>
            <Route path="/login" element={isAuth ? <Navigate to="/" replace /> : <Login />} />
            {/* No ProtectedRoute: the token in the URL is the credential. */}
            <Route path="/approval/:token" element={<PublicApproval />} />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/jobcards" element={<JobCards />} />
              <Route path="/jobcards/new" element={<JobCardForm />} />
              <Route path="/jobcards/:id" element={<JobCardDetails />} />
              <Route path="/jobcards/:id/edit" element={<JobCardForm />} />
              <Route path="/estimates" element={<Estimates />} />
              <Route path="/estimates/new" element={<EstimateWizard />} />
              <Route path="/estimates/:id" element={<EstimateWizard />} />
              <Route path="/estimates/:id/edit" element={<EstimateWizard />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/vehicles" element={<Vehicles />} />
              <Route path="/advisors" element={<Advisors />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/sell" element={<SellProducts />} />
              <Route path="/sell/:id" element={<BillDetails />} />
              <Route path="/sell/:id/edit" element={<BillDetails />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  );
}