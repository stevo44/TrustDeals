import { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { UserProfile } from './types';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import SignUpPage from './components/SignUpPage';
import Dashboard from './components/Dashboard';
import DealRoom from './components/DealRoom';
import RiderPortal from './components/RiderPortal';
import AdminDashboard from './components/AdminDashboard';
import { Toaster } from 'sonner';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('landing');
  const [activeDealId, setActiveDealId] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const finalizeProfile = (user: User) => {
      if (unsubscribeProfile) unsubscribeProfile();
      
      unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
          // Only auto-navigate to dashboard if we are on a landing/auth page
          setCurrentPage((prevPage) => 
            ['landing', 'login', 'signup'].includes(prevPage) ? 'dashboard' : prevPage
          );
        } else {
          setProfile(null);
          // Don't force redirect to signup if we are already on login or signup
          // because a social login might be in the process of creating the document.
          setCurrentPage((prevPage) => 
            prevPage === 'landing' ? 'signup' : prevPage
          );
        }
        setLoading(false);
      }, (error) => {
        console.error("Profile snapshot error:", error);
        setLoading(false);
      });
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        finalizeProfile(user);
      } else {
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }
        setProfile(null);
        setCurrentPage((prevPage) => (prevPage === 'signup' ? 'signup' : 'landing'));
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) (unsubscribeProfile as () => void)();
    };
  }, []); // Only run once on mount

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const navigateTo = (page: string, dealId?: string) => {
    setCurrentPage(page);
    if (dealId) setActiveDealId(dealId);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'landing':
        return <LandingPage onNavigate={navigateTo} />;
      case 'login':
        return <LoginPage onNavigate={navigateTo} />;
      case 'signup':
        return <SignUpPage onNavigate={navigateTo} />;
      case 'dashboard':
        if (profile?.role === 'rider') return <RiderPortal onNavigate={navigateTo} />;
        if (profile?.role === 'admin') return <AdminDashboard onNavigate={navigateTo} />;
        return <Dashboard profile={profile} onNavigate={navigateTo} />;
      case 'deal-room':
        return <DealRoom dealId={activeDealId!} profile={profile} onNavigate={navigateTo} />;
      default:
        return <LandingPage onNavigate={navigateTo} />;
    }
  };

  return (
    <>
      {renderPage()}
      <Toaster position="top-right" />
    </>
  );
}
