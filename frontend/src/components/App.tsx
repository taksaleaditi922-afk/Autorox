import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Layout from '../layouts/Layout';
import ProtectedRoute from './ProtectedRoute';
import Login from '../pages/Login/Login';
import Dashboard from '../pages/Dashboard/Dashboard';
import JobCards from '../pages/JobCards/JobCards';
import JobCardForm from '../pages/JobCardForm/JobCardForm';
import JobCardDetails from '../pages/JobCardDetails/JobCardDetails';
import Estimates from '../pages/Estimates/Estimates';
import Customers from '../pages/Customers/Customers';
import Advisors from '../pages/Advisors/Advisors';
import Vehicles from '../pages/Vehicles/Vehicles';
import Reports from '../pages/Reports/Reports';
import Inventory from '../pages/Inventory/Inventory';
import Settings from '../pages/Settings/Settings';
import SellProducts from '../pages/SellProducts/SellProducts';
import BillDetails from '../pages/BillDetails/BillDetails';
import Toast from './Toast';

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
      <Routes>
        <Route path="/login" element={isAuth ? <Navigate to="/" replace /> : <Login />} />
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
    </>
  );
}