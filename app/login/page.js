'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiPrinter, FiMail, FiLock, FiAlertCircle } from 'react-icons/fi';

export default function LoginPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Company selection state
    const [companyNames, setCompanyNames] = useState({
        company1: 'Pressmatics Co. 1',
        company2: 'Pressmatics Co. 2'
    });
    const [selectedCompany, setSelectedCompany] = useState('1');

    // Success splash state
    const [loginSuccessData, setLoginSuccessData] = useState(null);
    const [progressWidth, setProgressWidth] = useState('0%');

    // Fetch dynamic company names on mount
    useEffect(() => {
        fetch('/api/auth/companies')
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data) {
                    setCompanyNames({
                        company1: data.company1,
                        company2: data.company2
                    });
                }
            })
            .catch(() => {});
    }, []);

    // Handle splash redirect
    useEffect(() => {
        if (loginSuccessData) {
            // Initiate progress bar growth
            const progressTimer = setTimeout(() => {
                setProgressWidth('100%');
            }, 100);

            // Redirect to dashboard after animation completes
            const redirectTimer = setTimeout(() => {
                router.push('/dashboard');
            }, 2700);

            return () => {
                clearTimeout(progressTimer);
                clearTimeout(redirectTimer);
            };
        }
    }, [loginSuccessData, router]);

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        setError('');

        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: data.email, password: data.password }),
            });

            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Login failed');

            // Save selected company context in lax cookie
            document.cookie = `company_id=${selectedCompany}; path=/; max-age=31536000; SameSite=Lax`;

            // Trigger success splash overlay
            setLoginSuccessData({
                name: json.user?.name || 'Administrator',
                companyName: selectedCompany === '2' ? companyNames.company2 : companyNames.company1
            });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    if (loginSuccessData) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-black overflow-hidden relative px-4 text-center select-none">
                {/* Ambient background glows */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-emerald-600/15 rounded-full blur-[140px]" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-white/[0.01] rounded-full blur-[90px]" />
                </div>

                {/* Splash container */}
                <div className="relative space-y-7 max-w-md w-full animate-[fadeIn_0.6s_ease]">
                    {/* Bouncing glowing printer logo - Emerald themed */}
                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-[28px] bg-white/5 border border-white/10 relative shadow-[0_0_60px_rgba(16,185,129,0.25)] animate-[bounce_2s_infinite]">
                        <FiPrinter className="w-11 h-11 text-emerald-400" />
                        <div className="absolute inset-0 rounded-[28px] border border-emerald-500/20 animate-ping opacity-75" />
                    </div>

                    <div className="space-y-3">
                        <h2 className="text-3xl font-extrabold tracking-tight text-white animate-[slideUp_0.4s_ease]">
                            Welcome back, {loginSuccessData.name}!
                        </h2>
                        <p className="text-white/50 text-sm font-medium tracking-wide animate-[slideUp_0.6s_ease_both]">
                            Logging you into <span className="text-emerald-400 font-extrabold">{loginSuccessData.companyName}</span>
                        </p>
                    </div>

                    {/* Premium Progress Bar */}
                    <div className="w-64 mx-auto bg-white/5 h-1.5 rounded-full overflow-hidden border border-white/5 relative">
                        <div 
                            className="bg-gradient-to-r from-emerald-500 to-green-500 h-full rounded-full transition-all duration-[2400ms] ease-out"
                            style={{ width: progressWidth }}
                        />
                    </div>
                    
                    <p className="text-[10px] text-white/30 tracking-[0.2em] uppercase animate-pulse">
                        Configuring environment...
                    </p>
                </div>

                <style>{`
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to   { opacity: 1; }
                    }
                    @keyframes slideUp {
                        from { opacity: 0; transform: translateY(16px); }
                        to   { opacity: 1; transform: translateY(0); }
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-black overflow-hidden relative px-4">
            {/* Ambient background glows */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-48 -left-48 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[120px]" />
                <div className="absolute -bottom-48 -right-32 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/[0.015] rounded-full blur-[80px]" />
            </div>

            {/* Very subtle dot-grid texture */}
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.04]"
                style={{
                    backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
                    backgroundSize: '28px 28px',
                }}
            />

            {/* Glass card */}
            <div className="relative w-full max-w-[400px] rounded-3xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-2xl shadow-[0_32px_80px_rgba(0,0,0,0.7)] overflow-hidden">
                {/* Top shimmer line */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                <div className="px-8 pt-10 pb-9 space-y-7">
                    {/* Logo */}
                    <div className="text-center space-y-2">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/5 border border-white/10 mb-1">
                            <FiPrinter className="w-6 h-6 text-white/80" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tighter text-white">
                            Pressmatics
                        </h1>
                        <p className="text-sm text-white/35 font-medium">
                            Sign in to your workspace
                        </p>
                    </div>

                    {/* Error Alert */}
                    {error && (
                        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3 animate-[fadeUp_0.18s_ease]">
                            <FiAlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-300 leading-relaxed">{error}</p>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Company Selection */}
                        <div className="space-y-1.5">
                            <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-[0.1em]">
                                Select Workspace
                            </label>
                            <div className="flex bg-white/5 p-1 rounded-xl border border-white/[0.09] gap-1">
                                <button
                                    type="button"
                                    onClick={() => setSelectedCompany('1')}
                                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                                        selectedCompany === '1'
                                            ? 'bg-white/[0.08] text-white border border-white/10 shadow-sm'
                                            : 'text-gray-400 hover:text-white border border-transparent'
                                    }`}
                                >
                                    {companyNames.company1}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedCompany('2')}
                                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                                        selectedCompany === '2'
                                            ? 'bg-white/[0.08] text-white border border-white/10 shadow-sm'
                                            : 'text-gray-400 hover:text-white border border-transparent'
                                    }`}
                                >
                                    {companyNames.company2}
                                </button>
                            </div>
                        </div>

                        {/* Email */}
                        <div className="space-y-1.5">
                            <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-[0.1em]">
                                Email address
                            </label>
                            <div className="relative">
                                <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                                <input
                                    name="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    required
                                    autoComplete="email"
                                    className="w-full pl-10 pr-4 py-3 bg-white/[0.05] border border-white/[0.09] rounded-xl text-sm text-white placeholder-white/20 outline-none focus:border-white/25 focus:bg-white/[0.08] transition-all"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-[0.1em]">
                                Password
                            </label>
                            <div className="relative">
                                <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                                <input
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    required
                                    autoComplete="current-password"
                                    className="w-full pl-10 pr-12 py-3 bg-white/[0.05] border border-white/[0.09] rounded-xl text-sm text-white placeholder-white/20 outline-none focus:border-white/25 focus:bg-white/[0.08] transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(v => !v)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors text-xs font-semibold select-none cursor-pointer"
                                >
                                    {showPassword ? 'Hide' : 'Show'}
                                </button>
                            </div>
                        </div>

                        {/* Submit */}
                        <div className="pt-1">
                            <button
                                type="submit"
                                disabled={loading}
                                className="relative w-full py-3 rounded-xl font-semibold text-sm text-white bg-white/10 border border-white/15 hover:bg-white/15 hover:border-white/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all overflow-hidden group cursor-pointer"
                            >
                                {/* Button shimmer on hover */}
                                <span className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                                <span className="relative flex items-center justify-center gap-2">
                                    {loading && (
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    )}
                                    {loading ? 'Signing in…' : 'Sign In'}
                                </span>
                            </button>
                        </div>
                    </form>

                    {/* Footer note */}
                    <p className="text-center text-[11px] text-white/20 leading-relaxed">
                        Pressmatics ERP &middot; Internal Platform
                    </p>
                </div>

                {/* Bottom shimmer line */}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>

            <style>{`
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(6px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
