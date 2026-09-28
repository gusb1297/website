import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { SettingsProvider } from './context/SettingsContext';
import { ToastProvider } from './context/ToastContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ScrollToTop } from './components/ScrollToTop';

import { Home } from './pages/Home';
import { About } from './pages/About';
import { Governance } from './pages/Governance';
import { Programs } from './pages/Programs';
import { ProgramDetail } from './pages/ProgramDetail';
import { Publications } from './pages/Publications';
import { Gallery } from './pages/Gallery';
import { News } from './pages/News';
import { NewsDetail } from './pages/NewsDetail';
import { Career } from './pages/Career';
import { Notice } from './pages/Notice';
import { Contact } from './pages/Contact';

import { AdminLogin } from './admin/AdminLogin';
import { Dashboard } from './admin/Dashboard';
import { HackerAdminLogin } from './hacker/HackerAdminLogin';
import { HackerConsole } from './hacker/HackerConsole';

/**
 * Layout wrapper: the public Navbar & Footer are only rendered on public
 * routes. Admin routes (/admin/*) and the operations console (/hackeradmin/*)
 * get a fully independent chrome so neither panel is wrapped in the public site
 * header/footer — and the console keeps its own dark terminal surface.
 */
const AppShell: React.FC = () => {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isConsoleRoute = location.pathname.startsWith('/hackeradmin');
  const isPanelRoute = isAdminRoute || isConsoleRoute;

  return (
    <div
      className={
        isConsoleRoute
          ? 'relative flex min-h-screen w-full max-w-full flex-col overflow-x-hidden bg-[#04070a]'
          : 'relative flex min-h-screen w-full max-w-full flex-col overflow-x-hidden bg-[#F8F5F0] font-sans text-slate-800 antialiased selection:bg-[color:var(--site-accent)] selection:text-white'
      }
    >
      {!isPanelRoute && <Navbar />}

      <main className="flex-1 w-full max-w-full overflow-x-hidden">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/governance" element={<Governance />} />
          <Route path="/programs" element={<Programs />} />
          <Route path="/programs/:slug" element={<ProgramDetail />} />
          <Route path="/publications" element={<Publications />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/news" element={<News />} />
          <Route path="/news/:slug" element={<NewsDetail />} />
          <Route path="/career" element={<Career />} />
          <Route path="/notice" element={<Notice />} />
          <Route path="/contact" element={<Contact />} />

          {/* Admin Panel Routes (no public header/footer) */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<Dashboard />} />
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

          {/* /hackeradmin — operations console (passcode gate, own dark chrome) */}
          <Route path="/hackeradmin" element={<HackerAdminLogin />} />
          <Route path="/hackeradmin/console" element={<HackerConsole />} />

          {/* Fallback Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {!isPanelRoute && <Footer />}
    </div>
  );
};

export function App() {
  return (
    <LanguageProvider>
      <SettingsProvider>
        <AuthProvider>
          <ToastProvider>
            <BrowserRouter>
              <ScrollToTop />
              <AppShell />
            </BrowserRouter>
          </ToastProvider>
        </AuthProvider>
      </SettingsProvider>
    </LanguageProvider>
  );
}

export default App;
