'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiArrowLeft, FiSave } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function NewCustomerPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '', email: '', phone: '', address: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async () => {
        if (!formData.name) return alert("Name is required");
        setLoading(true);
        try {
            const res = await fetch('/api/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (res.ok) router.push('/dashboard/customers');
            else alert("Failed to create customer");
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto text-white">
            <header className="flex items-center gap-4 mb-8">
                <Link href="/dashboard/customers">
                    <Button className="bg-transparent border border-white/10 hover:bg-white/10 p-2"><FiArrowLeft /></Button>
                </Link>
                <h1 className="text-2xl font-bold tracking-tighter">New Customer</h1>
            </header>

            <div className="bg-black/40 backdrop-blur-md p-6 rounded-xl border border-white/10 space-y-4">
                <div>
                    <label className="block text-sm text-gray-400 mb-1">Customer Name *</label>
                    <Input name="name" value={formData.name} onChange={handleChange} className="bg-secondary border-white/10" placeholder="Business or Person Name" />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Email</label>
                        <Input name="email" value={formData.email} onChange={handleChange} className="bg-secondary border-white/10" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Phone</label>
                        <Input name="phone" value={formData.phone} onChange={handleChange} className="bg-secondary border-white/10" />
                    </div>
                </div>
                <div>
                    <label className="block text-sm text-gray-400 mb-1">Address</label>
                    <textarea
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        className="w-full bg-secondary border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-white/30 transition-colors h-24"
                    />
                </div>

                <div className="pt-4">
                    <Button onClick={handleSubmit} disabled={loading} className="w-full bg-white text-black hover:bg-gray-200">
                        {loading ? 'Saving...' : 'Create Customer'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
