import { useState } from 'react';
import { 
  ShieldCheck, Verified, PlusCircle, UserPlus, Shield, Menu, X,
  ShoppingCart, Store, Bike, Share2, Wallet, Truck, FileCheck 
} from 'lucide-react';
import heroBg from '../assets/cameroon-hero.jpg';

interface LandingPageProps {
  onNavigate: (page: string) => void;
}

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'How it Works', href: '#how-it-works' },
  ];

  return (
    <div className="min-h-screen">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 w-full bg-white/90 dark:bg-background-dark/90 backdrop-blur-md border-b border-primary/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="bg-primary p-2 rounded-lg shadow-lg">
                <ShieldCheck className="text-accent text-2xl" />
              </div>
              <span className="text-xl font-bold tracking-tight text-primary dark:text-white">TrustDeals</span>
            </div>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-8">
              {navLinks.map(link => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-accent transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <button
                onClick={() => onNavigate('login')}
                className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-accent transition-colors"
              >
                Login
              </button>
              <button
                onClick={() => onNavigate('signup')}
                className="bg-primary text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 hover:bg-slate-800 transition-all border border-accent/20"
              >
                Sign Up
              </button>
            </nav>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              onClick={() => setMobileMenuOpen(prev => !prev)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen
                ? <X className="w-6 h-6 text-slate-900 dark:text-slate-100" />
                : <Menu className="w-6 h-6 text-slate-900 dark:text-slate-100" />
              }
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-primary/10 bg-white dark:bg-background-dark shadow-xl">
            <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-1">
              {navLinks.map(link => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-primary/5 hover:text-accent rounded-xl transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <button
                onClick={() => { setMobileMenuOpen(false); onNavigate('login'); }}
                className="px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-primary/5 hover:text-accent rounded-xl transition-colors text-left"
              >
                Login
              </button>
              <button
                onClick={() => { setMobileMenuOpen(false); onNavigate('signup'); }}
                className="mt-2 w-full py-3 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:bg-slate-800 transition-all"
              >
                Sign Up Free
              </button>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-16 pb-24 sm:pt-24 sm:pb-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="flex flex-col gap-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-accent/30 text-primary dark:text-accent text-xs font-bold uppercase tracking-wider w-fit">
                  <Verified className="w-4 h-4" />
                  Trusted by 10k+ Cameroonian Traders
                </div>
                <h1 className="text-4xl sm:text-6xl font-black text-slate-900 dark:text-white leading-[1.1] tracking-tight">
                  Secure Your <span className="text-accent">Peer to Peer </span>Deals with Full Confidence
                </h1>
                <p className="text-lg text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
                  The safest way to trade in Cameroon. Protect your Mobile Money and Bank Transfers. Our escrow system ensures your XAF is only released when you receive your goods.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => onNavigate('signup')}
                    className="flex items-center justify-center gap-2 bg-primary text-white px-8 py-4 rounded-xl text-lg font-bold shadow-xl shadow-primary/30 hover:translate-y-[-2px] transition-all border border-accent/30"
                  >
                    <PlusCircle className="text-accent" />
                    Start Secure Transaction
                  </button>
                  <button
                    onClick={() => onNavigate('login')} // Directly linked to login as requested
                    className="flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-8 py-4 rounded-xl text-lg font-bold shadow-sm hover:bg-slate-50 transition-all text-primary dark:text-white"
                  >
                    <UserPlus />
                    Join Deal Room
                  </button>
                </div>
                <p className="text-sm text-slate-500 font-medium border-l-2 border-accent pl-3 italic">No more "What you bought vs what you received" scams.</p>
              </div>
              <div className="relative group">
                <div className="absolute -inset-4 bg-gradient-to-tr from-accent/20 to-transparent rounded-3xl blur-2xl group-hover:blur-3xl transition-all"></div>
                <div
                  className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-primary/10 dark:border-slate-800 overflow-hidden aspect-video sm:aspect-square lg:aspect-video flex items-center justify-center bg-cover bg-center"
                  style={{ backgroundImage: `url(${heroBg})` }}
                >
                  <div className="absolute inset-0 bg-primary/10 mix-blend-overlay"></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-24 relative overflow-hidden bg-white dark:bg-[#0c141d]">
          <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] dark:opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#1a2b3d 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-accent/10 rounded-full blur-[120px]"></div>
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-primary/20 rounded-full blur-[120px]"></div>
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center max-w-2xl mx-auto mb-20 flex flex-col gap-4">
              <h2 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">How TrustDeals Works</h2>
              <div className="h-1.5 w-24 bg-accent mx-auto rounded-full"></div>
              <p className="text-slate-600 dark:text-slate-400 text-lg sm:text-xl font-medium">Your 4-step guide to secure peer-to-peer trading in Cameroon.</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 relative">
              {[
                { num: '01', icon: <Share2 className="w-8 h-8 relative z-10" />, title: 'Initiate & Connect', desc: 'Create a secure Deal Room and invite your counterparty from social media or WhatsApp.', mt: '' },
                { num: '02', icon: <Wallet className="w-8 h-8 relative z-10" />, title: 'Secure Escrow Deposit', desc: 'The buyer deposits the agreed XAF amount into our secure holding account.', mt: 'lg:mt-8' },
                { num: '03', icon: <Truck className="w-8 h-8 relative z-10" />, title: 'Verified Logistics', desc: 'A professional rider is assigned to pick up and deliver the item, tracked in real-time.', mt: 'lg:mt-16' },
                { num: '04', icon: <FileCheck className="w-8 h-8 relative z-10" />, title: 'Final Release', desc: 'Once the buyer inspects the item and provides the OTP, funds are instantly released to the seller.', mt: 'lg:mt-24' },
              ].map(step => (
                <div key={step.num} className={`relative group bg-white dark:bg-slate-900/50 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-2xl hover:border-accent/20 transition-all duration-500 ${step.mt}`}>
                  <div className="absolute -top-6 -left-4 text-7xl font-black step-number-outline opacity-40 select-none">{step.num}</div>
                  <div className="relative z-10">
                    <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-accent mb-8 shadow-lg shadow-primary/30 group-hover:scale-110 transition-transform duration-500 relative">
                      <div className="absolute inset-0 bg-accent rounded-2xl blur-lg opacity-0 group-hover:opacity-30 transition-opacity"></div>
                      {step.icon}
                    </div>
                    <h3 className="text-2xl font-extrabold mb-4 text-slate-900 dark:text-white leading-tight">{step.title}</h3>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 bg-white dark:bg-background-dark/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16 flex flex-col gap-4">
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">Built for the Cameroonian Market</h2>
              <p className="text-slate-600 dark:text-slate-400 text-lg">We provide a local framework to facilitate high-trust peer-to-peer commerce through secure XAF holding systems.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <FeatureCard icon={<Shield className="w-6 h-6" />} title="XAF Escrow Protection" description="Payments are held securely in our XAF trust account via Mobile Money or Bank Transfer until delivery is confirmed." />
              <FeatureCard icon={<Bike className="w-6 h-6" />} title="Local Delivery Check" description="Verify goods with local logistics partners across Buea, Douala, and beyond before funds are released." />
              <FeatureCard icon={<ShoppingCart className="w-6 h-6" />} title="Encrypted Deal Chat" description="Negotiate terms and share receipts within a secure, encrypted environment built for transparency." />
              <FeatureCard icon={<ShieldCheck className="w-6 h-6" />} title="2FA Security" description="Use local OTP codes to authorize any release of funds, ensuring your XAF is always under your control." />
            </div>
          </div>
        </section>

        {/* Trust Section */}
        <section className="py-20 relative bg-primary overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="grid grid-cols-6 h-full">
              {[...Array(6)].map((_, i) => <div key={i} className="border-r border-accent"></div>)}
            </div>
          </div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            <h2 className="text-3xl sm:text-5xl font-black text-white mb-8">Secure your next <span className="text-accent">Trust deal</span> today</h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <button
                onClick={() => onNavigate('signup')}
                className="w-full sm:w-auto px-10 py-4 gold-gradient text-primary rounded-xl font-black text-lg hover:brightness-110 transition-all shadow-xl shadow-black/30"
              >
                Get Started for 0 XAF
              </button>
              <div className="flex items-center gap-4 text-white/80">
                <div className="flex -space-x-2">
                  {[1, 2, 3].map(i => (
                    <img key={i} alt="User" className="w-10 h-10 rounded-full border-2 border-primary object-cover" src={`https://picsum.photos/seed/user${i}/100/100`} />
                  ))}
                </div>
                <span className="font-bold text-slate-100">Trusted by traders in Buea & Douala</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-background-light dark:bg-background-dark py-12 border-t border-primary/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="bg-primary p-2 rounded-lg">
                <ShieldCheck className="text-accent text-xl" />
              </div>
              <span className="text-lg font-bold tracking-tight text-primary dark:text-white">TrustDeals</span>
            </div>
            <div className="flex flex-wrap justify-center gap-6">
              <a className="text-sm text-slate-500 hover:text-accent transition-colors" href="#">Privacy Policy</a>
              <a className="text-sm text-slate-500 hover:text-accent transition-colors" href="#">Terms of Service</a>
              <a className="text-sm text-slate-500 hover:text-accent transition-colors" href="#">Security Cameroon</a>
            </div>
            <div className="text-slate-400 text-sm text-center">
              © 2024 TrustDeals Cameroon Inc. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-8 rounded-xl bg-background-light dark:bg-slate-800/50 border border-primary/5 hover:border-accent/40 transition-all group shadow-sm hover:shadow-md">
      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-accent transition-all">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3 text-primary dark:text-white">{title}</h3>
      <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
