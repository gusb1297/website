import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
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

export function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <div className="flex flex-col min-h-screen w-full max-w-full overflow-x-hidden bg-[#F8F5F0] text-slate-800 font-sans antialiased selection:bg-[#B38B4D] selection:text-white relative">
            <Navbar />

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

                {/* Admin Panel Routes */}
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin/dashboard" element={<Dashboard />} />
                <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

                {/* Fallback Catch-all */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>

            <Footer />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
