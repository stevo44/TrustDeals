import { useState } from 'react';
import { ShieldCheck, Mail, Phone, Lock, ArrowRight, Verified } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
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

            <form onSubmit={handleLogin} className="p-8 flex flex-col gap-6">
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

              <div className="flex items-center gap-4 py-2">
                <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800"></div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Secure Verification</span>
                <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800"></div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <div className="p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm border border-slate-100 dark:border-slate-600">
                  <Verified className="text-primary dark:text-accent w-5 h-5" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-bold text-slate-800 dark:text-white tracking-tight">End-to-End Encryption</p>
                  <p className="text-xs text-slate-500 leading-relaxed">Your data is secured using AES-256 military-grade encryption during transit and at rest.</p>
                </div>
              </div>

              <div className="text-center pt-2">
                <p className="text-sm text-slate-500">Don't have an account? <button type="button" onClick={() => onNavigate('signup')} className="text-primary font-bold hover:underline">Sign Up</button></p>
              </div>
            </form>
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
