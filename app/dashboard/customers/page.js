'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiArrowLeft } from 'react-icons/fi';
import Button from '@/components/ui/Button';

export default function CustomersPage() {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const fetchCustomers = () => {
        setLoading(true);
        const url = search ? `/api/customers?search=${search}` : '/api/customers';
        fetch(url)
            .then(res => res.json())
            .then(data => {
                setCustomers(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchCustomers();
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const handleDelete = async (id) => {
        if (!confirm("Delete this customer?")) return;
        try {
            const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
            if (res.ok) fetchCustomers();
            else alert("Failed to delete (might be used in quotations)");
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="text-white">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tighter">Customers</h1>
                    <p className="text-gray-400 text-sm mt-1">Manage your client base</p>
                </div>
                <Link href="/dashboard/customers/new">
                    <Button className="flex items-center gap-2 bg-white text-black hover:bg-gray-200">
                        <FiPlus /> New Customer
                    </Button>
                </Link>
            </header>

            <div className="mb-6 relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search customers..."
                    className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:border-white/30 outline-none"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 border-b border-white/10 text-gray-400">
                        <tr>
                            <th className="p-4 font-normal">ID</th>
                            <th className="p-4 font-normal">Name</th>
                            <th className="p-4 font-normal">Email</th>
                            <th className="p-4 font-normal">Phone</th>
                            <th className="p-4 font-normal text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {loading ? (
                            <tr><td colSpan="4" className="p-8 text-center text-gray-500">Loading...</td></tr>
                        ) : customers?.length === 0 ? (
                            <tr><td colSpan="4" className="p-8 text-center text-gray-500">No customers found.</td></tr>
                        ) : (
                            customers?.map(c => (
                                <tr key={c.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4 text-gray-500 font-mono text-xs">{c.code || `#${c.id}`}</td>
                                    <td className="p-4 font-medium">{c.name}</td>
                                    <td className="p-4 text-gray-400">{c.email || '-'}</td>
                                    <td className="p-4 text-gray-400">{c.phone || '-'}</td>
                                    <td className="p-4 text-right flex justify-end gap-2">
                                        <Link href={`/dashboard/customers/${c.id}`}>
                                            <button className="p-2 text-blue-400 hover:bg-blue-500/10 rounded"><FiEdit2 /></button>
                                        </Link>
                                        <button onClick={() => handleDelete(c.id)} className="p-2 text-red-400 hover:bg-red-500/10 rounded"><FiTrash2 /></button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
