import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { EmptyState, RequireAuth } from './components/ui.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { MetaProvider } from './context/MetaContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import BoardPage from './pages/BoardPage.jsx';
import ItemPage from './pages/ItemPage.jsx';
import ReportPage from './pages/ReportPage.jsx';
import { LoginPage, RegisterPage } from './pages/AuthPages.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ReviewClaimsPage from './pages/ReviewClaimsPage.jsx';
import HandoffPage from './pages/HandoffPage.jsx';
import './styles.css';

function NotFound() {
  return (
    <EmptyState
      title="This page doesn’t exist"
      action={
        <Link to="/" className="btn btn-primary">
          Go to the board
        </Link>
      }
    >
      The link may be old, or the item may have been removed.
    </EmptyState>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <MetaProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<BoardPage />} />
                <Route path="items/:id" element={<ItemPage />} />
                <Route path="login" element={<LoginPage />} />
                <Route path="register" element={<RegisterPage />} />
                <Route path="report" element={<RequireAuth><ReportPage /></RequireAuth>} />
                <Route path="dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
                <Route path="my/items/:id/claims" element={<RequireAuth><ReviewClaimsPage /></RequireAuth>} />
                <Route path="handoff/:claimId" element={<RequireAuth><HandoffPage /></RequireAuth>} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </MetaProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
