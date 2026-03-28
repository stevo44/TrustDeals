import { useState } from 'react';
import { ShieldCheck, Mail, Phone, Lock, ArrowRight, Verified } from 'lucide-react';
import { auth, db, googleProvider } from '../lib/firebase';
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';

interface LoginPageProps {
  onNavigate: (page: string) => void;
}

export default function LoginPage({ onNavigate }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState('buyer');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('Logged in successfully!');
      onNavigate('dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Check if user exists in Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (!userDoc.exists()) {
        // Create user profile if it doesn't exist
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          role: role, // Use selected role for new users
          photoURL: user.photoURL,
          createdAt: new Date().toISOString(),
        });
        toast.success(`Welcome ${user.displayName}! Account created as ${role}.`);
      } else {
        toast.success('Logged in successfully!');
      }

      onNavigate('dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Failed to login with Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 min-h-screen flex flex-col">
      <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-primary/5 px-6 py-4 lg:px-40 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3 text-primary cursor-pointer" onClick={() => onNavigate('landing')}>
          <div className="size-8 bg-primary/5 rounded-lg flex items-center justify-center">
            <ShieldCheck className="text-primary text-2xl" />
          </div>
          <h2 className="text-slate-900 dark:text-slate-100 text-xl font-bold leading-tight tracking-tight">TrustDeals</h2>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-200">
          <Lock className="text-slate-500 w-4 h-4" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Secure Connection</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-[480px] flex flex-col gap-8">
          <div className="text-center flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Welcome Back</h1>
            <p className="text-slate-500 text-base">Securely manage your escrow transactions with confidence</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl shadow-slate-200/50 border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="flex border-b border-slate-100 dark:border-slate-800">
              <div className="flex-1 py-4 text-sm font-bold border-b-2 border-primary text-primary bg-primary/[0.02] text-center">
                Login
              </div>
            </div>

            <div className="p-8 flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Continue as</label>
                <div className="flex h-12 items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
                  {['buyer', 'seller', 'rider'].map((r) => (
                    <label key={r} className={`flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-md px-2 text-sm font-medium transition-all ${role === r ? 'bg-white dark:bg-slate-700 shadow-sm text-primary dark:text-white' : 'text-slate-500'}`}>
                      <span className="capitalize">{r}</span>
                      <input 
                        type="radio" 
                        name="user-role" 
                        value={r} 
                        checked={role === r} 
                        onChange={(e) => setRole(e.target.value)}
                        className="hidden" 
                      />
                    </label>
                  ))}
                </div>
              </div>

              <button 
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all font-semibold text-slate-700 dark:text-slate-300 shadow-sm active:scale-[0.98] disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    className="text-[#4285F4]"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    className="text-[#34A853]"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    className="text-[#FBBC05]"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    className="text-[#EA4335]"
                  />
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800"></div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">or email</span>
                <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800"></div>
              </div>

              <form onSubmit={handleLogin} className="flex flex-col gap-6">
                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="email">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <input 
                        className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-slate-400" 
                        id="email" 
                        placeholder="user@domain.cm" 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="password">Password</label>
                      <a className="text-xs font-bold text-primary hover:underline" href="#">Forgot?</a>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <input 
                        className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-slate-400" 
                        id="password" 
                        placeholder="••••••••" 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>

                <button 
                  disabled={loading}
                  className="w-full bg-primary hover:bg-slate-800 text-white font-bold py-4 rounded-lg transition-all flex items-center justify-center gap-2 group shadow-lg shadow-primary/10 disabled:opacity-50"
                >
                  <span>{loading ? 'Signing In...' : 'Sign In to Dashboard'}</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </form>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <div className="p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm border border-slate-100 dark:border-slate-600">
                  <Verified className="text-primary dark:text-accent w-5 h-5" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-bold text-slate-800 dark:text-white tracking-tight">End-to-End Encryption</p>
                  <p className="text-xs text-slate-500 leading-relaxed">Your data is secured using AES-256 military-grade encryption during transit and at rest.</p>
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm text-slate-500">Don't have an account? <button onClick={() => onNavigate('signup')} className="text-primary font-bold hover:underline">Sign Up</button></p>
              </div>
            </div>
          </div>

          <footer className="flex justify-center gap-6">
            <a className="text-xs font-medium text-slate-400 hover:text-primary transition-colors" href="#">Privacy Policy</a>
            <a className="text-xs font-medium text-slate-400 hover:text-primary transition-colors" href="#">Terms of Service</a>
            <a className="text-xs font-medium text-slate-400 hover:text-primary transition-colors" href="#">Contact Support</a>
          </footer>
        </div>
      </main>
    </div>
  );
}
