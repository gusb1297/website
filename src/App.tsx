import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { SettingsProvider } from './context/SettingsContext';
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

/**
 * Layout wrapper: the public Navbar & Footer are only rendered on public
 * routes. Admin routes (/admin/*) get a fully independent chrome so the
 * management panel is not wrapped in the public site header/footer.
 */
const AppShell: React.FC = () => {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <div className="flex flex-col min-h-screen w-full max-w-full overflow-x-hidden bg-[#F8F5F0] text-slate-800 font-sans antialiased selection:bg-[color:var(--site-accent)] selection:text-white relative">
      {!isAdminRoute && <Navbar />}

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

          {/* Fallback Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {!isAdminRoute && <Footer />}
    </div>
  );
};

export function App() {
  return (
    <LanguageProvider>
      <SettingsProvider>
        <AuthProvider>
          <BrowserRouter>
            <ScrollToTop />
            <AppShell />
          </BrowserRouter>
        </AuthProvider>
      </SettingsProvider>
    </LanguageProvider>
  );
}

export default App;
