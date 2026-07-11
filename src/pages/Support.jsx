// /Support — Building Support Tickets app entry.
// Phones get the mobile app (Mobile App design); larger screens get the admin
// console (Building Support Tickets design). Override with ?view=mobile|desktop.
import React, { useEffect, useState } from 'react';
import { SupportProvider } from '@/support/store.jsx';
import SupportDesktop from '@/support/desktop/SupportDesktop.jsx';
import SupportMobile from '@/support/mobile/SupportMobile.jsx';

const MOBILE_BREAKPOINT = 820;

function useView() {
  const forced = new URLSearchParams(window.location.search).get('view');
  const [isMobile, setIsMobile] = useState(
    () => window.innerWidth < MOBILE_BREAKPOINT
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  if (forced === 'mobile') return 'mobile';
  if (forced === 'desktop') return 'desktop';
  return isMobile ? 'mobile' : 'desktop';
}

export default function Support() {
  const view = useView();

  useEffect(() => {
    document.title = 'Building Support Tickets · Focused Facilities Management';
    // Inter — the app's brand typeface (loaded once, shared by both views).
    if (!document.getElementById('support-inter-font')) {
      const link = document.createElement('link');
      link.id = 'support-inter-font';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
      document.head.appendChild(link);
    }
    // Offline shell — register the PWA service worker (production only, and
    // never a hard failure if the browser refuses).
    if ('serviceWorker' in navigator && !import.meta.env.DEV) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return (
    <SupportProvider>
      {view === 'mobile' ? <SupportMobile /> : <SupportDesktop />}
    </SupportProvider>
  );
}
