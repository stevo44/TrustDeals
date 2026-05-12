import { useState, useEffect } from 'react';
import { ShieldCheck, Mail, Phone, Lock, User, Shield } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { UserRole } from '../types';

interface SignUpPageProps {
  onNavigate: (page: string, dealId?: string) => void;
}

export default function SignUpPage({ onNavigate }: SignUpPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('buyer');
  const [loading, setLoading] = useState(false);

  // =============================================
  // PRE-FILL EMAIL IF COMING FROM INVITE LINK
  // App.tsx saves pendingJoinDealId to sessionStorage
  // If present, this is a seller joining via invite email
  // =============================================
  useEffect(() => {
    const pendingDealId = sessionStorage.getItem('pendingJoinDealId');
    if (pendingDealId) {
      // Pre-select seller role since they're joining a deal
      setRole('seller');

      // Try to pre-fill the email from the deal's sellerEmail field
      const prefillEmail = sessionStorage.getItem('pendingSellerEmail');
      if (prefillEmail) {
        setEmail(prefillEmail);
      }
    }
  }, []);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: fullName });

      // 2. Save user profile to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: fullName,
        role,
        phoneNumber: `+237${phone}`,
        createdAt: new Date().toISOString(),
      });

      toast.success('Account created successfully!');

      // =============================================
      // 3. CHECK FOR PENDING DEAL JOIN
      // If they came from an invite link, join the deal
      // and redirect straight into the deal room
      // =============================================
      const pendingDealId = sessionStorage.getItem('pendingJoinDealId');

      if (pendingDealId) {
        sessionStorage.removeItem('pendingJoinDealId');
        sessionStorage.removeItem('pendingSellerEmail');

        try {
          const dealRef = doc(db, 'deals', pendingDealId);
          const dealSnap = await getDoc(dealRef);

          if (dealSnap.exists()) {
            const deal = dealSnap.data();

            // Only join if seller slot is empty
            if (!deal.sellerId || deal.sellerId === '') {
              await updateDoc(dealRef, {
                sellerId: user.uid,
                sellerName: fullName,
                status: 'active',
                updatedAt: new Date().toISOString(),
              });

              toast.success('You\'ve joined the deal room!');
            }
          }
        } catch (joinError) {
          console.error('Failed to join deal after signup:', joinError);
        }

        onNavigate('deal-room', pendingDealId);
        return;
      }

      // Normal signup — go to dashboard
      onNavigate('dashboard');

    } catch (error: any) {
      toast.error(error.message || 'Failed to sign up. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const hasPendingDeal = !!sessionStorage.getItem('pendingJoinDealId');

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 antialiased min-h-screen">
      <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-primary/10 px-6 md:px-20 py-4 bg-white dark:bg-background-dark/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('landing')}>
          <ShieldCheck className="w-8 h-8 text-primary" />
          <h2 className="text-primary dark:text-slate-100 text-xl font-bold leading-tight tracking-tight">TrustDeals</h2>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden md:inline text-sm text-slate-500 dark:text-slate-400">Already have an account?</span>
          <button
            onClick={() => onNavigate('login')}
            className="flex items-center justify-center rounded-xl h-10 px-4 bg-primary/5 dark:bg-accent/10 text-primary dark:text-accent text-sm font-bold hover:bg-primary/10 transition-colors"
          >
            Log In
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-[540px] bg-white dark:bg-slate-900/50 rounded-xl shadow-2xl border border-primary/5 dark:border-white/5 overflow-hidden my-8">
          <div className="p-8 md:p-10">

            {/* Show special banner if coming from invite link */}
            {hasPendingDeal && (
              <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl mb-6">
                <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-primary">You've been invited to a deal!</p>
                  <p className="text-xs text-slate-500 mt-0.5">Create your account to view and accept the deal room invitation.</p>
                </div>
              </div>
            )}

            <div className="mb-8 text-center md:text-left">
              <h1 className="text-3xl font-black text-primary dark:text-slate-100 mb-2">Create Account</h1>
              <p className="text-slate-500">Join Cameroon's most secure transaction platform.</p>
            </div>

            <form onSubmit={handleSignUp} className="space-y-5">
              {/* Role Selection */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">I want to join as a:</p>
                <div className="grid grid-cols-3 gap-3">
                  <RoleOption selected={role === 'buyer'} onSelect={() => setRole('buyer')} icon={<ShieldCheck className="w-5 h-5" />} label="Buyer" />
                  <RoleOption selected={role === 'seller'} onSelect={() => setRole('seller')} icon={<User className="w-5 h-5" />} label="Seller" />
                  <RoleOption selected={role === 'rider'} onSelect={() => setRole('rider')} icon={<Shield className="w-5 h-5" />} label="Rider" />
                </div>
              </div>

              {/* Full Name */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    className="w-full pl-12 pr-4 h-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-primary focus:border-primary transition-all text-slate-900 dark:text-slate-100 outline-none"
                    placeholder="Jean-Paul Atangana"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    className="w-full pl-12 pr-4 h-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-primary focus:border-primary transition-all text-slate-900 dark:text-slate-100 outline-none"
                    placeholder="jp.atangana@example.cm"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cameroonian Phone Number</label>
                <div className="flex">
                  <div className="flex items-center gap-2 px-4 bg-slate-100 dark:bg-slate-800 border border-r-0 border-slate-200 dark:border-slate-800 rounded-l-xl">
                    <div className="w-6 h-4 flex items-center justify-center overflow-hidden rounded-sm bg-primary/20">
                      <div className="w-1/3 h-full bg-[#007A5E]"></div>
                      <div className="w-1/3 h-full bg-[#CE1126] flex items-center justify-center text-[6px] text-[#FCD116]">★</div>
                      <div className="w-1/3 h-full bg-[#FCD116]"></div>
                    </div>
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400">+237</span>
                  </div>
                  <input
                    className="w-full pr-4 h-12 rounded-r-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-primary focus:border-primary transition-all text-slate-900 dark:text-slate-100 outline-none"
                    placeholder="6XX XXX XXX"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    className="w-full pl-12 pr-4 h-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-primary focus:border-primary transition-all text-slate-900 dark:text-slate-100 outline-none"
                    placeholder="••••••••"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <button
                disabled={loading}
                className="w-full h-14 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/30 hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                type="submit"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Creating Account...
                  </>
                ) : (
                  <>
                    {hasPendingDeal ? 'Create Account & Join Deal' : 'Create My Account'}
                    <Shield className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-slate-500 dark:text-slate-500 text-xs">
        <p>© 2024 TrustEscrow Cameroon. Secure XAF Transactions.</p>
      </footer>
    </div>
  );
}

function RoleOption({ selected, onSelect, icon, label }: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div
      onClick={onSelect}
      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all text-center ${
        selected
          ? 'border-primary dark:border-accent bg-primary/5 dark:bg-accent/5'
          : 'border-slate-100 dark:border-slate-800 hover:border-primary/30'
      }`}
    >
      <div className={`mb-1 ${selected ? 'text-primary dark:text-accent' : 'text-slate-400'}`}>{icon}</div>
      <span className={`text-xs font-bold ${selected ? 'text-primary dark:text-accent' : 'text-slate-600 dark:text-slate-400'}`}>{label}</span>
    </div>
  );
}
