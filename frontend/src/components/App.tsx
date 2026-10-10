import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setUnauthenticated } from '../redux/authSlice';
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
const PartOrders = lazy(() => import('../pages/PartOrders/PartOrders'));
const CreateBulkOrder = lazy(() => import('../pages/PartOrders/CreateBulkOrder'));
const AddPartPage = lazy(() => import('../pages/Inventory/AddPartPage'));
const Settings = lazy(() => import('../pages/Settings/Settings'));
const SellProducts = lazy(() => import('../pages/SellProducts/SellProducts'));
const CounterSaleWizard = lazy(() => import('../pages/CounterSale/CounterSaleWizard'));
const BillDetails = lazy(() => import('../pages/BillDetails/BillDetails'));

export default function App() {
  const dispatch = useAppDispatch();
  const isAuth = useAppSelector((state) => state.auth.isAuthenticated);
  const lang = useAppSelector((state) => state.language.lang);

  // The API client owns token refreshes. If refresh is impossible (for
  // example, an old access token remains but its cookie has expired), keep
  // Redux in sync with cleared storage so ProtectedRoute returns to login.
  useEffect(() => {
    const handleSessionExpired = () => dispatch(setUnauthenticated());
    window.addEventListener('auth:logout', handleSessionExpired);

    return () => window.removeEventListener('auth:logout', handleSessionExpired);
  }, [dispatch]);

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
              <Route path="/inventory/add" element={<AddPartPage />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/part-orders" element={<PartOrders />} />
              <Route path="/part-orders/bulk/new" element={<CreateBulkOrder />} />
              <Route path="/part-orders/bulk/:id/edit" element={<CreateBulkOrder />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/counter-sale" element={<SellProducts />} />
              <Route path="/counter-sale/new" element={<CounterSaleWizard />} />
              <Route path="/counter-sale/:id" element={<BillDetails />} />
              <Route path="/counter-sale/:id/edit" element={<CounterSaleWizard />} />
              <Route path="/sell" element={<Navigate to="/counter-sale" replace />} />
              <Route path="/sell/:id" element={<Navigate to="/counter-sale" replace />} />
              <Route path="/sell/:id/edit" element={<Navigate to="/counter-sale" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  );
}
