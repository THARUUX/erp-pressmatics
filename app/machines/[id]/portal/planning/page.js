'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { FiCpu, FiAlertCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import MachinePlanning from '@/app/dashboard/job-planning/components/MachinePlanning';

export default function StandaloneSharedMachinePlanningPage({ params }) {
    const { id } = use(params);
    const [machine, setMachine] = useState(null);
    const [orders, setOrders] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/common-portal/machines/${id}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setMachine(data.machine);
            setEmployees(data.employees || []);

            // Format cross-company tasks into the orders structure expected by MachinePlanning
            const orderMap = new Map();
            (data.tasks || []).forEach(t => {
                const soId = t.sales_order_id || `manual-${t.id}`;
                if (!orderMap.has(soId)) {
                    orderMap.set(soId, {
                        id: t.sales_order_id,
                        code: t.order_code || `SO-${t.sales_order_id || 'MANUAL'}`,
                        customer_name: t.customer_name || 'Walk-in Customer',
                        delivery_date: t.delivery_date,
                        status: t.order_status || 'In Production',
                        tasks: []
                    });
                }
                orderMap.get(soId).tasks.push(t);
            });

            setOrders(Array.from(orderMap.values()));
        } catch (e) {
            toast.error(e.message || 'Failed to load shared machine planning data');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (loading) {
        return (
            <div className="py-24 text-center space-y-3">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-gray-400 text-xs">Loading shared machine planning workspace...</p>
            </div>
        );
    }

    if (!machine?.is_common) {
        return (
            <div className="py-20 text-center bg-black/40 border border-white/10 rounded-2xl max-w-lg mx-auto p-8 space-y-4">
                <FiAlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
                <h3 className="text-lg font-extrabold text-white">Planning Section Unavailable</h3>
                <p className="text-xs text-gray-400">
                    The Planning Section is exclusive to <span className="text-purple-300 font-bold">Shared Machines</span> (cross-company resources).
                </p>
                <a
                    href={`/machines/${id}/portal`}
                    className="inline-block bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all"
                >
                    Return to Task Execution Portal
                </a>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <MachinePlanning
                machines={[machine]}
                finishings={[]}
                orders={orders}
                employees={employees}
                onRefresh={loadData}
            />
        </div>
    );
}
