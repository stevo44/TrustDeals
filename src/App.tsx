// import { useState, useEffect } from 'react';
// import { auth, db } from './lib/firebase';
// import { onAuthStateChanged, User } from 'firebase/auth';
// import { doc, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';
// import { UserProfile } from './types';
// import LandingPage from './components/LandingPage';
// import LoginPage from './components/LoginPage';
// import SignUpPage from './components/SignUpPage';
// import Dashboard from './components/Dashboard';
// import DealRoom from './components/DealRoom';
// import RiderPortal from './components/RiderPortal';
// import AdminDashboard from './components/AdminDashboard';
// import { Toaster } from 'sonner';
// import { verifyPayment } from './lib/notchpay';
// import { addDoc, collection } from 'firebase/firestore';

// export default function App() {
//   const [user, setUser] = useState<User | null>(null);
//   const [profile, setProfile] = useState<UserProfile | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [currentPage, setCurrentPage] = useState('landing');
//   const [activeDealId, setActiveDealId] = useState<string | null>(null);

//   // =============================================
//   // INTERCEPT INVITE LINK: /join/:dealId
//   // =============================================
//   useEffect(() => {
//     const path = window.location.pathname;
//     const joinMatch = path.match(/^\/join\/(.+)$/);

//     if (joinMatch) {
//       const dealId = joinMatch[1];
//       sessionStorage.setItem('pendingJoinDealId', dealId);

//       getDoc(doc(db, 'deals', dealId)).then((snap) => {
//         if (snap.exists()) {
//           const sellerEmail = snap.data().sellerEmail;
//           if (sellerEmail) sessionStorage.setItem('pendingSellerEmail', sellerEmail);
//         }
//       }).catch(console.error);

//       window.history.replaceState({}, '', '/');
//     }

//     // =============================================
//     // HANDLE NOTCH PAY CALLBACK
//     // After the buyer completes payment on the
//     // Notch Pay page, they are redirected back here
//     // with ?payment=callback&dealId=xxx in the URL.
//     // We auto-verify the payment status.
//     // =============================================
//     const urlParams = new URLSearchParams(window.location.search);
//     if (urlParams.get('payment') === 'callback') {
//       const dealId = urlParams.get('dealId');
//       const reference = urlParams.get('reference'); // Notch Pay may include this

//       // Clean URL immediately
//       window.history.replaceState({}, '', '/');

//       if (dealId) {
//         sessionStorage.setItem('pendingPaymentVerify', JSON.stringify({ dealId, reference }));
//       }
//     }
//   }, []);

//   // =============================================
//   // VERIFY PENDING PAYMENT ON AUTH RESOLVE
//   // =============================================
//   useEffect(() => {
//     const pendingVerify = sessionStorage.getItem('pendingPaymentVerify');
//     if (!pendingVerify || !user) return;
//     sessionStorage.removeItem('pendingPaymentVerify');

//     const { dealId, reference } = JSON.parse(pendingVerify);

//     const autoVerify = async () => {
//       try {
//         const dealSnap = await getDoc(doc(db, 'deals', dealId));
//         if (!dealSnap.exists()) return;

//         const deal = dealSnap.data();
//         const ref = reference || deal.paymentReference;
//         if (!ref) return;

//         const result = await verifyPayment(ref);
//         if (result.success && result.status === 'complete') {
//           await updateDoc(doc(db, 'deals', dealId), {
//             status: 'funded', milestone: 25,
//             paymentStatus: 'complete',
//             notchPayTransactionId: ref,
//             escrowFundedAt: new Date().toISOString(),
//             updatedAt: new Date().toISOString(),
//           });

//           await addDoc(collection(db, 'deals', dealId, 'messages'), {
//             dealId, senderId: 'system',
//             text: `✅ Escrow funded! Payment verified and locked securely.`,
//             timestamp: new Date().toISOString(), type: 'system',
//           });

//           // Navigate to the deal room
//           setActiveDealId(dealId);
//           setCurrentPage('deal-room');
//         }
//       } catch (err) {
//         console.error('Auto-verify failed:', err);
//         // Navigate to deal room anyway so user can verify manually
//         setActiveDealId(dealId);
//         setCurrentPage('deal-room');
//       }
//     };

//     autoVerify();
//   }, [user]);

//   // =============================================
//   // AUTH STATE LISTENER
//   // =============================================
//   useEffect(() => {
//     let unsubscribeProfile: (() => void) | null = null;

