'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiArrowLeft, FiSave } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function EditCustomerPage({ params }) {
    const unwrappedParams = use(params);
    const id = unwrappedParams.id; // Unwrapping promise

    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: '', email: '', phone: '', address: '', is_vat: false, vat_number: ''
    });

    useEffect(() => {
        fetch(`/api/customers/${id}`)
            .then(res => res.json())
            .then(data => {
                setFormData(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                router.push('/dashboard/customers');
            });
    }, [id, router]);

    const handleChange = (e) => {
        const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFormData({ ...formData, [e.target.name]: val });
    };

    const handleSubmit = async () => {
        if (!formData.name) return alert("Name is required");
        setSaving(true);
        try {
            const res = await fetch(`/api/customers/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (res.ok) router.push('/dashboard/customers');
            else alert("Failed to update customer");
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-white">Loading...</div>;

    return (
        <div className="max-w-2xl mx-auto text-white">
            <header className="flex items-center gap-4 mb-8">
                <Link href="/dashboard/customers">
                    <Button className="bg-transparent border border-white/10 hover:bg-white/10 p-2"><FiArrowLeft /></Button>
                </Link>
                <h1 className="text-2xl font-bold tracking-tighter">Edit Customer</h1>
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

                {/* VAT Section */}
                <div className="border border-white/10 rounded-lg p-4 space-y-3 bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <input type="checkbox" id="is_vat" name="is_vat" checked={!!(formData.is_vat)} onChange={handleChange}
                            className="w-4 h-4 rounded border-white/20 bg-black/20 focus:ring-blue-500 cursor-pointer"/>
                        <label htmlFor="is_vat" className="text-sm text-gray-300 cursor-pointer font-medium">VAT Registered Customer</label>
                    </div>
                    {formData.is_vat && (
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">VAT Registration Number</label>
                            <Input name="vat_number" value={formData.vat_number || ''} onChange={handleChange} className="bg-secondary border-white/10" placeholder="e.g. VAT123456789" />
                        </div>
                    )}
                </div>

                <div className="pt-4">
                    <Button onClick={handleSubmit} disabled={saving} className="w-full bg-white text-black hover:bg-gray-200">
                        {saving ? 'Saving...' : 'Update Customer'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
