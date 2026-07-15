'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import {
    FiMessageCircle, FiCheck, FiTrash2, FiExternalLink, FiSearch,
    FiMessageSquare, FiSettings, FiActivity, FiArrowUpRight, FiArrowDownLeft,
    FiSend, FiRefreshCw, FiBookOpen
} from 'react-icons/fi';

export default function WhatsAppCenter() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('notifications');
    
    // Notifications (Replies & Acceptances)
    const [notifs, setNotifs] = useState([]);
    const [loadingNotifs, setLoadingNotifs] = useState(false);
    const [notifSearch, setNotifSearch] = useState('');
    const [notifFilter, setNotifFilter] = useState('all'); // 'all', 'unread', 'read'
    
    // Message Logs
    const [messages, setMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [msgSearch, setMsgSearch] = useState('');
    const [msgLimit, setMsgLimit] = useState(50);
    
    // Service Status
    const [waStatus, setWaStatus] = useState('LOADING');
    const [waQr, setWaQr] = useState(null);
    const [waProfile, setWaProfile] = useState(null);
    const [testNumber, setTestNumber] = useState('');
    const [testMessage, setTestMessage] = useState('This is a test message from Pressmatics WhatsApp Center!');
    const [sendingTest, setSendingTest] = useState(false);

    // Fetch Notifications
    const fetchNotifications = async () => {
        setLoadingNotifs(true);
        try {
            const unreadParam = notifFilter === 'unread' ? '&unread=true' : '';
            const res = await fetch(`/api/whatsapp/notifications?limit=100${unreadParam}`);
            if (res.ok) {
                const data = await res.json();
                setNotifs(data.notifications || []);
            }
        } catch {
            toast.error('Failed to load notifications');
        } finally {
            setLoadingNotifs(false);
        }
    };

    // Fetch Message Logs
    const fetchMessageLogs = async () => {
        setLoadingMessages(true);
        try {
            const searchParam = msgSearch ? `&search=${encodeURIComponent(msgSearch)}` : '';
            const res = await fetch(`/api/whatsapp/messages?limit=${msgLimit}${searchParam}`);
            if (res.ok) {
                const data = await res.json();
                setMessages(data.messages || []);
            }
        } catch {
            toast.error('Failed to load message logs');
        } finally {
            setLoadingMessages(false);
        }
    };

    // Fetch Live Connection Status
    const fetchConnectionStatus = async () => {
        try {
            const res = await fetch('/api/whatsapp/status');
            if (res.ok) {
                const data = await res.json();
                setWaStatus(data.state);
                setWaQr(data.qr);
                setWaProfile(data.profile);
            } else {
                setWaStatus('OFFLINE');
            }
        } catch {
            setWaStatus('OFFLINE');
        }
    };

    useEffect(() => {
        if (activeTab === 'notifications') {
            fetchNotifications();
        } else if (activeTab === 'logs') {
            fetchMessageLogs();
        } else if (activeTab === 'status') {
            fetchConnectionStatus();
        }
    }, [activeTab, notifFilter]);

    // Background poller for live connection status
    useEffect(() => {
        fetchConnectionStatus();
        const interval = setInterval(fetchConnectionStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    // Toggle Read/Unread State
    const handleToggleRead = async (notif) => {
        const nextState = !notif.is_read;
        try {
            const res = await fetch(`/api/whatsapp/notifications/${notif.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_read: nextState })
            });
            if (res.ok) {
                setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: nextState ? 1 : 0 } : n));
                toast.success(nextState ? 'Marked as read' : 'Marked as unread');
            }
        } catch {
            toast.error('Failed to update status');
        }
    };

    // Delete Notification
    const handleDeleteNotif = async (id) => {
        const confirmed = await confirmDialog('Are you sure you want to delete this notification?', {
            danger: true,
            confirmLabel: 'Delete'
        });
        if (!confirmed) return;

        try {
            const res = await fetch(`/api/whatsapp/notifications/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setNotifs(prev => prev.filter(n => n.id !== id));
                toast.success('Notification deleted');
            }
        } catch {
            toast.error('Failed to delete notification');
        }
    };

    // Mark All Read
    const handleMarkAllRead = async () => {
        const unreadList = notifs.filter(n => !n.is_read);
        if (unreadList.length === 0) return;

        try {
            let ok = true;
            for (const n of unreadList) {
                const res = await fetch(`/api/whatsapp/notifications/${n.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_read: true })
                });
                if (!res.ok) ok = false;
            }
            if (ok) {
                setNotifs(prev => prev.map(n => ({ ...n, is_read: 1 })));
                toast.success('All notifications marked as read');
            }
        } catch {
            toast.error('Error updating notifications');
        }
    };

    // Connection Control
    const handleConnect = async () => {
        try {
            setWaStatus('CONNECTING');
            const res = await fetch('/api/whatsapp/connect', { method: 'POST' });
            if (res.ok) {
                fetchConnectionStatus();
                toast.success('Initiating WhatsApp session');
            }
        } catch {
            toast.error('Failed to connect');
        }
    };

    const handleDisconnect = async () => {
        const confirmed = await confirmDialog('Are you sure you want to disconnect WhatsApp and clear the session?', {
            danger: true,
            confirmLabel: 'Disconnect'
        });
        if (!confirmed) return;

        try {
            setWaStatus('LOADING');
            const res = await fetch('/api/whatsapp/disconnect', { method: 'POST' });
            if (res.ok) {
                toast.success('WhatsApp disconnected successfully');
                fetchConnectionStatus();
            }
        } catch {
            toast.error('Failed to disconnect');
        }
    };

    // Test Message Sending
    const handleSendTest = async () => {
        if (!testNumber.trim() || !testMessage.trim()) {
            toast.error('Provide both target number and message content');
            return;
        }
        setSendingTest(true);
        try {
            const res = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ number: testNumber.trim(), message: testMessage.trim() })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success('WhatsApp message sent successfully!');
                setTestNumber('');
                if (activeTab === 'logs') fetchMessageLogs();
            } else {
                toast.error(data.error || 'Failed to send test message');
            }
        } catch {
            toast.error('Failed to send test message');
        } finally {
            setSendingTest(false);
        }
    };

    // Filtered Notifications based on Search & local Read/Unread matching
    const filteredNotifs = notifs.filter(n => {
        const matchesSearch = 
            (n.customer_name || '').toLowerCase().includes(notifSearch.toLowerCase()) ||
            (n.from_number || '').toLowerCase().includes(notifSearch.toLowerCase()) ||
            (n.quotation_code || '').toLowerCase().includes(notifSearch.toLowerCase()) ||
            (n.message_body || '').toLowerCase().includes(notifSearch.toLowerCase());
        
        if (notifFilter === 'unread') return matchesSearch && !n.is_read;
        if (notifFilter === 'read') return matchesSearch && n.is_read;
        return matchesSearch;
    });

    return (
        <div className="text-white w-full space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tighter flex items-center gap-2">
                        <FiMessageCircle className="text-emerald-400" />
                        WhatsApp Control Center
                    </h1>
                    <p className="text-gray-500 text-sm mt-0.5">Manage customer quotation acceptances, check message histories, and control connection states</p>
                </div>
                
                {/* Live Status indicator in header */}
                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold
                        ${waStatus === 'CONNECTED' 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                            : waStatus === 'QR' || waStatus === 'CONNECTING'
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                                : 'bg-red-500/10 border-red-500/20 text-red-400'
                        }`}>
                        <span className={`w-2 h-2 rounded-full ${waStatus === 'CONNECTED' ? 'bg-emerald-400 animate-pulse' : waStatus === 'QR' || waStatus === 'CONNECTING' ? 'bg-amber-400 animate-pulse' : 'bg-red-400'}`} />
                        {waStatus === 'CONNECTED' ? 'Live Connected' : waStatus === 'QR' ? 'Scan QR Code' : waStatus === 'CONNECTING' ? 'Connecting...' : 'Service Offline'}
                    </div>

                    <button 
                        onClick={() => {
                            if (activeTab === 'notifications') fetchNotifications();
                            if (activeTab === 'logs') fetchMessageLogs();
                            fetchConnectionStatus();
                        }}
                        className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        title="Refresh Data"
                    >
                        <FiRefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Tabs Selector */}
            <div className="flex border-b border-white/10 gap-6">
                <button
                    onClick={() => setActiveTab('notifications')}
                    className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all
                        ${activeTab === 'notifications' ? 'border-emerald-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}
                >
                    <FiMessageSquare className="w-4 h-4" />
                    Replies & Acceptances
                    {notifs.filter(n => !n.is_read).length > 0 && (
                        <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                            {notifs.filter(n => !n.is_read).length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('logs')}
                    className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all
                        ${activeTab === 'logs' ? 'border-emerald-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}
                >
                    <FiBookOpen className="w-4 h-4" />
                    Message Logs
                </button>
                <button
                    onClick={() => setActiveTab('status')}
                    className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all
                        ${activeTab === 'status' ? 'border-emerald-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}
                >
                    <FiSettings className="w-4 h-4" />
                    Service Configuration
                </button>
            </div>

            {/* Content Area */}
            <div className="w-full">
                
                {/* 1. NOTIFICATIONS TAB */}
                {activeTab === 'notifications' && (
                    <div className="space-y-4">
                        {/* Filters & Actions Bar */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-black/20 p-4 border border-white/10 rounded-2xl">
                            <div className="flex flex-1 items-center gap-3">
                                <div className="relative flex-1 max-w-sm">
                                    <FiSearch className="absolute left-3 top-3 text-gray-500 w-4 h-4" />
                                    <input
                                        type="text"
                                        placeholder="Search by customer, quote or message..."
                                        value={notifSearch}
                                        onChange={e => setNotifSearch(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:border-white/20 transition-colors"
                                    />
                                </div>

                                <div className="flex bg-black/40 border border-white/10 rounded-xl p-1 text-xs">
                                    <button 
                                        onClick={() => setNotifFilter('all')}
                                        className={`px-3 py-1.5 rounded-lg transition-all ${notifFilter === 'all' ? 'bg-white text-black font-semibold' : 'text-gray-400 hover:text-white'}`}>
                                        All
                                    </button>
                                    <button 
                                        onClick={() => setNotifFilter('unread')}
                                        className={`px-3 py-1.5 rounded-lg transition-all ${notifFilter === 'unread' ? 'bg-white text-black font-semibold' : 'text-gray-400 hover:text-white'}`}>
                                        Unread
                                    </button>
                                    <button 
                                        onClick={() => setNotifFilter('read')}
                                        className={`px-3 py-1.5 rounded-lg transition-all ${notifFilter === 'read' ? 'bg-white text-black font-semibold' : 'text-gray-400 hover:text-white'}`}>
                                        Read
                                    </button>
                                </div>
                            </div>

                            {notifs.some(n => !n.is_read) && (
                                <button
                                    onClick={handleMarkAllRead}
                                    className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
                                >
                                    <FiCheck className="w-3.5 h-3.5" />
                                    Mark All as Read
                                </button>
                            )}
                        </div>

                        {/* List/Table */}
                        <div className="bg-black/30 border border-white/10 rounded-2xl overflow-hidden">
                            {loadingNotifs ? (
                                <div className="p-8 text-center text-sm text-gray-500 animate-pulse">Loading notifications...</div>
                            ) : filteredNotifs.length === 0 ? (
                                <div className="p-12 text-center text-gray-500">
                                    <FiMessageSquare className="w-10 h-10 mx-auto text-gray-600 mb-2" />
                                    <p className="text-sm font-semibold">No notifications found</p>
                                    <p className="text-xs text-gray-600 mt-1">Try changing your filters or searching another keyword</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/[0.05]">
                                    {filteredNotifs.map(notif => (
                                        <div 
                                            key={notif.id} 
                                            className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-white/[0.01]
                                                ${!notif.is_read ? 'bg-emerald-500/[0.02] border-l-2 border-l-emerald-500' : ''}`}
                                        >
                                            <div className="flex-1 min-w-0 flex items-start gap-3">
                                                {/* Unread indicator */}
                                                {!notif.is_read && (
                                                    <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full mt-1.5 shrink-0" />
                                                )}
                                                
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold text-white">
                                                            {notif.customer_name || 'Unknown Contact'}
                                                        </span>
                                                        <span className="text-xs text-gray-500 font-mono">
                                                            ({notif.from_number})
                                                        </span>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                                            {notif.quotation_code || 'Quotation'}
                                                        </span>
                                                        <span className="text-gray-600">•</span>
                                                        <span className="text-gray-500">
                                                            {new Date(notif.received_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                                                        </span>
                                                    </div>

                                                    <p className="text-xs text-gray-400 italic bg-white/5 border border-white/[0.04] p-2.5 rounded-xl mt-2 font-mono">
                                                        "{notif.message_body}"
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                                {notif.quotation_id && (
                                                    <Link 
                                                        href={`/dashboard/quotations/${notif.quotation_id}`}
                                                        className="flex items-center gap-1 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                                                    >
                                                        <FiExternalLink className="w-3.5 h-3.5" />
                                                        View Quote
                                                    </Link>
                                                )}
                                                
                                                <button
                                                    onClick={() => handleToggleRead(notif)}
                                                    className={`p-2 rounded-lg border text-xs font-semibold transition-all
                                                        ${notif.is_read 
                                                            ? 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10' 
                                                            : 'bg-emerald-500/15 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white'
                                                        }`}
                                                    title={notif.is_read ? 'Mark as Unread' : 'Mark as Read'}
                                                >
                                                    <FiCheck className="w-4 h-4" />
                                                </button>

                                                <button
                                                    onClick={() => handleDeleteNotif(notif.id)}
                                                    className="p-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 rounded-lg transition-all"
                                                    title="Delete Notification"
                                                >
                                                    <FiTrash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 2. MESSAGE LOGS TAB */}
                {activeTab === 'logs' && (
                    <div className="space-y-4">
                        {/* Search & Configuration Bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-black/20 p-4 border border-white/10 rounded-2xl">
                            <div className="relative flex-1 max-w-md">
                                <FiSearch className="absolute left-3 top-3 text-gray-500 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Search message text, sender name or number..."
                                    value={msgSearch}
                                    onChange={e => setMsgSearch(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:border-white/20 transition-colors"
                                />
                            </div>

                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-gray-500">Show Limit:</span>
                                <select 
                                    value={msgLimit} 
                                    onChange={e => {
                                        setMsgLimit(Number(e.target.value));
                                    }}
                                    className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1 text-white outline-none focus:border-white/20 transition-colors"
                                >
                                    <option value={20}>20 rows</option>
                                    <option value={50}>50 rows</option>
                                    <option value={100}>100 rows</option>
                                    <option value={200}>200 rows</option>
                                </select>

                                <button
                                    onClick={fetchMessageLogs}
                                    className="bg-white text-black hover:bg-gray-100 px-3 py-1 text-xs font-semibold rounded-lg transition-colors"
                                >
                                    Apply
                                </button>
                            </div>
                        </div>

                        {/* Logs List */}
                        <div className="bg-black/30 border border-white/10 rounded-2xl overflow-hidden">
                            {loadingMessages ? (
                                <div className="p-8 text-center text-sm text-gray-500 animate-pulse">Loading logs...</div>
                            ) : messages.length === 0 ? (
                                <div className="p-12 text-center text-gray-500">
                                    <FiBookOpen className="w-10 h-10 mx-auto text-gray-600 mb-2" />
                                    <p className="text-sm font-semibold">No messages logged yet</p>
                                    <p className="text-xs text-gray-600 mt-1">Make sure you have sent or received messages through the database setup</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-white/[0.05] bg-white/[0.01] text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                                <th className="p-4 w-12 text-center">Direction</th>
                                                <th className="p-4">Recipient/Chat</th>
                                                <th className="p-4">Sender</th>
                                                <th className="p-4">Message</th>
                                                <th className="p-4 w-28 text-center">Type</th>
                                                <th className="p-4 w-20 text-center">Status</th>
                                                <th className="p-4 text-right">Time</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/[0.03]">
                                            {messages.map(msg => (
                                                <tr key={msg.id} className="hover:bg-white/[0.01] transition-colors text-xs">
                                                    <td className="p-4 text-center">
                                                        {msg.from_me ? (
                                                            <div className="inline-flex p-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg" title="Outgoing">
                                                                <FiArrowUpRight className="w-3.5 h-3.5" />
                                                            </div>
                                                        ) : (
                                                            <div className="inline-flex p-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg" title="Incoming">
                                                                <FiArrowDownLeft className="w-3.5 h-3.5" />
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-4 font-mono font-semibold text-gray-300">
                                                        {msg.chat_id}
                                                    </td>
                                                    <td className="p-4 font-medium text-white truncate max-w-[150px]">
                                                        {msg.sender_name || <span className="text-gray-600">—</span>}
                                                    </td>
                                                    <td className="p-4 text-gray-300 max-w-[300px] truncate" title={msg.message_body}>
                                                        {msg.message_body}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[10px] uppercase text-gray-400">
                                                            {msg.message_type || 'text'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold
                                                            ${msg.status === 'sent' 
                                                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                                                                : msg.status === 'read'
                                                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                                                    : 'bg-white/5 text-gray-400 border border-white/10'}`}>
                                                            {msg.status || 'unknown'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right text-gray-500 whitespace-nowrap">
                                                        {new Date(msg.sent_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 3. SERVICE STATUS TAB */}
                {activeTab === 'status' && (
                    <div className="grid md:grid-cols-2 gap-6">
                        
                        {/* Status Card */}
                        <div className="bg-black/30 border border-white/10 rounded-2xl overflow-hidden flex flex-col justify-between">
                            <div className="p-5 space-y-5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                                        <FiActivity className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-white">Connection Lifecycle</h3>
                                        <p className="text-xs text-gray-500">Monitor socket links and register accounts</p>
                                    </div>
                                </div>

                                {/* Connected info */}
                                {waStatus === 'CONNECTED' && waProfile && (
                                    <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4 space-y-3">
                                        <div className="flex items-center gap-3">
                                            {waProfile.avatar ? (
                                                <img src={waProfile.avatar} alt="Profile" className="w-12 h-12 rounded-full object-cover border border-emerald-500/25" />
                                            ) : (
                                                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-lg">
                                                    {(waProfile.name || 'W').charAt(0)}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-white truncate">{waProfile.name}</p>
                                                <p className="text-xs text-emerald-400 font-mono font-bold">{waProfile.id}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* QR Code Scan */}
                                {waStatus === 'QR' && waQr && (
                                    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-white/20 max-w-[240px] mx-auto space-y-3">
                                        <img src={waQr} alt="WhatsApp QR Code" className="w-48 h-48" />
                                        <p className="text-[10px] text-black font-semibold text-center uppercase tracking-wider">Scan with WhatsApp Link Devices</p>
                                    </div>
                                )}

                                {/* Offline/Standby */}
                                {(waStatus === 'OFFLINE' || waStatus === 'DISCONNECTED') && (
                                    <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-4 text-center">
                                        <p className="text-xs text-red-300 font-semibold">Service Not Initialized</p>
                                        <p className="text-[11px] text-gray-500 mt-1">Initiate a connection state to link a device via QR</p>
                                    </div>
                                )}

                                {/* Connecting indicator */}
                                {waStatus === 'CONNECTING' && (
                                    <div className="p-8 text-center text-xs text-gray-500 animate-pulse">
                                        Checking authentication keys or initializing QR code. Please wait...
                                    </div>
                                )}
                            </div>

                            {/* Control button footer */}
                            <div className="p-5 border-t border-white/[0.05] bg-black/20 flex gap-3">
                                {waStatus === 'CONNECTED' || waStatus === 'QR' ? (
                                    <button
                                        onClick={handleDisconnect}
                                        className="w-full bg-red-500/15 hover:bg-red-500 border border-red-500/20 text-red-400 hover:text-white py-2.5 rounded-xl text-xs font-semibold transition-all"
                                    >
                                        Disconnect WhatsApp Session
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleConnect}
                                        disabled={waStatus === 'CONNECTING'}
                                        className="w-full bg-white text-black hover:bg-gray-100 disabled:opacity-50 py-2.5 rounded-xl text-xs font-semibold transition-all"
                                    >
                                        {waStatus === 'CONNECTING' ? 'Connecting...' : 'Connect WhatsApp'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Test Panel Card */}
                        <div className="bg-black/30 border border-white/10 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                                        <FiSend className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-white">Interactive Sandbox</h3>
                                        <p className="text-xs text-gray-500">Send direct WhatsApp messages to verify credentials</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Recipient Number</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. 94789731507 (include country code)"
                                            value={testNumber}
                                            onChange={e => setTestNumber(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/20 transition-colors"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Message Content</label>
                                        <textarea
                                            rows={4}
                                            value={testMessage}
                                            onChange={e => setTestMessage(e.target.value)}
                                            placeholder="Type your test message..."
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/20 transition-colors font-mono resize-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleSendTest}
                                disabled={sendingTest || waStatus !== 'CONNECTED'}
                                className="w-full flex items-center justify-center gap-2 bg-emerald-500 disabled:opacity-50 text-white hover:bg-emerald-600 py-2.5 rounded-xl text-xs font-bold transition-all mt-4"
                            >
                                <FiSend className="w-3.5 h-3.5" />
                                {sendingTest ? 'Sending...' : waStatus !== 'CONNECTED' ? 'Connect Service to Send' : 'Send Test Message'}
                            </button>
                        </div>
                        
                    </div>
                )}

            </div>
        </div>
    );
}
