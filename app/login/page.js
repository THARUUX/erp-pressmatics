'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

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
                body: JSON.stringify(data),
            });

            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Login failed');
            router.push('/dashboard');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <style>{`
                .login-page {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #0f0f0f 100%);
                    padding: 1rem;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                .login-card {
                    width: 100%;
                    max-width: 420px;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 20px;
                    padding: 2.5rem;
                    backdrop-filter: blur(20px);
                    box-shadow: 0 25px 50px rgba(0,0,0,0.5);
                }
                .login-logo {
                    text-align: center;
                    margin-bottom: 2rem;
                }
                .login-logo h1 {
                    font-size: 2rem;
                    font-weight: 800;
                    background: linear-gradient(90deg, #ffffff, #a78bfa);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    letter-spacing: -0.5px;
                    margin: 0 0 0.25rem 0;
                }
                .login-logo p {
                    color: rgba(255,255,255,0.4);
                    font-size: 0.875rem;
                    margin: 0;
                }
                .login-form {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                .field-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.375rem;
                }
                .field-label {
                    font-size: 0.8rem;
                    font-weight: 500;
                    color: rgba(255,255,255,0.6);
                    letter-spacing: 0.03em;
                    text-transform: uppercase;
                }
                .field-input {
                    background: rgba(255,255,255,0.06);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 10px;
                    padding: 0.75rem 1rem;
                    color: #ffffff;
                    font-size: 0.95rem;
                    outline: none;
                    transition: border-color 0.2s, background 0.2s;
                    width: 100%;
                    box-sizing: border-box;
                }
                .field-input::placeholder {
                    color: rgba(255,255,255,0.25);
                }
                .field-input:focus {
                    border-color: rgba(167,139,250,0.6);
                    background: rgba(255,255,255,0.08);
                }
                .error-box {
                    background: rgba(239,68,68,0.1);
                    border: 1px solid rgba(239,68,68,0.25);
                    border-radius: 10px;
                    padding: 0.75rem 1rem;
                    color: #f87171;
                    font-size: 0.875rem;
                    text-align: center;
                }
                .submit-btn {
                    background: linear-gradient(135deg, #7c3aed, #a78bfa);
                    border: none;
                    border-radius: 10px;
                    padding: 0.875rem;
                    color: #ffffff;
                    font-size: 0.95rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: opacity 0.2s, transform 0.1s;
                    margin-top: 0.5rem;
                    width: 100%;
                    letter-spacing: 0.02em;
                }
                .submit-btn:hover:not(:disabled) {
                    opacity: 0.9;
                    transform: translateY(-1px);
                }
                .submit-btn:active:not(:disabled) {
                    transform: translateY(0);
                }
                .submit-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .spinner {
                    display: inline-block;
                    width: 14px;
                    height: 14px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top-color: #fff;
                    border-radius: 50%;
                    animation: spin 0.7s linear infinite;
                    margin-right: 8px;
                    vertical-align: middle;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>

            <div className="login-page">
                <div className="login-card">
                    <div className="login-logo">
                        <h1>Pressmatics</h1>
                        <p>ERP · Sign in to your account</p>
                    </div>

                    <form onSubmit={handleSubmit} className="login-form">
                        <div className="field-group">
                            <label className="field-label">Email</label>
                            <input
                                name="email"
                                type="email"
                                placeholder="admin@pressmatics.com"
                                required
                                className="field-input"
                                autoComplete="email"
                            />
                        </div>

                        <div className="field-group">
                            <label className="field-label">Password</label>
                            <input
                                name="password"
                                type="password"
                                placeholder="••••••••"
                                required
                                className="field-input"
                                autoComplete="current-password"
                            />
                        </div>

                        {error && <div className="error-box">{error}</div>}

                        <button
                            type="submit"
                            disabled={loading}
                            className="submit-btn"
                        >
                            {loading && <span className="spinner" />}
                            {loading ? 'Signing in…' : 'Sign In'}
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
}
