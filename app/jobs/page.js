'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    FiCamera, FiSearch, FiAlertTriangle, FiLoader, FiArrowRight, FiMaximize2
} from 'react-icons/fi';
import { Html5Qrcode } from 'html5-qrcode';

export default function JobScannerPage() {
    const router = useRouter();
    const [scanning, setScanning] = useState(true);
    const [scanError, setScanError] = useState('');
    const [resolving, setResolving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [manualInput, setManualInput] = useState('');

    useEffect(() => {
        let html5Qrcode = null;
        if (scanning) {
            const timer = setTimeout(() => {
                try {
                    setScanError('');
                    html5Qrcode = new Html5Qrcode('qr-reader-container');
                    html5Qrcode.start(
                        { facingMode: 'environment' },
                        {
                            fps: 10,
                            qrbox: { width: 250, height: 250 }
                        },
                        (decodedText) => {
                            handleResolve(decodedText);
                            if (html5Qrcode && html5Qrcode.isScanning) {
                                html5Qrcode.stop()
                                    .then(() => setScanning(false))
                                    .catch(console.error);
                            }
                        },
                        (errorMessage) => {
                            // Suppress noisy frame scan errors
                        }
                    ).catch(err => {
                        console.error('Failed to start camera:', err);
                        setScanError(String(err.message || err));
                    });
                } catch (e) {
                    console.error('Html5Qrcode init error:', e);
                    setScanError(String(e.message || e));
                }
            }, 300);

            return () => {
                clearTimeout(timer);
                if (html5Qrcode && html5Qrcode.isScanning) {
                    html5Qrcode.stop().catch(console.error);
                }
            };
        }
    }, [scanning]);

    const handleResolve = async (text) => {
        if (!text || !text.trim()) return;
        setResolving(true);
        setErrorMsg('');
        try {
            const res = await fetch(`/api/jobs/resolve?query=${encodeURIComponent(text.trim())}`);
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Job not found');
            }
            const data = await res.json();
            if (data.id) {
                router.push(`/jobs/${data.id}`);
            } else {
                throw new Error('Could not resolve job ID');
            }
        } catch (err) {
            console.error('Resolve error:', err);
            setErrorMsg(err.message || 'Error resolving code. Try again.');
            setResolving(false);
            // Re-enable scanning if it was stopped
            setScanning(true);
        }
    };

    const handleManualSubmit = (e) => {
        e.preventDefault();
        handleResolve(manualInput);
    };

    return (
        <div className="min-h-screen bg-black text-neutral-100 flex flex-col font-sans select-none relative pb-10">
            {/* Ambient glowing blobs */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-20 left-0 w-[350px] h-[350px] bg-emerald-600/5 rounded-full blur-[100px]" />
            </div>

            {/* Header bar */}
            <header className="sticky top-0 z-40 bg-neutral-900/80 backdrop-blur-md border-b border-white/[0.08] px-4 py-4 flex items-center justify-between">
                <div>
                    <h1 className="text-base font-bold tracking-tight text-white m-0 flex items-center gap-1.5">
                        Pressmatics Job Scanner
                    </h1>
                    <p className="text-[10px] text-neutral-400 m-0 uppercase tracking-wider font-semibold">
                        Public Shop Floor Scan
                    </p>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 max-w-md w-full mx-auto px-4 pt-8 z-10 relative flex flex-col justify-center">
                <div className="space-y-6">
                    {/* Viewfinder Container */}
                    <div className="relative">
                        {resolving && (
                            <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center space-y-3">
                                <FiLoader className="w-8 h-8 text-indigo-400 animate-spin" />
                                <p className="text-xs font-semibold text-neutral-300">Resolving Job Ticket...</p>
                            </div>
                        )}

                        {scanError ? (
                            <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl text-center space-y-4">
                                <FiAlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
                                <div className="text-sm font-bold text-white">Camera Access Blocked</div>
                                <p className="text-xs text-neutral-400 leading-relaxed">
                                    Camera permission was denied or is blocked by your browser settings.
                                    Note: Browsers require a secure HTTPS connection or localhost to access physical cameras.
                                </p>
                                <button
                                    onClick={() => setScanning(true)}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-neutral-300 transition-all inline-flex items-center gap-1.5"
                                >
                                    <FiCamera className="w-4 h-4" /> Retry Camera
                                </button>
                            </div>
                        ) : (
                            <div className="relative w-full aspect-square overflow-hidden rounded-3xl border border-white/10 shadow-2xl bg-neutral-950/80 backdrop-blur-md">
                                <div id="qr-reader-container" className="w-full h-full relative">
                                    {/* Custom Scanning viewfinder overlay */}
                                    <div className="absolute inset-8 border border-white/15 rounded-2xl pointer-events-none z-10 flex flex-col items-center justify-between p-4">
                                        <div className="flex justify-between w-full">
                                            <div className="w-4 h-4 border-t-2 border-l-2 border-indigo-400 rounded-tl" />
                                            <div className="w-4 h-4 border-t-2 border-r-2 border-indigo-400 rounded-tr" />
                                        </div>
                                        <div className="w-full h-0.5 bg-indigo-500/30 shadow-[0_0_8px_rgba(99,102,241,0.5)] animate-pulse" />
                                        <div className="flex justify-between w-full">
                                            <div className="w-4 h-4 border-b-2 border-l-2 border-indigo-400 rounded-bl" />
                                            <div className="w-4 h-4 border-b-2 border-r-2 border-indigo-400 rounded-br" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Feedback and Manual Input Form */}
                    <div className="bg-neutral-900/60 backdrop-blur-xl border border-white/[0.08] p-5 rounded-3xl space-y-4">
                        {errorMsg && (
                            <div className="bg-red-500/10 border border-red-500/25 px-3.5 py-2.5 rounded-xl flex gap-2 text-red-400 text-xs items-center">
                                <FiAlertTriangle className="w-4 h-4 shrink-0" />
                                <div>{errorMsg}</div>
                            </div>
                        )}

                        <form onSubmit={handleManualSubmit} className="space-y-3">
                            <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                    Manual Fallback Input
                                </label>
                                <p className="text-[10px] text-neutral-500">
                                    Type the Sales Order code (e.g. SO-0142) or paste a Job Ticket URL.
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                                    <input
                                        type="text"
                                        placeholder="Enter SO Code or URL..."
                                        value={manualInput}
                                        onChange={(e) => setManualInput(e.target.value)}
                                        className="w-full pl-10 pr-3 py-2.5 bg-black border border-white/[0.09] rounded-xl text-xs text-white placeholder-neutral-600 outline-none focus:border-indigo-500 transition-all"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={resolving || !manualInput.trim()}
                                    className="px-4 py-2.5 bg-indigo-600 border border-indigo-500 hover:bg-indigo-500 disabled:opacity-40 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1 cursor-pointer"
                                >
                                    <span>Open</span>
                                    <FiArrowRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {!scanError && (
                    <div className="text-center text-neutral-500 text-[11px] mt-8 flex items-center justify-center gap-1.5">
                        <FiMaximize2 className="w-3.5 h-3.5" />
                        <span>Center the Job Ticket QR code in the viewport to scan automatically.</span>
                    </div>
                )}
            </main>
        </div>
    );
}
