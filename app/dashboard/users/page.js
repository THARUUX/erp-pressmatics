'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
    FiUser, FiMail, FiShield, FiCalendar, FiSearch, FiUserPlus, 
    FiEdit2, FiTrash2, FiUserCheck, FiUserX, FiSettings, FiCheck, FiSave 
} from 'react-icons/fi';
import { confirmDialog } from '@/components/ui/ConfirmDialog';

export default function UsersPage() {
    const [tab, setTab] = useState('users'); // 'users' | 'permissions'
    
    // Users state
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modal states
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    
    // Add user form state
    const [addForm, setAddForm] = useState({ name: '', email: '', password: '', role: 'operator' });
    const [submittingAdd, setSubmittingAdd] = useState(false);
    
    // Edit user form state
    const [editForm, setEditForm] = useState({ name: '', email: '', role: '', password: '' });
    const [submittingEdit, setSubmittingEdit] = useState(false);

    // Roles & Permissions state
    const [rolesConfig, setRolesConfig] = useState({});
    const [selectedRole, setSelectedRole] = useState('operator');
    const [savingPermissions, setSavingPermissions] = useState(false);
    const [loadingRoles, setLoadingRoles] = useState(true);

    // Add custom role state
    const [showAddRoleModal, setShowAddRoleModal] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');

    const handleAddCustomRole = (e) => {
        e.preventDefault();
        const roleName = newRoleName.trim().toLowerCase().replace(/\s+/g, '_');
        if (!roleName) {
            toast.error('Role name cannot be empty');
            return;
        }
        if (rolesConfig[roleName]) {
            toast.error('Role already exists');
            return;
        }

        setRolesConfig(prev => ({
            ...prev,
            [roleName]: {
                access_dashboard: false,
                access_sales: false,
                access_production: false,
                access_hr: false,
                access_inventory: false,
                access_system: false
            }
        }));
        setSelectedRole(roleName);
        setNewRoleName('');
        setShowAddRoleModal(false);
        toast.success(`Role "${roleName}" added. Make sure to click save below to persist changes.`);
    };

    const handleDeleteCustomRole = async (roleName) => {
        if (['admin', 'manager', 'operator'].includes(roleName)) {
            toast.error('Default roles cannot be deleted');
            return;
        }
        const confirmed = await confirmDialog(
            `Are you sure you want to delete the role "${roleName}"? Make sure no active users are currently assigned to this role before deleting it.`,
            { danger: true, confirmLabel: 'Delete Role' }
        );
        if (!confirmed) return;

        setRolesConfig(prev => {
            const copy = { ...prev };
            delete copy[roleName];
            return copy;
        });
        if (selectedRole === roleName) {
            setSelectedRole('operator');
        }
        toast.success(`Role "${roleName}" removed. Click save below to persist the changes.`);
    };

    const PERMISSION_METADATA = [
        { key: 'access_dashboard', label: 'Dashboard & Analytics', desc: 'Grants access to main dashboard page, business statistics, and competitor analyses.' },
        { key: 'access_sales', label: 'Sales & Accounts', desc: 'Grants access to Customers, Quotations, Sales Orders, and Invoices modules.' },
        { key: 'access_production', label: 'Production & Planning', desc: 'Grants access to Estimations, Items list, Services database, and Job Planning scheduler.' },
        { key: 'access_hr', label: 'HR & Payroll', desc: 'Grants access to Employees list, Attendance sheets, and Payroll runs.' },
        { key: 'access_inventory', label: 'Inventory & Suppliers', desc: 'Grants access to Stock items, Finishings, Machines configs, and Suppliers directories.' },
        { key: 'access_system', label: 'System Administration', desc: 'Grants access to User accounts, Role groups permissions configuration, System settings, and WhatsApp integration.' }
    ];

    // Fetch users
    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const res = await fetch('/api/admin/users');
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            } else {
                toast.error('Failed to load users');
            }
        } catch {
            toast.error('Network error loading users');
        } finally {
            setLoadingUsers(false);
        }
    };

    // Fetch role permissions
    const fetchRoles = async () => {
        setLoadingRoles(true);
        try {
            const res = await fetch('/api/admin/roles');
            if (res.ok) {
                const data = await res.json();
                setRolesConfig(data);
                if (data && !Object.keys(data).includes(selectedRole)) {
                    setSelectedRole(Object.keys(data)[0] || 'operator');
                }
            } else {
                toast.error('Failed to load role permissions');
            }
        } catch {
            toast.error('Network error loading permissions');
        } finally {
            setLoadingRoles(false);
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchRoles();
    }, []);

    // Filter users
    const filteredUsers = users.filter(u => 
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Create User
    const handleAddUser = async (e) => {
        e.preventDefault();
        if (!addForm.name || !addForm.email || !addForm.password || !addForm.role) {
            toast.error('Please fill all fields');
            return;
        }
        setSubmittingAdd(true);
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(addForm)
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('User created successfully');
                setShowAddModal(false);
                setAddForm({ name: '', email: '', password: '', role: 'operator' });
                fetchUsers();
            } else {
                toast.error(data.error || 'Failed to create user');
            }
        } catch {
            toast.error('Network error creating user');
        } finally {
            setSubmittingAdd(false);
        }
    };

    // Open Edit Modal
    const openEditModal = (user) => {
        setSelectedUser(user);
        setEditForm({ name: user.name, email: user.email, role: user.role, password: '' });
        setShowEditModal(true);
    };

    // Edit User
    const handleEditUser = async (e) => {
        e.preventDefault();
        setSubmittingEdit(true);
        try {
            const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editForm.name,
                    email: editForm.email,
                    role: editForm.role,
                    password: editForm.password || undefined
                })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('User updated successfully');
                setShowEditModal(false);
                fetchUsers();
            } else {
                toast.error(data.error || 'Failed to update user');
            }
        } catch {
            toast.error('Network error updating user');
        } finally {
            setSubmittingEdit(false);
        }
    };

    // Ban/Unban user
    const handleToggleBan = async (user) => {
        const action = user.is_banned ? 'unban' : 'ban';
        const confirmed = await confirmDialog(
            `Are you sure you want to ${action} ${user.name}?${
                action === 'ban' ? ' They will be blocked from logging in immediately.' : ''
            }`,
            { danger: action === 'ban', confirmLabel: action === 'ban' ? 'Ban User' : 'Unban User' }
        );
        if (!confirmed) return;

        try {
            const res = await fetch(`/api/admin/users/${user.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_banned: !user.is_banned })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(`User successfully ${user.is_banned ? 'unbanned' : 'banned'}`);
                fetchUsers();
            } else {
                toast.error(data.error || `Failed to ${action} user`);
            }
        } catch {
            toast.error('Network error performing action');
        }
    };

    // Delete user
    const handleDeleteUser = async (user) => {
        const confirmed = await confirmDialog(
            `Are you sure you want to delete ${user.name}? This action cannot be undone and will permanently remove their credentials.`,
            { danger: true, confirmLabel: 'Delete User' }
        );
        if (!confirmed) return;

        try {
            const res = await fetch(`/api/admin/users/${user.id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('User deleted successfully');
                fetchUsers();
            } else {
                toast.error(data.error || 'Failed to delete user');
            }
        } catch {
            toast.error('Network error deleting user');
        }
    };

    // Toggle Permission flag
    const handleTogglePermission = (permissionKey) => {
        setRolesConfig(prev => {
            const currentRolePermissions = prev[selectedRole] || {};
            return {
                ...prev,
                [selectedRole]: {
                    ...currentRolePermissions,
                    [permissionKey]: !currentRolePermissions[permissionKey]
                }
            };
        });
    };

    // Save Permissions config
    const handleSavePermissions = async () => {
        setSavingPermissions(true);
        try {
            const res = await fetch('/api/admin/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rolesConfig)
            });
            if (res.ok) {
                toast.success('Role permissions saved successfully');
                fetchRoles();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to save role permissions');
            }
        } catch {
            toast.error('Network error saving permissions');
        } finally {
            setSavingPermissions(false);
        }
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tighter text-white">Users & Permissions</h1>
                    <p className="text-gray-400 text-sm mt-1">Manage system user access, create accounts, restrict roles, and control permission mappings.</p>
                </div>
                <div className="flex gap-2 bg-black/30 border border-white/10 p-1 rounded-xl w-fit">
                    <button 
                        onClick={() => setTab('users')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                            tab === 'users' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        Users List
                    </button>
                    <button 
                        onClick={() => setTab('permissions')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                            tab === 'permissions' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        Role Permissions
                    </button>
                </div>
            </div>

            {/* TAB CONTENT: USERS LIST */}
            {tab === 'users' && (
                <div className="space-y-4">
                    {/* Controls */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-black/20 border border-white/5 p-4 rounded-2xl">
                        <div className="relative w-full sm:max-w-xs">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                            <input 
                                type="text" 
                                placeholder="Search by name or email..." 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-black/30 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:border-white/30 outline-none transition-colors"
                            />
                        </div>
                        <button 
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors shadow-lg cursor-pointer"
                        >
                            <FiUserPlus className="w-4 h-4" />
                            Add New User
                        </button>
                    </div>

                    {/* Table display */}
                    <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/[0.07] bg-white/[0.02]">
                                        <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">User</th>
                                        <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Role</th>
                                        <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                                        <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Created At</th>
                                        <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingUsers ? (
                                        <tr>
                                            <td colSpan="5" className="p-12 text-center text-gray-500">
                                                <div className="inline-block w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mb-2" />
                                                <p className="text-xs">Fetching users...</p>
                                            </td>
                                        </tr>
                                    ) : filteredUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="p-12 text-center text-gray-500 text-sm">
                                                No users found.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredUsers.map(u => (
                                            <tr key={u.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white font-semibold">
                                                            {u.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-sm text-white">{u.name}</div>
                                                            <div className="text-xs text-gray-400 mt-0.5">{u.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                                        u.role === 'admin' 
                                                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                                                            : u.role === 'manager'
                                                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                            : u.role === 'operator'
                                                            ? 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                                            : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                                    }`}>
                                                        <FiShield className="w-3 h-3" />
                                                        {u.role}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                                                        u.is_banned
                                                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                    }`}>
                                                        {u.is_banned ? 'Banned' : 'Active'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-sm text-gray-400 font-mono">
                                                    {new Date(u.created_at).toLocaleDateString(undefined, { 
                                                        year: 'numeric', 
                                                        month: 'short', 
                                                        day: 'numeric' 
                                                    })}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button 
                                                            onClick={() => openEditModal(u)}
                                                            title="Edit User"
                                                            className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors cursor-pointer"
                                                        >
                                                            <FiEdit2 className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleToggleBan(u)}
                                                            title={u.is_banned ? 'Unban User' : 'Ban User'}
                                                            className={`p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer ${
                                                                u.is_banned ? 'text-emerald-400 hover:text-emerald-300' : 'text-amber-400 hover:text-amber-300'
                                                            }`}
                                                        >
                                                            {u.is_banned ? <FiUserCheck className="w-4 h-4" /> : <FiUserX className="w-4 h-4" />}
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteUser(u)}
                                                            title="Delete User"
                                                            className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
                                                        >
                                                            <FiTrash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: ROLE PERMISSIONS */}
            {tab === 'permissions' && (
                <div className="space-y-4">
                    {/* Role selector switcher */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex flex-wrap gap-2 p-1 bg-black/20 border border-white/5 rounded-2xl w-fit">
                            {Object.keys(rolesConfig).map(role => (
                                <div key={role} className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedRole(role)}
                                        className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
                                            selectedRole === role ? 'bg-white text-black' : 'text-gray-400 hover:text-white'
                                        }`}
                                    >
                                        {role}
                                    </button>
                                    {!['admin', 'manager', 'operator'].includes(role) && (
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteCustomRole(role)}
                                            title="Delete Role"
                                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer mr-1"
                                        >
                                            <FiTrash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowAddRoleModal(true)}
                            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                        >
                            + Add Custom Role
                        </button>
                    </div>

                    {/* Permissions checklist config */}
                    <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.07] bg-black/20">
                            <FiSettings className="w-5 h-5 text-gray-400" />
                            <h2 className="text-sm font-semibold text-white">Access Capabilities Configuration</h2>
                        </div>
                        
                        <div className="divide-y divide-white/[0.05]">
                            {PERMISSION_METADATA.map(perm => {
                                const isEnabled = !!rolesConfig[selectedRole]?.[perm.key];
                                return (
                                    <div key={perm.key} className="flex items-center justify-between p-5 gap-6 hover:bg-white/[0.01] transition-colors">
                                        <div className="space-y-1">
                                            <p className="text-sm font-semibold text-white">{perm.label}</p>
                                            <p className="text-xs text-gray-400 leading-relaxed max-w-xl">{perm.desc}</p>
                                        </div>
                                        <div>
                                            <div 
                                                onClick={() => handleTogglePermission(perm.key)}
                                                className={`w-12 h-6 rounded-full cursor-pointer relative transition-colors ${
                                                    isEnabled ? 'bg-white' : 'bg-white/10'
                                                }`}
                                            >
                                                <div className={`w-5 h-5 bg-black rounded-full absolute top-0.5 transition-all ${
                                                    isEnabled ? 'right-0.5' : 'left-0.5'
                                                }`} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex justify-end p-5 bg-black/10 border-t border-white/[0.05]">
                            <button
                                onClick={handleSavePermissions}
                                disabled={savingPermissions || loadingRoles}
                                className="flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors shadow-lg disabled:opacity-50 cursor-pointer"
                            >
                                {savingPermissions ? (
                                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <FiSave className="w-4 h-4" />
                                )}
                                {savingPermissions ? 'Saving Config...' : 'Save Role Configuration'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ADD USER MODAL */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl max-w-md w-full overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.8)] animate-[fadeUp_0.2s_ease]">
                        <div className="px-6 py-5 border-b border-white/[0.07] bg-white/[0.01]">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <FiUserPlus className="text-gray-400" />
                                Add User Account
                            </h3>
                        </div>
                        <form onSubmit={handleAddUser} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Full Name</label>
                                <div className="relative">
                                    <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                                    <input 
                                        type="text" 
                                        required
                                        value={addForm.name}
                                        onChange={e => setAddForm(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g. John Doe"
                                        className="w-full pl-9 pr-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white focus:border-white/30 outline-none transition-colors"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Email Address</label>
                                <div className="relative">
                                    <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                                    <input 
                                        type="email" 
                                        required
                                        value={addForm.email}
                                        onChange={e => setAddForm(prev => ({ ...prev, email: e.target.value }))}
                                        placeholder="e.g. john@example.com"
                                        className="w-full pl-9 pr-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white focus:border-white/30 outline-none transition-colors"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Role Group</label>
                                <select 
                                    value={addForm.role}
                                    onChange={e => setAddForm(prev => ({ ...prev, role: e.target.value }))}
                                    className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white focus:border-white/30 outline-none transition-colors [color-scheme:dark]"
                                >
                                    {Object.keys(rolesConfig).map(role => (
                                        <option key={role} value={role}>
                                            {role.charAt(0).toUpperCase() + role.slice(1)} {['admin', 'manager', 'operator'].includes(role) ? `(Default)` : `(Custom)`}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Password</label>
                                <input 
                                    type="password" 
                                    required
                                    value={addForm.password}
                                    onChange={e => setAddForm(prev => ({ ...prev, password: e.target.value }))}
                                    placeholder="••••••••"
                                    className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white focus:border-white/30 outline-none transition-colors"
                                />
                            </div>

                            <div className="flex gap-2 pt-2 justify-end">
                                <button 
                                    type="button" 
                                    onClick={() => setShowAddModal(false)}
                                    className="px-5 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm font-semibold hover:bg-white/5 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={submittingAdd}
                                    className="flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors shadow-lg disabled:opacity-50 cursor-pointer"
                                >
                                    {submittingAdd && <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />}
                                    Create Account
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* EDIT USER MODAL */}
            {showEditModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl max-w-md w-full overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.8)] animate-[fadeUp_0.2s_ease]">
                        <div className="px-6 py-5 border-b border-white/[0.07] bg-white/[0.01]">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <FiEdit2 className="text-gray-400" />
                                Edit Account details
                            </h3>
                        </div>
                        <form onSubmit={handleEditUser} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Full Name</label>
                                <div className="relative">
                                    <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                                    <input 
                                        type="text" 
                                        required
                                        value={editForm.name}
                                        onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g. John Doe"
                                        className="w-full pl-9 pr-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white focus:border-white/30 outline-none transition-colors"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Email Address</label>
                                <div className="relative">
                                    <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                                    <input 
                                        type="email" 
                                        required
                                        value={editForm.email}
                                        onChange={e => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                                        placeholder="e.g. john@example.com"
                                        className="w-full pl-9 pr-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white focus:border-white/30 outline-none transition-colors"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Role Group</label>
                                <select 
                                    value={editForm.role}
                                    onChange={e => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                                    className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white focus:border-white/30 outline-none transition-colors [color-scheme:dark]"
                                >
                                    {Object.keys(rolesConfig).map(role => (
                                        <option key={role} value={role}>
                                            {role.charAt(0).toUpperCase() + role.slice(1)} {['admin', 'manager', 'operator'].includes(role) ? `(Default)` : `(Custom)`}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">New Password (leave blank to keep current)</label>
                                <input 
                                    type="password" 
                                    value={editForm.password}
                                    onChange={e => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                                    placeholder="••••••••"
                                    className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white focus:border-white/30 outline-none transition-colors"
                                />
                            </div>

                            <div className="flex gap-2 pt-2 justify-end">
                                <button 
                                    type="button" 
                                    onClick={() => setShowEditModal(false)}
                                    className="px-5 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm font-semibold hover:bg-white/5 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={submittingEdit}
                                    className="flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors shadow-lg disabled:opacity-50 cursor-pointer"
                                >
                                    {submittingEdit && <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />}
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ADD ROLE MODAL */}
            {showAddRoleModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl max-w-md w-full overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.8)] animate-[fadeUp_0.2s_ease]">
                        <div className="px-6 py-5 border-b border-white/[0.07] bg-white/[0.01]">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <FiSettings className="text-gray-400" />
                                Create Custom Role
                            </h3>
                        </div>
                        <form onSubmit={handleAddCustomRole} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Role Name</label>
                                <input 
                                    type="text" 
                                    required
                                    value={newRoleName}
                                    onChange={e => setNewRoleName(e.target.value)}
                                    placeholder="e.g. Estimator, Supervisor"
                                    className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white focus:border-white/30 outline-none transition-colors"
                                />
                                <p className="text-[11px] text-gray-500 mt-1">Special characters and spaces will be converted to underscores.</p>
                            </div>

                            <div className="flex gap-2 pt-2 justify-end">
                                <button 
                                    type="button" 
                                    onClick={() => setShowAddRoleModal(false)}
                                    className="px-5 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm font-semibold hover:bg-white/5 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors shadow-lg cursor-pointer"
                                >
                                    Create Role
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            <style>{`
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(12px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
}
