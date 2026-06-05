/**
 * components/PhoneOtpStep.tsx
 * Phone number verification step used inside VerificationWizard.
 */
import { useState, useRef, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Phone, Send, RefreshCw } from 'lucide-react';

interface PhoneOtpStepProps {
  onVerified: (phoneNumber: string) => void;
  initialPhone?: string;
}

export default function PhoneOtpStep({ onVerified, initialPhone = '' }: PhoneOtpStepProps) {
  const [phone, setPhone] = useState(initialPhone);
  const [codeSent, setCodeSent] = useState(false);
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [devCode, setDevCode] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startResendTimer = () => {
    setResendCountdown(60);
    timerRef.current = setInterval(() => {
      setResendCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const sendOtp = async () => {
    const cleaned = phone.trim().replace(/\s/g, '');
    if (!/^6\d{8}$/.test(cleaned)) {
      toast.error('Enter a valid Cameroon phone number (e.g. 6XXXXXXXX)');
      return;
    }
    setSending(true);
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await setDoc(doc(db, 'otps', cleaned), { code, expiresAt, used: false });
      setDevCode(code);
      setCodeSent(true);
      startResendTimer();
      toast.success('OTP sent! Check the dev hint below.');
    } catch {
      toast.error('Failed to send OTP. Try again.');
    } finally {
      setSending(false);
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
    e.preventDefault();
  };

  const verifyOtp = async () => {
    const entered = digits.join('');
    if (entered.length !== 6) return;
    setVerifying(true);
    try {
      const cleaned = phone.trim().replace(/\s/g, '');
      const snap = await getDoc(doc(db, 'otps', cleaned));
      if (!snap.exists()) { toast.error('OTP not found. Request a new one.'); return; }
      const data = snap.data();
      if (data.used) { toast.error('OTP already used. Request a new one.'); return; }
      if (new Date(data.expiresAt) < new Date()) {
        toast.error('OTP expired. Request a new one.');
        return;
      }
      if (data.code !== entered) {
        toast.error('Incorrect OTP. Try again.');
        return;
      }
      await setDoc(doc(db, 'otps', cleaned), { used: true }, { merge: true });
      toast.success('Phone verified!');
      onVerified(cleaned);
    } catch {
      toast.error('Verification failed. Try again.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Phone input */}
      <div>
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
          <Phone className="inline w-4 h-4 mr-1" />
          Phone Number (Cameroon)
        </label>
        <div className="flex gap-2">
          <div className="flex items-center px-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400">
            +237
          </div>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="6XXXXXXXX"
            maxLength={9}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20 text-slate-900 dark:text-slate-100 font-bold transition-all"
          />
        </div>
      </div>

      {/* Send OTP button */}
      {!codeSent ? (
        <button
          onClick={sendOtp}
          disabled={sending || phone.trim().length < 9}
          className="w-full py-3 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
        >
          {sending ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending...</>
          ) : (
            <><Send className="w-4 h-4" />Send OTP</>
          )}
        </button>
      ) : (
        <div className="space-y-4">
          {/* OTP digit boxes */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
              Enter the 6-digit code
            </label>
            <div className="flex gap-2 justify-center" onPaste={handlePaste}>
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el; }}
                  id={`phone-otp-${i}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleDigitChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  className="w-11 h-13 text-center text-xl font-bold rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:border-primary focus:outline-none transition-colors"
                />
              ))}
            </div>
          </div>

          {/* Dev mode hint — remove before production */}
          {devCode && (
            <div className="text-center p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">Dev mode — OTP: <strong className="text-slate-600 dark:text-slate-300">{devCode}</strong></span>
            </div>
          )}

          {/* Verify button */}
          <button
            onClick={verifyOtp}
            disabled={digits.join('').length !== 6 || verifying}
            className="w-full py-3 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
          >
            {verifying ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Verifying...</>
            ) : 'Verify Code'}
          </button>

          {/* Resend */}
          <button
            onClick={sendOtp}
            disabled={resendCountdown > 0 || sending}
            className="w-full text-sm text-slate-500 dark:text-slate-400 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend OTP'}
          </button>
        </div>
      )}
    </div>
  );
}