//     const finalizeProfile = async (user: User) => {
//       if (unsubscribeProfile) unsubscribeProfile();

//       unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), async (docSnap) => {
//         if (docSnap.exists()) {
//           const userProfile = docSnap.data() as UserProfile;
//           setProfile(userProfile);

//           const pendingDealId = sessionStorage.getItem('pendingJoinDealId');
//           if (pendingDealId) {
//             sessionStorage.removeItem('pendingJoinDealId');
//             sessionStorage.removeItem('pendingSellerEmail');
//             await joinDealAsSecondParty(pendingDealId, user.uid, userProfile);
//             setActiveDealId(pendingDealId);
//             setCurrentPage('deal-room');
//           } else {
//             setCurrentPage((prevPage) =>
//               ['login', 'signup'].includes(prevPage) ? 'dashboard' : prevPage
//             );
//           }
//         } else {
//           setProfile(null);
//           setCurrentPage((prevPage) => prevPage === 'login' ? 'signup' : prevPage);
//         }
//         setLoading(false);
//       }, (error) => {
//         console.error('Profile snapshot error:', error);
//         setLoading(false);
//       });
//     };

//     const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
//       setUser(user);
//       if (user) {
//         finalizeProfile(user);
//       } else {
//         if (unsubscribeProfile) { unsubscribeProfile(); unsubscribeProfile = null; }
//         setProfile(null);
//         const pendingDealId = sessionStorage.getItem('pendingJoinDealId');
//         setCurrentPage(pendingDealId ? 'signup' : (prev) => prev === 'signup' ? 'signup' : 'landing');
//         setLoading(false);
//       }
//     });

//     return () => {
//       unsubscribeAuth();
//       if (unsubscribeProfile) (unsubscribeProfile as () => void)();
//     };
//   }, []);

//   if (loading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-slate-50">
//         <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
//       </div>
//     );
//   }

//   const navigateTo = (page: string, dealId?: string) => {
//     setCurrentPage(page);
//     if (dealId) setActiveDealId(dealId);
//   };

//   const renderPage = () => {
//     switch (currentPage) {
//       case 'landing':   return <LandingPage onNavigate={navigateTo} />;
//       case 'login':     return <LoginPage onNavigate={navigateTo} />;
//       case 'signup':    return <SignUpPage onNavigate={navigateTo} />;
//       case 'dashboard':
//         if (profile?.role === 'rider') return <RiderPortal onNavigate={navigateTo} />;
//         if (profile?.role === 'admin') return <AdminDashboard onNavigate={navigateTo} />;
//         return <Dashboard profile={profile} onNavigate={navigateTo} />;
//       case 'deal-room': return <DealRoom dealId={activeDealId!} profile={profile} onNavigate={navigateTo} />;
//       default:          return <LandingPage onNavigate={navigateTo} />;
//     }
//   };

//   return (
//     <>
//       {renderPage()}
//       <Toaster position="top-right" richColors />
//     </>
//   );
// }

// // =============================================
// // JOIN DEAL AS SECOND PARTY
// // =============================================
// async function joinDealAsSecondParty(dealId: string, userId: string, profile: UserProfile) {
//   try {
//     const dealRef  = doc(db, 'deals', dealId);
//     const dealSnap = await getDoc(dealRef);
//     if (!dealSnap.exists()) return;

//     const deal = dealSnap.data();
//     if (deal.buyerId === userId || deal.sellerId === userId) return;

//     const origin = deal.origin ?? 'buyer';

//     if (origin === 'buyer' && (!deal.sellerId || deal.sellerId === '')) {
//       // Buyer-originated deal: person joining is the seller
//       await updateDoc(dealRef, {
//         sellerId: userId,
//         sellerName: profile.displayName || profile.email,
//         sellerEmail: profile.email,
//         status: 'active',
//         updatedAt: new Date().toISOString(),
//       });
//     } else if (origin === 'seller' && (!deal.buyerId || deal.buyerId === '')) {
//       // Seller-originated deal: person joining is the buyer
//       await updateDoc(dealRef, {
//         buyerId: userId,
//         buyerName: profile.displayName || profile.email,
//         buyerEmail: profile.email,
//         status: 'active',
//         updatedAt: new Date().toISOString(),
//       });
//     }
//   } catch (error) {
//     console.error('Failed to join deal:', error);
//   }
// }


import { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';
import { UserProfile } from './types';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import SignUpPage from './components/SignUpPage';
import Dashboard from './components/Dashboard';
import DealRoom from './components/DealRoom';
import RiderPortal from './components/RiderPortal';
import AdminDashboard from './components/AdminDashboard';
import { Toaster } from 'sonner';
import { PresenceProvider } from './contexts/PresenceContext';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('landing');
  const [activeDealId, setActiveDealId] = useState<string | null>(null);

  // =============================================
  // INTERCEPT INVITE LINK ON APP LOAD
  // URL pattern: /join/:dealId
  // Saves dealId + seller email to sessionStorage
  // so they survive the login/signup redirect
  // =============================================
  useEffect(() => {
    const path = window.location.pathname;
    const joinMatch = path.match(/^\/join\/(.+)$/);

    if (joinMatch) {
      const dealId = joinMatch[1];
      sessionStorage.setItem('pendingJoinDealId', dealId);

      // Fetch the deal to get the seller's email for pre-filling signup
      getDoc(doc(db, 'deals', dealId)).then((snap) => {
        if (snap.exists()) {
          const sellerEmail = snap.data().sellerEmail;
          if (sellerEmail) {
            sessionStorage.setItem('pendingSellerEmail', sellerEmail);
          }
        }
      }).catch(console.error);

      // Clean up URL
      window.history.replaceState({}, '', '/');
    }
  }, []);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const finalizeProfile = async (user: User) => {
      if (unsubscribeProfile) unsubscribeProfile();

      unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), async (docSnap) => {
        let userProfile: UserProfile | null = null;

        if (docSnap.exists()) {
          userProfile = docSnap.data() as UserProfile;
        }

        if (userProfile) {
          setProfile(userProfile);

          const pendingDealId = sessionStorage.getItem('pendingJoinDealId');
          if (pendingDealId) {
            sessionStorage.removeItem('pendingJoinDealId');
            sessionStorage.removeItem('pendingSellerEmail');
            await joinDealAsSecondParty(pendingDealId, user.uid, userProfile);
            setActiveDealId(pendingDealId);
            setCurrentPage('deal-room');
          } else {
            setCurrentPage((prevPage) =>
              ['login', 'signup'].includes(prevPage) ? 'dashboard' : prevPage
            );
          }
        } else {
          setProfile(null);
          setCurrentPage((prevPage) => prevPage === 'login' ? 'signup' : prevPage);
        }
        setLoading(false);
      }, (error) => {
        console.error('Profile snapshot error:', error);
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

        // If they have a pending deal and aren't logged in → send to signup
        const pendingDealId = sessionStorage.getItem('pendingJoinDealId');
        if (pendingDealId) {
          setCurrentPage('signup');
        } else {
          setCurrentPage((prevPage) => (prevPage === 'signup' ? 'signup' : 'landing'));
        }
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) (unsubscribeProfile as () => void)();
    };
  }, []);

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
    <PresenceProvider profile={profile}>
      {renderPage()}
      <Toaster position="top-right" richColors />
    </PresenceProvider>
  );
}

// =============================================
// JOIN DEAL AS SECOND PARTY
// Called when an already-logged-in user opens
// an invite link. Assigns them as seller.
// =============================================
async function joinDealAsSecondParty(dealId: string, userId: string, profile: UserProfile) {
  try {
    const dealRef = doc(db, 'deals', dealId);
    const dealSnap = await getDoc(dealRef);

    if (!dealSnap.exists()) return;

    const deal = dealSnap.data();

    // Don't join if already a participant
    if (deal.buyerId === userId || deal.sellerId === userId) return;

    const createdBy = deal.createdBy || 'buyer';

    if (createdBy === 'buyer' && (!deal.sellerId || deal.sellerId === '')) {
      // Buyer created it, we are the seller
      await updateDoc(dealRef, {
        sellerId: userId,
        sellerName: profile.displayName || profile.email,
        sellerEmail: profile.email,
        status: 'active',
        updatedAt: new Date().toISOString(),
      });
    } else if (createdBy === 'seller' && (!deal.buyerId || deal.buyerId === '')) {
      // Seller created it, we are the buyer
      await updateDoc(dealRef, {
        buyerId: userId,
        buyerName: profile.displayName || profile.email,
        buyerEmail: profile.email,
        status: 'active',
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Failed to join deal:', error);
  }
}
