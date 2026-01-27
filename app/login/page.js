'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { FiLock, FiMail } from 'react-icons/fi';

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
        <div className="min-h-screen grid lg:grid-cols-2 bg-transparent relative">
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-center p-8 relative z-10"
            >
                <div className="w-full max-w-md space-y-8 p-8 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl">
                    <div className="space-y-2 text-center lg:text-left">
                        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl text-white">
                            Welcome back
                        </h1>
                        <p className="text-gray-400">Enter your credentials to access the ERP system</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div className="relative">
                                <Input
                                    name="email"
                                    type="email"
                                    placeholder="name@example.com"
                                    required
                                    className="pl-10 bg-black/50 border-white/10 focus:border-white/30 text-white placeholder:text-gray-500 rounded-lg"
                                />
                                <FiMail className="absolute left-3 top-3.5 text-gray-400" />
                            </div>
                            <div className="relative">
                                <Input
                                    name="password"
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    className="pl-10 bg-black/50 border-white/10 focus:border-white/30 text-white placeholder:text-gray-500 rounded-lg"
                                />
                                <FiLock className="absolute left-3 top-3.5 text-gray-400" />
                            </div>
                        </div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-sm text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20"
                            >
                                {error}
                            </motion.div>
                        )}

                        <Button type="submit" className="w-full bg-white text-black hover:bg-gray-200 rounded-lg">
                            Sign In
                        </Button>
                    </form>
                </div>
            </motion.div>

            <div className="hidden lg:flex flex-col relative items-center justify-center bg-black/20 backdrop-blur-sm p-12 text-white">
                <div className="space-y-4 max-w-lg relative z-10 text-center">
                    <h2 className="text-6xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-500">
                        Pressmatics
                    </h2>
                    <p className="text-gray-400 text-xl font-light">Precision Printing Management.</p>
                </div>
            </div>
        </div>
    );
}
