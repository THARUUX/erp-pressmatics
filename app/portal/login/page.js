'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiMail, FiLock, FiArrowRight, FiSun, FiMoon, FiAlertCircle, FiLoader, FiArrowLeft } from 'react-icons/fi';

export default function PortalLogin() {
    const router = useRouter();
    const [dark, setDark] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [askPassword, setAskPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [brand, setBrand] = useState({});
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('portal-theme');
        if (saved) setDark(saved === 'dark');
        setMounted(true);
        fetch('/api/portal/brand').then(r => r.json()).then(d => setBrand(d)).catch(() => {});
    }, []);

    const toggleTheme = () => {
        const next = !dark;
        setDark(next);
        localStorage.setItem('portal-theme', next ? 'dark' : 'light');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email.trim()) return;
        setLoading(true);
        setError('');
        try {
            const payload = { email: email.trim().toLowerCase() };
            if (askPassword) {
                payload.password = password;
            }
            const res = await fetch('/api/portal/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Something went wrong.');
            } else if (data.passwordRequired) {
                setAskPassword(true);
            } else {
                router.push(data.url);
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const d = dark;

    return (
        <div className={`min-h-screen relative overflow-hidden flex flex-col items-center justify-center px-4 transition-colors duration-500 ${d ? 'bg-[#07080f]' : 'bg-slate-50'}`}
            style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.4s' }}>

            {/* ── Animated background orbs ─────────────────────────── */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className={`absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full blur-3xl animate-pulse ${d ? 'bg-indigo-600/10' : 'bg-indigo-300/25'}`} style={{ animationDuration: '6s' }} />
                <div className={`absolute -bottom-40 -right-20 w-[500px] h-[500px] rounded-full blur-3xl animate-pulse ${d ? 'bg-violet-600/8' : 'bg-violet-200/30'}`} style={{ animationDuration: '8s', animationDelay: '2s' }} />
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[300px] rounded-full blur-3xl ${d ? 'bg-blue-600/5' : 'bg-blue-100/40'}`} />
                {/* Moving gradient ring */}
                <div className={`absolute top-1/3 right-1/4 w-64 h-64 rounded-full blur-2xl opacity-30 ${d ? 'bg-fuchsia-500/15' : 'bg-fuchsia-200/30'}`}
                    style={{ animation: 'float 10s ease-in-out infinite' }} />
            </div>

            <style>{`
                @keyframes float {
                    0%,100% { transform: translateY(0px) rotate(0deg); }
                    33% { transform: translateY(-20px) rotate(5deg); }
                    66% { transform: translateY(10px) rotate(-3deg); }
                }
                @keyframes fadeUp {
                    from { opacity:0; transform:translateY(24px); }
                    to   { opacity:1; transform:translateY(0); }
                }
                .fade-up { animation: fadeUp 0.6s cubic-bezier(.22,1,.36,1) both; }
                .fade-up-2 { animation: fadeUp 0.6s cubic-bezier(.22,1,.36,1) 0.1s both; }
                .fade-up-3 { animation: fadeUp 0.6s cubic-bezier(.22,1,.36,1) 0.2s both; }
            `}</style>

            {/* ── Theme toggle ─────────────────────────────────────── */}
            <button
                onClick={toggleTheme}
                className={`fixed top-5 right-5 z-50 w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-lg ${
                    d ? 'bg-white/[0.06] border border-white/10 text-white/50 hover:text-white hover:bg-white/10'
                      : 'bg-white border border-slate-200 text-slate-400 hover:text-slate-700 shadow-sm'
                }`}
            >
                {d ? <FiSun className="w-4 h-4" /> : <FiMoon className="w-4 h-4" />}
            </button>

            {/* ── Login Card ───────────────────────────────────────── */}
            <div className={`relative w-full max-w-md rounded-3xl overflow-hidden transition-all duration-500 ${
                d ? 'bg-white/[0.04] border border-white/[0.09] shadow-2xl shadow-black/50'
                  : 'bg-white/80 border border-white/60 shadow-2xl shadow-slate-200/60'
            }`}
                style={{ backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}>

                {/* Card top gradient bar */}
                <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />

                <div className="px-8 py-10">
                    {/* Brand */}
                    <div className="flex flex-col items-center mb-10 fade-up">
                        {brand.company_logo ? (
                            <img src={brand.company_logo} alt={brand.company_name || 'Logo'}
                                className={`w-16 h-16 rounded-2xl object-contain p-2 mb-4 border shadow-lg ${d ? 'bg-white/[0.06] border-white/10' : 'bg-white border-slate-100'}`} />
                        ) : (
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 text-2xl font-black border ${d ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' : 'bg-indigo-550 text-indigo-600 border-indigo-150'}`}>
                                {(brand.company_name || 'P')[0]}
                            </div>
                        )}
                        <h1 className={`text-xl font-bold tracking-tight ${d ? 'text-white' : 'text-slate-800'}`}>
                            {brand.company_name || 'Customer Portal'}
                        </h1>
                        {brand.company_tagline && (
                            <p className={`text-xs mt-1 text-center ${d ? 'text-white/35' : 'text-slate-400'}`}>{brand.company_tagline}</p>
                        )}
                    </div>

                    <div className="fade-up-2">
                        <h2 className={`text-base font-semibold mb-1 ${d ? 'text-white/80' : 'text-slate-700'}`}>
                            {askPassword ? 'Enter Portal Password' : 'Sign in to your account'}
                        </h2>
                        <p className={`text-sm mb-7 ${d ? 'text-white/30' : 'text-slate-450'}`}>
                            {askPassword ? `Please verify the security password for ${email}.` : 'Enter the email address associated with your account.'}
                        </p>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Email input */}
                            {!askPassword ? (
                                <div className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 border transition-all duration-200 focus-within:ring-2 ${
                                    d ? 'bg-white/[0.04] border-white/[0.09] focus-within:ring-indigo-500/30 focus-within:border-indigo-500/40'
                                      : 'bg-white border-slate-200 focus-within:ring-indigo-200 focus-within:border-indigo-350'
                                }`}>
                                    <FiMail className={`w-4 h-4 shrink-0 ${d ? 'text-white/25' : 'text-slate-350'} text-slate-400`} />
                                    <input
                                        type="email"
                                        placeholder="your@email.com"
                                        value={email}
                                        onChange={e => { setEmail(e.target.value); setError(''); }}
                                        required
                                        autoFocus
                                        className={`flex-1 bg-transparent text-sm outline-none placeholder:text-sm ${
                                            d ? 'text-white placeholder:text-white/20' : 'text-slate-800 placeholder:text-slate-300'
                                        }`}
                                    />
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 border transition-all duration-200 focus-within:ring-2 ${
                                        d ? 'bg-white/[0.04] border-white/[0.09] focus-within:ring-indigo-500/30 focus-within:border-indigo-500/40'
                                          : 'bg-white border-slate-200 focus-within:ring-indigo-200 focus-within:border-indigo-350'
                                    }`}>
                                        <FiLock className={`w-4 h-4 shrink-0 ${d ? 'text-white/25' : 'text-slate-350'} text-slate-400`} />
                                        <input
                                            type="password"
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={e => { setPassword(e.target.value); setError(''); }}
                                            required
                                            autoFocus
                                            className={`flex-1 bg-transparent text-sm outline-none placeholder:text-sm ${
                                                d ? 'text-white placeholder:text-white/20' : 'text-slate-800 placeholder:text-slate-350'
                                            }`}
                                        />
                                    </div>
                                    
                                    <button
                                        type="button"
                                        onClick={() => { setAskPassword(false); setPassword(''); setError(''); }}
                                        className={`flex items-center gap-1.5 text-xs font-semibold px-1 py-1 transition-colors ${
                                            d ? 'text-white/40 hover:text-white/70' : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                    >
                                        <FiArrowLeft className="w-3.5 h-3.5" /> Back to Email
                                    </button>
                                </div>
                            )}

                            {/* Error */}
                            {error && (
                                <div className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm border ${
                                    d ? 'bg-red-500/[0.08] border-red-500/20 text-red-300'
                                      : 'bg-red-50 border-red-100 text-red-650'
                                }`}>
                                    <FiAlertCircle className="w-4 h-4 shrink-0" />
                                    {error}
                                </div>
                            )}

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={loading || !email.trim() || (askPassword && !password)}
                                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-sm font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:translate-y-0"
                            >
                                {loading ? <FiLoader className="w-4 h-4 animate-spin" /> : <><span>{askPassword ? 'Verify & Access' : 'Access My Portal'}</span><FiArrowRight className="w-4 h-4" /></>}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Footer */}
                <div className={`px-8 py-4 border-t text-center text-xs ${d ? 'border-white/[0.06] text-white/15' : 'border-slate-100 text-slate-350'}`}>
                    {brand.company_name ? `© ${brand.company_name}` : 'Powered by Pressmatics ERP'}
                </div>
            </div>

            {/* Hint text */}
            <p className={`mt-6 text-xs fade-up-3 text-center ${d ? 'text-white/15' : 'text-slate-350'}`}>
                Your secure customer portal link will be provided automatically.
            </p>
        </div>
    );
}
