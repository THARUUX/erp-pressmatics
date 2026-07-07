'use client';
import toast from 'react-hot-toast';

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
        name: '', email: '', phone: '', address: '', is_vat: false, vat_number: '',
        contact_name: '', contact_phone: '', contact_email: '', contact_role: '',
        starting_outstanding: '', category: ''
    });

    const handleChange = (e) => {
        const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFormData({ ...formData, [e.target.name]: val });
    };

    const handleSubmit = async () => {
        if (!formData.name) return toast.error("Name is required");
        setLoading(true);
        try {
            const res = await fetch('/api/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (res.ok) router.push('/dashboard/customers');
            else toast.error("Failed to create customer");
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
                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Customer Name *</label>
                        <Input name="name" value={formData.name} onChange={handleChange} className="bg-secondary border-white/10" placeholder="Business or Person Name" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Category</label>
                        <Input name="category" value={formData.category} onChange={handleChange} className="bg-secondary border-white/10" placeholder="e.g. VIP, Corporate, Retail" />
                    </div>
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

                {/* Contact Person Section */}
                <div className="border-t border-white/5 pt-4 mt-4 space-y-3">
                    <h3 className="text-sm font-semibold text-gray-300">Contact Person Details</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Contact Name</label>
                            <Input name="contact_name" value={formData.contact_name} onChange={handleChange} className="bg-secondary border-white/10" placeholder="e.g. John Doe" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Role / Designation</label>
                            <Input name="contact_role" value={formData.contact_role} onChange={handleChange} className="bg-secondary border-white/10" placeholder="e.g. Purchasing Manager" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Contact Email</label>
                            <Input name="contact_email" type="email" value={formData.contact_email} onChange={handleChange} className="bg-secondary border-white/10" placeholder="e.g. john@acme.com" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Contact Phone</label>
                            <Input name="contact_phone" value={formData.contact_phone} onChange={handleChange} className="bg-secondary border-white/10" placeholder="e.g. +1 555-0199" />
                        </div>
                    </div>
                </div>

                {/* Financial Section */}
                <div className="border-t border-white/5 pt-4 mt-2 space-y-3">
                    <h3 className="text-sm font-semibold text-gray-300">Financial</h3>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Starting Outstanding Balance</label>
                        <p className="text-[11px] text-gray-600 mb-2">Enter any pre-existing unpaid balance this customer carries before using the ERP.</p>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-mono">LKR</span>
                            <input
                                type="number"
                                name="starting_outstanding"
                                value={formData.starting_outstanding}
                                onChange={handleChange}
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                                className="w-full bg-secondary border border-white/10 rounded-lg pl-12 pr-4 py-2 text-sm text-amber-300 placeholder-gray-600 outline-none focus:border-amber-400/40 transition-colors font-mono"
                            />
                        </div>
                    </div>
                </div>

                {/* VAT Section */}
                <div className="border border-white/10 rounded-lg p-4 space-y-3 bg-white/[0.02]">

                    <div className="flex items-center gap-3">
                        <input type="checkbox" id="is_vat" name="is_vat" checked={!!formData.is_vat} onChange={handleChange}
                            className="w-4 h-4 rounded border-white/20 bg-black/20 focus:ring-blue-500 cursor-pointer"/>
                        <label htmlFor="is_vat" className="text-sm text-gray-300 cursor-pointer font-medium">VAT Registered Customer</label>
                    </div>
                    {formData.is_vat && (
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">VAT Registration Number</label>
                            <Input name="vat_number" value={formData.vat_number} onChange={handleChange} className="bg-secondary border-white/10" placeholder="e.g. VAT123456789" />
                        </div>
                    )}
                </div>

                <Button onClick={handleSubmit} disabled={loading} className="w-full bg-white text-black hover:bg-gray-200">
                    {loading ? 'Saving...' : 'Create Customer'}
                </Button>
            </div>
        </div>
    );
}
