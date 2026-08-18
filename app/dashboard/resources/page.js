'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FiFolder, FiFolderPlus, FiLink, FiExternalLink, FiCopy, FiEdit3,
    FiTrash2, FiChevronRight, FiChevronDown, FiSearch, FiPlus,
    FiHome, FiGrid, FiList, FiGlobe,
    FiCode, FiBook, FiDatabase, FiLayers, FiShield, FiCpu, FiStar,
    FiCheck, FiX, FiRefreshCw, FiServer, FiFileText, FiDroplet
} from 'react-icons/fi';
import toast from 'react-hot-toast';

// Available color presets for folders and links
const COLOR_PRESETS = [
    { id: 'blue', label: 'Sky Blue', bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', glow: 'shadow-blue-500/20' },
    { id: 'emerald', label: 'Emerald Green', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', glow: 'shadow-emerald-500/20' },
    { id: 'purple', label: 'Electric Purple', bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', glow: 'shadow-purple-500/20' },
    { id: 'amber', label: 'Warm Amber', bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', glow: 'shadow-amber-500/20' },
    { id: 'rose', label: 'Neon Rose', bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-400', glow: 'shadow-rose-500/20' },
    { id: 'cyan', label: 'Cyan Glow', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400', glow: 'shadow-cyan-500/20' },
    { id: 'indigo', label: 'Deep Indigo', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', text: 'text-indigo-400', glow: 'shadow-indigo-500/20' },
];

const THEME_CONFIGS = {
    blue: {
        id: 'blue',
        label: 'Sky Blue',
        dot: 'bg-blue-500',
        text: 'text-blue-400',
        textHover: 'hover:text-blue-400',
        textLight: 'text-blue-300',
        bgBtn: 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20',
        bgSubtle: 'bg-blue-500/10',
        borderSubtle: 'border-blue-500/20',
        borderFocus: 'focus:border-blue-500',
        activeNav: 'bg-blue-600/20 text-white font-bold border border-blue-500/30',
        badge: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        gradient: 'from-blue-500/20 via-purple-500/20 to-emerald-500/20',
        contextHover: 'hover:bg-blue-500/20 hover:text-blue-300',
        emptyBtn: 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border-blue-500/30',
        groupHoverText: 'group-hover:text-blue-400',
    },
    emerald: {
        id: 'emerald',
        label: 'Emerald Green',
        dot: 'bg-emerald-500',
        text: 'text-emerald-400',
        textHover: 'hover:text-emerald-400',
        textLight: 'text-emerald-300',
        bgBtn: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20',
        bgSubtle: 'bg-emerald-500/10',
        borderSubtle: 'border-emerald-500/20',
        borderFocus: 'focus:border-emerald-500',
        activeNav: 'bg-emerald-600/20 text-white font-bold border border-emerald-500/30',
        badge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        gradient: 'from-emerald-500/20 via-teal-500/20 to-blue-500/20',
        contextHover: 'hover:bg-emerald-500/20 hover:text-emerald-300',
        emptyBtn: 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/30',
        groupHoverText: 'group-hover:text-emerald-400',
    },
    purple: {
        id: 'purple',
        label: 'Electric Purple',
        dot: 'bg-purple-500',
        text: 'text-purple-400',
        textHover: 'hover:text-purple-400',
        textLight: 'text-purple-300',
        bgBtn: 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/20',
        bgSubtle: 'bg-purple-500/10',
        borderSubtle: 'border-purple-500/20',
        borderFocus: 'focus:border-purple-500',
        activeNav: 'bg-purple-600/20 text-white font-bold border border-purple-500/30',
        badge: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
        gradient: 'from-purple-500/20 via-pink-500/20 to-indigo-500/20',
        contextHover: 'hover:bg-purple-500/20 hover:text-purple-300',
        emptyBtn: 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border-purple-500/30',
        groupHoverText: 'group-hover:text-purple-400',
    },
    amber: {
        id: 'amber',
        label: 'Warm Amber',
        dot: 'bg-amber-500',
        text: 'text-amber-400',
        textHover: 'hover:text-amber-400',
        textLight: 'text-amber-300',
        bgBtn: 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20',
        bgSubtle: 'bg-amber-500/10',
        borderSubtle: 'border-amber-500/20',
        borderFocus: 'focus:border-amber-500',
        activeNav: 'bg-amber-600/20 text-white font-bold border border-amber-500/30',
        badge: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        gradient: 'from-amber-500/20 via-orange-500/20 to-rose-500/20',
        contextHover: 'hover:bg-amber-500/20 hover:text-amber-300',
        emptyBtn: 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border-amber-500/30',
        groupHoverText: 'group-hover:text-amber-400',
    },
    rose: {
        id: 'rose',
        label: 'Neon Rose',
        dot: 'bg-rose-500',
        text: 'text-rose-400',
        textHover: 'hover:text-rose-400',
        textLight: 'text-rose-300',
        bgBtn: 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20',
        bgSubtle: 'bg-rose-500/10',
        borderSubtle: 'border-rose-500/20',
        borderFocus: 'focus:border-rose-500',
        activeNav: 'bg-rose-600/20 text-white font-bold border border-rose-500/30',
        badge: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
        gradient: 'from-rose-500/20 via-red-500/20 to-pink-500/20',
        contextHover: 'hover:bg-rose-500/20 hover:text-rose-300',
        emptyBtn: 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border-rose-500/30',
        groupHoverText: 'group-hover:text-rose-400',
    },
    cyan: {
        id: 'cyan',
        label: 'Cyan Glow',
        dot: 'bg-cyan-500',
        text: 'text-cyan-400',
        textHover: 'hover:text-cyan-400',
        textLight: 'text-cyan-300',
        bgBtn: 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/20',
        bgSubtle: 'bg-cyan-500/10',
        borderSubtle: 'border-cyan-500/20',
        borderFocus: 'focus:border-cyan-500',
        activeNav: 'bg-cyan-600/20 text-white font-bold border border-cyan-500/30',
        badge: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
        gradient: 'from-cyan-500/20 via-blue-500/20 to-teal-500/20',
        contextHover: 'hover:bg-cyan-500/20 hover:text-cyan-300',
        emptyBtn: 'bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border-cyan-500/30',
        groupHoverText: 'group-hover:text-cyan-400',
    },
    indigo: {
        id: 'indigo',
        label: 'Deep Indigo',
        dot: 'bg-indigo-500',
        text: 'text-indigo-400',
        textHover: 'hover:text-indigo-400',
        textLight: 'text-indigo-300',
        bgBtn: 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20',
        bgSubtle: 'bg-indigo-500/10',
        borderSubtle: 'border-indigo-500/20',
        borderFocus: 'focus:border-indigo-500',
        activeNav: 'bg-indigo-600/20 text-white font-bold border border-indigo-500/30',
        badge: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
        gradient: 'from-indigo-500/20 via-purple-500/20 to-blue-500/20',
        contextHover: 'hover:bg-indigo-500/20 hover:text-indigo-300',
        emptyBtn: 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border-indigo-500/30',
        groupHoverText: 'group-hover:text-indigo-400',
    }
};

const ICON_MAP = {
    folder: FiFolder,
    globe: FiGlobe,
    code: FiCode,
    book: FiBook,
    database: FiDatabase,
    layers: FiLayers,
    shield: FiShield,
    cpu: FiCpu,
    star: FiStar,
    server: FiServer,
    file: FiFileText
};

function ResourcesExplorerContent() {
    const searchParams = useSearchParams();
    const pathname = usePathname();

    // Core data state
    const [categories, setCategories] = useState([]);
    const [links, setLinks] = useState([]);
    const [loading, setLoading] = useState(true);

    // Explorer navigation state
    const [currentFolderId, setCurrentFolderId] = useState(null); // null = Root
    const [expandedFolders, setExpandedFolders] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
    const [copiedLinkId, setCopiedLinkId] = useState(null);

    // Page Theme State
    const [themeKey, setThemeKey] = useState('blue');
    const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('resources_page_theme');
            if (saved && THEME_CONFIGS[saved]) {
                setThemeKey(saved);
            }
        }
    }, []);

    const changeTheme = (newKey) => {
        setThemeKey(newKey);
        if (typeof window !== 'undefined') {
            localStorage.setItem('resources_page_theme', newKey);
        }
    };

    const theme = THEME_CONFIGS[themeKey] || THEME_CONFIGS.blue;

    // Right Click Context Menu State
    const [contextMenu, setContextMenu] = useState({
        visible: false,
        x: 0,
        y: 0,
        type: null, // 'folder' | 'link' | 'canvas'
        item: null  // folder or link object
    });

    // Modal States
    const [folderModalOpen, setFolderModalOpen] = useState(false);
    const [editingFolder, setEditingFolder] = useState(null); // null for create
    const [folderForm, setFolderForm] = useState({ name: '', parent_id: '', description: '', icon: 'folder', color: 'blue' });

    const [linkModalOpen, setLinkModalOpen] = useState(false);
    const [editingLink, setEditingLink] = useState(null); // null for create
    const [linkForm, setLinkForm] = useState({ title: '', url: '', description: '', category_id: '', icon: 'globe', color: 'emerald', tags: '' });

    const [deleteConfirmModal, setDeleteConfirmModal] = useState({ open: false, type: null, item: null }); // type: 'folder' | 'link'

    // Synchronize initial folder state from URL query parameter e.g. /dashboard/resources?folder=12
    useEffect(() => {
        const folderParam = searchParams.get('folder');
        if (folderParam) {
            setCurrentFolderId(String(folderParam));
        } else {
            setCurrentFolderId(null);
        }
    }, [searchParams]);

    // Helper to update current folder state AND URL search params
    const navigateToFolder = useCallback((folderId) => {
        const targetId = folderId !== null && folderId !== undefined ? String(folderId) : null;
        setCurrentFolderId(targetId);
        setSearchQuery('');

        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (targetId) {
                params.set('folder', targetId);
            } else {
                params.delete('folder');
            }
            const newUrl = `${pathname}${params.toString() ? '?' + params.toString() : ''}`;
            window.history.replaceState(null, '', newUrl);
        }
    }, [pathname]);

    // Auto-expand all parent folders in directory tree on page load or folder navigation
    useEffect(() => {
        if (currentFolderId && categories.length > 0) {
            const newExpanded = {};
            let curr = currentFolderId;
            while (curr) {
                const cat = categories.find(c => String(c.id) === String(curr));
                if (cat && cat.parent_id !== null && cat.parent_id !== undefined) {
                    newExpanded[cat.parent_id] = true;
                    curr = String(cat.parent_id);
                } else {
                    break;
                }
            }
            if (Object.keys(newExpanded).length > 0) {
                setExpandedFolders(prev => ({ ...prev, ...newExpanded }));
            }
        }
    }, [currentFolderId, categories]);

    // Fetch resources data
    const fetchResources = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/resources');
            if (!res.ok) throw new Error('Failed to load resources');
            const data = await res.json();
            setCategories(data.categories || []);
            setLinks(data.links || []);
        } catch (err) {
            console.error(err);
            toast.error(err.message || 'Error loading resources');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchResources();
    }, [fetchResources]);

    // Close context menu on outside click or scroll or escape
    useEffect(() => {
        const handleCloseMenu = () => {
            setContextMenu(prev => prev.visible ? { ...prev, visible: false } : prev);
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') handleCloseMenu();
        };

        window.addEventListener('click', handleCloseMenu);
        window.addEventListener('scroll', handleCloseMenu, true);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('click', handleCloseMenu);
            window.removeEventListener('scroll', handleCloseMenu, true);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    // Right click handler positioning calculation
    const handleContextMenu = (e, type, item = null) => {
        e.preventDefault();
        e.stopPropagation();

        const mouseX = e.clientX;
        const mouseY = e.clientY;

        // Keep context menu inside screen viewport
        const menuWidth = 220;
        const menuHeight = 240;
        const x = mouseX + menuWidth > window.innerWidth ? window.innerWidth - menuWidth - 12 : mouseX;
        const y = mouseY + menuHeight > window.innerHeight ? window.innerHeight - menuHeight - 12 : mouseY;

        setContextMenu({
            visible: true,
            x,
            y,
            type,
            item
        });
    };

    // Expand/Collapse folder tree toggle
    const toggleFolderExpand = (folderId, e) => {
        if (e) e.stopPropagation();
        setExpandedFolders(prev => ({
            ...prev,
            [folderId]: !prev[folderId]
        }));
    };

    // Calculate breadcrumb trail from root to current folder
    const breadcrumbTrail = useMemo(() => {
        const trail = [];
        let curr = currentFolderId;
        while (curr !== null) {
            const cat = categories.find(c => String(c.id) === String(curr));
            if (cat) {
                trail.unshift(cat);
                curr = cat.parent_id !== null ? String(cat.parent_id) : null;
            } else {
                break;
            }
        }
        return trail;
    }, [categories, currentFolderId]);

    // Build hierarchical category tree
    const categoryTree = useMemo(() => {
        const buildNode = (parentId = null) => {
            return categories
                .filter(c => String(c.parent_id || '') === String(parentId || ''))
                .map(c => ({
                    ...c,
                    children: buildNode(c.id)
                }));
        };
        return buildNode(null);
    }, [categories]);

    // Helper to get formatted select list with indents for modal forms
    const flatSelectOptions = useMemo(() => {
        const options = [];
        const traverse = (nodes, depth = 0) => {
            nodes.forEach(node => {
                const indent = '— '.repeat(depth);
                options.push({
                    id: String(node.id),
                    label: `${indent}📁 ${node.name}`,
                    depth
                });
                if (node.children && node.children.length > 0) {
                    traverse(node.children, depth + 1);
                }
            });
        };
        traverse(categoryTree, 0);
        return options;
    }, [categoryTree]);

    // Direct children folders in current view
    const currentSubfolders = useMemo(() => {
        if (searchQuery.trim()) {
            return categories.filter(c =>
                c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()))
            );
        }
        return categories.filter(c => String(c.parent_id || '') === String(currentFolderId || ''));
    }, [categories, currentFolderId, searchQuery]);

    // Links in current view
    const currentLinks = useMemo(() => {
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            return links.filter(l =>
                l.title.toLowerCase().includes(q) ||
                l.url.toLowerCase().includes(q) ||
                (l.description && l.description.toLowerCase().includes(q)) ||
                (l.tags && l.tags.toLowerCase().includes(q))
            );
        }
        return links.filter(l => String(l.category_id || '') === String(currentFolderId || ''));
    }, [links, currentFolderId, searchQuery]);

    // Counts for folders and links
    const getFolderItemCount = useCallback((folderId) => {
        const childFoldersCount = categories.filter(c => String(c.parent_id || '') === String(folderId)).length;
        const childLinksCount = links.filter(l => String(l.category_id || '') === String(folderId)).length;
        return { childFoldersCount, childLinksCount, total: childFoldersCount + childLinksCount };
    }, [categories, links]);

    // Modal Handlers - Folders
    const openCreateFolderModal = (parentId = null) => {
        setEditingFolder(null);
        setFolderForm({
            name: '',
            parent_id: parentId !== null ? String(parentId) : (currentFolderId ? String(currentFolderId) : ''),
            description: '',
            icon: 'folder',
            color: 'blue'
        });
        setFolderModalOpen(true);
    };

    const openEditFolderModal = (folder, e) => {
        if (e) e.stopPropagation();
        setEditingFolder(folder);
        setFolderForm({
            name: folder.name,
            parent_id: folder.parent_id ? String(folder.parent_id) : '',
            description: folder.description || '',
            icon: folder.icon || 'folder',
            color: folder.color || 'blue'
        });
        setFolderModalOpen(true);
    };

    const handleSaveFolder = async (e) => {
        e.preventDefault();
        if (!folderForm.name.trim()) return toast.error('Please enter a folder name');

        try {
            const payload = {
                name: folderForm.name.trim(),
                parent_id: folderForm.parent_id ? parseInt(folderForm.parent_id, 10) : null,
                description: folderForm.description.trim() || null,
                icon: folderForm.icon,
                color: folderForm.color
            };

            let res;
            if (editingFolder) {
                res = await fetch(`/api/resources/categories/${editingFolder.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                res = await fetch('/api/resources/categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save folder');

            toast.success(editingFolder ? 'Folder updated!' : 'Folder created!');
            setFolderModalOpen(false);
            fetchResources();
            // Automatically expand parent folder
            if (payload.parent_id) {
                setExpandedFolders(prev => ({ ...prev, [payload.parent_id]: true }));
            }
        } catch (err) {
            toast.error(err.message || 'Error saving folder');
        }
    };

    // Modal Handlers - Links
    const openCreateLinkModal = (categoryId = null) => {
        setEditingLink(null);
        setLinkForm({
            title: '',
            url: '',
            description: '',
            category_id: categoryId !== null ? String(categoryId) : (currentFolderId ? String(currentFolderId) : ''),
            icon: 'globe',
            color: 'emerald',
            tags: ''
        });
        setLinkModalOpen(true);
    };

    const openEditLinkModal = (link, e) => {
        if (e) e.stopPropagation();
        setEditingLink(link);
        setLinkForm({
            title: link.title,
            url: link.url,
            description: link.description || '',
            category_id: link.category_id ? String(link.category_id) : '',
            icon: link.icon || 'globe',
            color: link.color || 'emerald',
            tags: link.tags || ''
        });
        setLinkModalOpen(true);
    };

    const handleSaveLink = async (e) => {
        e.preventDefault();
        if (!linkForm.title.trim()) return toast.error('Please enter a link title');
        if (!linkForm.url.trim()) return toast.error('Please enter a valid URL');

        try {
            const payload = {
                title: linkForm.title.trim(),
                url: linkForm.url.trim(),
                description: linkForm.description.trim() || null,
                category_id: linkForm.category_id ? parseInt(linkForm.category_id, 10) : null,
                icon: linkForm.icon,
                color: linkForm.color,
                tags: linkForm.tags.trim() || null
            };

            let res;
            if (editingLink) {
                res = await fetch(`/api/resources/links/${editingLink.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                res = await fetch('/api/resources/links', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save link');

            toast.success(editingLink ? 'Link updated!' : 'Link card created!');
            setLinkModalOpen(false);
            fetchResources();
        } catch (err) {
            toast.error(err.message || 'Error saving link');
        }
    };

    // Delete Handlers
    const confirmDelete = async () => {
        const { type, item } = deleteConfirmModal;
        if (!item) return;

        try {
            let res;
            if (type === 'folder') {
                res = await fetch(`/api/resources/categories/${item.id}`, { method: 'DELETE' });
            } else {
                res = await fetch(`/api/resources/links/${item.id}`, { method: 'DELETE' });
            }

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `Failed to delete ${type}`);

            toast.success(`${type === 'folder' ? 'Folder and all sub-items' : 'Link card'} deleted!`);
            setDeleteConfirmModal({ open: false, type: null, item: null });

            // If current active folder was deleted, navigate up to parent or root
            if (type === 'folder' && String(currentFolderId) === String(item.id)) {
                navigateToFolder(item.parent_id);
            }
            fetchResources();
        } catch (err) {
            toast.error(err.message || 'Delete operation failed');
        }
    };

    // Utility: Copy URL to clipboard
    const copyToClipboard = (url, linkId, e) => {
        if (e) e.stopPropagation();
        navigator.clipboard.writeText(url);
        setCopiedLinkId(linkId);
        toast.success('URL copied to clipboard!');
        setTimeout(() => setCopiedLinkId(null), 2000);
    };

    // Extract domain helper
    const extractDomain = (url) => {
        try {
            const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
            return parsed.hostname.replace(/^www\./, '');
        } catch {
            return 'External Link';
        }
    };

    // Render category sidebar tree recursively (supports unlimited nested depths)
    const renderSidebarTreeNode = (node, depth = 0) => {
        const isSelected = String(currentFolderId) === String(node.id);
        const isExpanded = !!expandedFolders[node.id];
        const hasChildren = node.children && node.children.length > 0;
        const colorPreset = COLOR_PRESETS.find(p => p.id === node.color) || COLOR_PRESETS[0];

        return (
            <div key={node.id} className="select-none">
                <div
                    onClick={() => navigateToFolder(node.id)}
                    onContextMenu={(e) => handleContextMenu(e, 'folder', node)}
                    className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer transition-all duration-150 ${isSelected
                        ? 'bg-white/15 text-white font-bold shadow-md border border-white/20'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    style={{ paddingLeft: `${Math.max(10, depth * 16 + 10)}px` }}
                >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        {hasChildren ? (
                            <button
                                onClick={(e) => toggleFolderExpand(node.id, e)}
                                className="text-gray-500 hover:text-white p-0.5 rounded transition-colors"
                            >
                                {isExpanded ? <FiChevronDown className="w-3.5 h-3.5" /> : <FiChevronRight className="w-3.5 h-3.5" />}
                            </button>
                        ) : (
                            <span className="w-3.5 inline-block" />
                        )}

                        <FiFolder className={`w-4 h-4 shrink-0 ${isSelected ? colorPreset.text : `${theme.text}/80 ${theme.groupHoverText}`}`} />
                        <span className="text-xs truncate">{node.name}</span>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                openCreateFolderModal(node.id);
                            }}
                            title="Add Child Folder"
                            className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-emerald-400 transition-colors"
                        >
                            <FiFolderPlus className="w-3 h-3" />
                        </button>
                        <button
                            onClick={(e) => openEditFolderModal(node, e)}
                            title="Edit Folder"
                            className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-sky-400 transition-colors"
                        >
                            <FiEdit3 className="w-3 h-3" />
                        </button>
                    </div>
                </div>

                {/* Recursive Sub-tree */}
                {hasChildren && isExpanded && (
                    <div className="space-y-0.5 mt-0.5">
                        {node.children.map(child => renderSidebarTreeNode(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div
            onContextMenu={(e) => handleContextMenu(e, 'canvas', null)}
            className="space-y-6 w-full max-w-[1600px] mx-auto min-h-screen text-white pb-24 relative select-none"
        >
            {/* Header Title & Global Toolbar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-6">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${theme.gradient} border border-white/10 flex items-center justify-center ${theme.text} shadow-lg`}>
                            <FiLayers className="w-5 h-5" />
                        </div>
                        Resources Explorer
                    </h1>
                    <p className="text-xs text-gray-400 mt-1">
                        Organize website links, tools, and documentation into infinite nested folder hierarchies. Right-click folders or link cards for context actions.
                    </p>
                </div>

                {/* Main Control Actions */}
                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Theme Selector Popover */}
                    <div className="relative">
                        <button
                            onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
                            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                            title="Change Theme Color"
                        >
                            <FiDroplet className={`w-4 h-4 ${theme.text}`} />
                            <span className="hidden sm:inline">Theme</span>
                            <span className={`w-2.5 h-2.5 rounded-full ${theme.dot}`} />
                        </button>

                        <AnimatePresence>
                            {themeDropdownOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                    className="absolute right-0 mt-2 z-50 w-52 bg-black border border-white/20 rounded-2xl p-2 shadow-2xl backdrop-blur-xl space-y-1"
                                >
                                    <div className="px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-gray-400 border-b border-white/10 mb-1 flex items-center justify-between">
                                        <span>Select Page Theme</span>
                                        <FiDroplet className={theme.text} />
                                    </div>
                                    {Object.values(THEME_CONFIGS).map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => {
                                                changeTheme(t.id);
                                                setThemeDropdownOpen(false);
                                            }}
                                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${themeKey === t.id
                                                ? `${t.bgSubtle} ${t.text} border ${t.borderSubtle}`
                                                : 'text-gray-300 hover:bg-white/5 hover:text-white'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <span className={`w-3 h-3 rounded-full ${t.dot}`} />
                                                <span>{t.label}</span>
                                            </div>
                                            {themeKey === t.id && <FiCheck className="w-3.5 h-3.5" />}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <button
                        onClick={() => openCreateFolderModal(currentFolderId)}
                        className={`px-3.5 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-2 shadow-lg transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${theme.bgBtn}`}
                    >
                        <FiFolderPlus className="w-4 h-4" />
                        <span>New Folder</span>
                    </button>

                    <button
                        onClick={() => openCreateLinkModal(currentFolderId)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <FiPlus className="w-4 h-4" />
                        <span>New Link Card</span>
                    </button>

                    <button
                        onClick={fetchResources}
                        disabled={loading}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 hover:text-white transition-all cursor-pointer"
                        title="Refresh Explorer"
                    >
                        <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Split Screen Explorer Container */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                {/* LEFT SIDEBAR: Recursive Folder Directory Tree */}
                <div className="lg:col-span-3 bg-black backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-4 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <span className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-2">
                            <FiFolder className={theme.text} /> Directory Tree
                        </span>
                        <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${theme.badge}`}>
                            {categories.length} folders
                        </span>
                    </div>

                    {/* Root Folder Button */}
                    <div
                        onClick={() => navigateToFolder(null)}
                        onContextMenu={(e) => handleContextMenu(e, 'canvas', null)}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all ${currentFolderId === null && !searchQuery
                            ? theme.activeNav
                            : 'text-gray-300 hover:bg-white/5 hover:text-white'
                            }`}
                    >
                        <div className="flex items-center gap-2.5">
                            <FiHome className={`w-4 h-4 ${theme.text}`} />
                            <span className="text-xs font-semibold">Root Explorer</span>
                        </div>
                        <span className="text-[10px] font-mono text-gray-500">
                            {categories.filter(c => !c.parent_id).length}
                        </span>
                    </div>

                    {/* Tree View List */}
                    <div className="space-y-1 max-h-[600px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">
                        {categoryTree.length === 0 ? (
                            <div className="text-center py-8 text-xs text-gray-500 italic">
                                No folders created yet. Click &quot;New Folder&quot; to start organizing.
                            </div>
                        ) : (
                            categoryTree.map(node => renderSidebarTreeNode(node, 0))
                        )}
                    </div>
                </div>

                {/* RIGHT MAIN CANVAS: Breadcrumb & Folder/Link Cards */}
                <div className="lg:col-span-9 space-y-6">

                    {/* Top Bar: Breadcrumbs + Search & View Toggle */}
                    <div className="bg-black backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xl">

                        {/* Breadcrumbs */}
                        <div className="flex items-center gap-1.5 flex-wrap text-xs text-gray-300 w-full md:w-auto">
                            <button
                                onClick={() => navigateToFolder(null)}
                                className={`flex items-center gap-1.5 font-bold ${theme.textHover} transition-colors cursor-pointer`}
                            >
                                <FiHome className={`w-3.5 h-3.5 ${theme.text}`} />
                                <span>Root</span>
                            </button>

                            {breadcrumbTrail.map((folder, idx) => (
                                <div key={folder.id} className="flex items-center gap-1.5">
                                    <FiChevronRight className="w-3.5 h-3.5 text-gray-600" />
                                    <button
                                        onClick={() => navigateToFolder(folder.id)}
                                        className={`font-semibold ${theme.textHover} transition-colors cursor-pointer ${idx === breadcrumbTrail.length - 1 ? 'text-white font-extrabold' : 'text-gray-400'
                                            }`}
                                    >
                                        {folder.name}
                                    </button>
                                </div>
                            ))}

                            {searchQuery && (
                                <div className="flex items-center gap-1.5">
                                    <FiChevronRight className="w-3.5 h-3.5 text-gray-600" />
                                    <span className="text-amber-400 font-mono font-bold">Search results for &quot;{searchQuery}&quot;</span>
                                </div>
                            )}
                        </div>

                        {/* Search & Layout Toggle Controls */}
                        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                            <div className="relative flex-1 md:w-64">
                                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-3.5 h-3.5" />
                                <input
                                    type="text"
                                    placeholder="Search folders or links..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className={`w-full bg-black border border-white/20 text-white placeholder-gray-500 text-xs rounded-xl pl-9 pr-8 py-2 focus:outline-none ${theme.borderFocus} transition-all`}
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                                    >
                                        <FiX className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1 shrink-0">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white/20 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                                    title="Grid View"
                                >
                                    <FiGrid className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white/20 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                                    title="List View"
                                >
                                    <FiList className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Canvas Main Content View */}
                    {loading ? (
                        <div className="py-24 text-center space-y-3">
                            <FiRefreshCw className={`w-8 h-8 ${theme.text} animate-spin mx-auto`} />
                            <p className="text-xs text-gray-400 font-mono">Loading Resource Explorer...</p>
                        </div>
                    ) : (
                        <div className="space-y-8 min-h-[450px]">

                            {/* SUBFOLDERS SECTION */}
                            {currentSubfolders.length > 0 && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-2">
                                            <FiFolder className={theme.text} />
                                            Child Folders ({currentSubfolders.length})
                                        </h3>
                                    </div>

                                    <div className={viewMode === 'grid'
                                        ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4"
                                        : "space-y-2"
                                    }>
                                        <AnimatePresence>
                                            {currentSubfolders.map((folder) => {
                                                const counts = getFolderItemCount(folder.id);
                                                const preset = COLOR_PRESETS.find(p => p.id === folder.color) || COLOR_PRESETS[0];

                                                return (
                                                    <motion.div
                                                        key={folder.id}
                                                        layout
                                                        initial={{ opacity: 0, scale: 0.95 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        exit={{ opacity: 0, scale: 0.95 }}
                                                        onClick={() => navigateToFolder(folder.id)}
                                                        onContextMenu={(e) => handleContextMenu(e, 'folder', folder)}
                                                        title={folder.description && folder.description}
                                                        // className={`group relative bg-black hover:bg-white/[0.08] border ${preset.border} rounded-2xl p-4 cursor-pointer transition-all duration-200 shadow-xl hover:${preset.glow} hover:-translate-y-0.5`}
                                                        className={`group relative rounded-2xl p-4 cursor-pointer transition-all duration-200  hover:${preset.glow} hover:-translate-y-0.5`}
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-10 h-10 rounded-xl ${preset.bg} border ${preset.border} flex items-center justify-center ${preset.text} shrink-0`}>
                                                                    <FiFolder className="w-5 h-5" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <h4 className={`text-sm font-bold text-white ${theme.groupHoverText} transition-colors truncate`}>
                                                                        {folder.name}
                                                                    </h4>
                                                                    <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                                                                        {counts.childFoldersCount} folders · {counts.childLinksCount} links
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {/* Action buttons */}
                                                            {/* <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openCreateFolderModal(folder.id);
                                                                    }}
                                                                    title="Add child subfolder inside"
                                                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-400 text-gray-400 transition-colors"
                                                                >
                                                                    <FiFolderPlus className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => openEditFolderModal(folder, e)}
                                                                    title="Edit / Rename Folder"
                                                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-sky-500/20 hover:text-sky-400 text-gray-400 transition-colors"
                                                                >
                                                                    <FiEdit3 className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setDeleteConfirmModal({ open: true, type: 'folder', item: folder });
                                                                    }}
                                                                    title="Delete Folder"
                                                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 text-gray-400 transition-colors"
                                                                >
                                                                    <FiTrash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div> */}
                                                        </div>

                                                        {/* {folder.description && (
                                                            <p className="text-xs text-gray-400/80 mt-3 line-clamp-2 leading-relaxed">
                                                                {folder.description}
                                                            </p>
                                                        )} */}
                                                    </motion.div>
                                                );
                                            })}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            )}

                            {/* RESOURCE LINK CARDS SECTION */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-2">
                                        <FiLink className="text-emerald-400" />
                                        Link Cards ({currentLinks.length})
                                    </h3>

                                    {currentFolderId !== null && (
                                        <button
                                            onClick={() => openCreateLinkModal(currentFolderId)}
                                            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer transition-colors"
                                        >
                                            <FiPlus className="w-3.5 h-3.5" /> Add Link Here
                                        </button>
                                    )}
                                </div>

                                {currentLinks.length === 0 && currentSubfolders.length === 0 ? (
                                    <div
                                        onContextMenu={(e) => handleContextMenu(e, 'canvas', null)}
                                        className="py-20 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01] space-y-4"
                                    >
                                        <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-gray-500 mx-auto border border-white/10">
                                            <FiFolder className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-extrabold text-white">This folder is empty</p>
                                            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                                                Right-click anywhere or use the buttons below to create subfolders or link cards inside this folder.
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-center gap-3 pt-2">
                                            <button
                                                onClick={() => openCreateFolderModal(currentFolderId)}
                                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${theme.emptyBtn}`}
                                            >
                                                + Create Subfolder
                                            </button>
                                            <button
                                                onClick={() => openCreateLinkModal(currentFolderId)}
                                                className="px-3.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer"
                                            >
                                                + Add Link Card
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={viewMode === 'grid'
                                        ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                                        : "space-y-3"
                                    }>
                                        <AnimatePresence>
                                            {currentLinks.map((link) => {
                                                const preset = COLOR_PRESETS.find(p => p.id === link.color) || COLOR_PRESETS[1];
                                                const IconComponent = ICON_MAP[link.icon] || FiGlobe;
                                                const domain = extractDomain(link.url);
                                                const isCopied = copiedLinkId === link.id;

                                                return (
                                                    <motion.div
                                                        key={link.id}
                                                        layout
                                                        initial={{ opacity: 0, scale: 0.95 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        exit={{ opacity: 0, scale: 0.95 }}
                                                        onContextMenu={(e) => handleContextMenu(e, 'link', link)}
                                                        className={`group relative bg-black hover:bg-white/[0.08] border ${preset.border} rounded-2xl p-4 space-y-3 transition-all duration-200 shadow-xl hover:${preset.glow} hover:-translate-y-0.5 flex flex-col justify-between`}
                                                    >
                                                        <div>
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="flex items-center gap-3 min-w-0">
                                                                    <div className={`w-10 h-10 rounded-xl ${preset.bg} border ${preset.border} flex items-center justify-center ${preset.text} shrink-0`}>
                                                                        <IconComponent className="w-5 h-5" />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors truncate">
                                                                            {link.title}
                                                                        </h4>
                                                                        <span className="text-[10px] font-mono text-gray-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full inline-block mt-0.5 truncate max-w-[160px]">
                                                                            {domain}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Edit & Delete Link Buttons */}
                                                                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity shrink-0">
                                                                    <button
                                                                        onClick={(e) => copyToClipboard(link.url, link.id, e)}
                                                                        title="Copy URL"
                                                                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white transition-colors"
                                                                    >
                                                                        {isCopied ? <FiCheck className="w-3.5 h-3.5 text-emerald-400" /> : <FiCopy className="w-3.5 h-3.5" />}
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => openEditLinkModal(link, e)}
                                                                        title="Edit Link Card"
                                                                        className="p-1.5 rounded-lg bg-white/5 hover:bg-sky-500/20 hover:text-sky-400 text-gray-400 transition-colors"
                                                                    >
                                                                        <FiEdit3 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setDeleteConfirmModal({ open: true, type: 'link', item: link });
                                                                        }}
                                                                        title="Delete Link Card"
                                                                        className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 text-gray-400 transition-colors"
                                                                    >
                                                                        <FiTrash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {link.description && (
                                                                <p className="text-xs text-gray-300/80 mt-3 line-clamp-3 leading-relaxed">
                                                                    {link.description}
                                                                </p>
                                                            )}

                                                            {/* Tags */}
                                                            {link.tags && (
                                                                <div className="flex flex-wrap gap-1 mt-3">
                                                                    {link.tags.split(',').map((tag, i) => (
                                                                        <span key={i} className="text-[10px] text-gray-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                                                                            #{tag.trim()}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Open URL Link Button */}
                                                        <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                                                            <span className="text-[10px] text-gray-500 truncate max-w-[180px]">
                                                                {link.url}
                                                            </span>
                                                            <a
                                                                href={link.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${preset.bg} border ${preset.border} ${preset.text} hover:scale-105 transition-all text-xs font-bold shadow-sm`}
                                                            >
                                                                <span>Visit</span>
                                                                <FiExternalLink className="w-3.5 h-3.5" />
                                                            </a>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* FLOATING RIGHT-CLICK CONTEXT MENU */}
            <AnimatePresence>
                {contextMenu.visible && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
                        className="fixed z-50 min-w-[200px] bg-black border border-white/20 rounded-2xl p-1.5 shadow-2xl backdrop-blur-2xl text-white space-y-0.5 text-xs font-medium"
                    >
                        {/* Context menu header indicator */}
                        <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-gray-500 border-b border-white/10 mb-1 flex items-center justify-between">
                            <span>
                                {contextMenu.type === 'folder' ? `Folder: ${contextMenu.item?.name}` :
                                    contextMenu.type === 'link' ? `Link: ${contextMenu.item?.title}` :
                                        'Explorer Actions'}
                            </span>
                        </div>

                        {/* FOLDER CONTEXT ACTIONS */}
                        {contextMenu.type === 'folder' && (
                            <>
                                <button
                                    onClick={() => {
                                        navigateToFolder(contextMenu.item.id);
                                        setContextMenu(prev => ({ ...prev, visible: false }));
                                    }}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl ${theme.contextHover} text-gray-200 transition-colors text-left`}
                                >
                                    <FiFolder className={`w-4 h-4 ${theme.text}`} />
                                    <span>Open Folder</span>
                                </button>
                                <button
                                    onClick={() => {
                                        openCreateFolderModal(contextMenu.item.id);
                                        setContextMenu(prev => ({ ...prev, visible: false }));
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-emerald-500/20 hover:text-emerald-300 text-gray-200 transition-colors text-left"
                                >
                                    <FiFolderPlus className="w-4 h-4 text-emerald-400" />
                                    <span>Create Subfolder Inside</span>
                                </button>
                                <button
                                    onClick={() => {
                                        openCreateLinkModal(contextMenu.item.id);
                                        setContextMenu(prev => ({ ...prev, visible: false }));
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-purple-500/20 hover:text-purple-300 text-gray-200 transition-colors text-left"
                                >
                                    <FiPlus className="w-4 h-4 text-purple-400" />
                                    <span>Add Link Card Here</span>
                                </button>
                                <button
                                    onClick={(e) => {
                                        openEditFolderModal(contextMenu.item, e);
                                        setContextMenu(prev => ({ ...prev, visible: false }));
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-sky-500/20 hover:text-sky-300 text-gray-200 transition-colors text-left"
                                >
                                    <FiEdit3 className="w-4 h-4 text-sky-400" />
                                    <span>Rename / Edit Folder</span>
                                </button>
                                <div className="border-t border-white/10 my-1" />
                                <button
                                    onClick={() => {
                                        setDeleteConfirmModal({ open: true, type: 'folder', item: contextMenu.item });
                                        setContextMenu(prev => ({ ...prev, visible: false }));
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-rose-500/20 hover:text-rose-400 text-rose-300 transition-colors text-left"
                                >
                                    <FiTrash2 className="w-4 h-4" />
                                    <span>Delete Folder</span>
                                </button>
                            </>
                        )}

                        {/* LINK CONTEXT ACTIONS */}
                        {contextMenu.type === 'link' && (
                            <>
                                <a
                                    href={contextMenu.item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => setContextMenu(prev => ({ ...prev, visible: false }))}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-emerald-500/20 hover:text-emerald-300 text-gray-200 transition-colors text-left"
                                >
                                    <FiExternalLink className="w-4 h-4 text-emerald-400" />
                                    <span>Open Link</span>
                                </a>
                                <button
                                    onClick={(e) => {
                                        copyToClipboard(contextMenu.item.url, contextMenu.item.id, e);
                                        setContextMenu(prev => ({ ...prev, visible: false }));
                                    }}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl ${theme.contextHover} text-gray-200 transition-colors text-left`}
                                >
                                    <FiCopy className={`w-4 h-4 ${theme.text}`} />
                                    <span>Copy URL</span>
                                </button>
                                <button
                                    onClick={(e) => {
                                        openEditLinkModal(contextMenu.item, e);
                                        setContextMenu(prev => ({ ...prev, visible: false }));
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-sky-500/20 hover:text-sky-300 text-gray-200 transition-colors text-left"
                                >
                                    <FiEdit3 className="w-4 h-4 text-sky-400" />
                                    <span>Edit Link Card</span>
                                </button>
                                <div className="border-t border-white/10 my-1" />
                                <button
                                    onClick={() => {
                                        setDeleteConfirmModal({ open: true, type: 'link', item: contextMenu.item });
                                        setContextMenu(prev => ({ ...prev, visible: false }));
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-rose-500/20 hover:text-rose-400 text-rose-300 transition-colors text-left"
                                >
                                    <FiTrash2 className="w-4 h-4" />
                                    <span>Delete Link Card</span>
                                </button>
                            </>
                        )}

                        {/* CANVAS BACKGROUND CONTEXT ACTIONS */}
                        {contextMenu.type === 'canvas' && (
                            <>
                                <button
                                    onClick={() => {
                                        openCreateFolderModal(currentFolderId);
                                        setContextMenu(prev => ({ ...prev, visible: false }));
                                    }}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl ${theme.contextHover} text-gray-200 transition-colors text-left`}
                                >
                                    <FiFolderPlus className={`w-4 h-4 ${theme.text}`} />
                                    <span>New Folder Here</span>
                                </button>
                                <button
                                    onClick={() => {
                                        openCreateLinkModal(currentFolderId);
                                        setContextMenu(prev => ({ ...prev, visible: false }));
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-emerald-500/20 hover:text-emerald-300 text-gray-200 transition-colors text-left"
                                >
                                    <FiPlus className="w-4 h-4 text-emerald-400" />
                                    <span>New Link Card Here</span>
                                </button>
                                <div className="border-t border-white/10 my-1" />
                                <button
                                    onClick={() => {
                                        fetchResources();
                                        setContextMenu(prev => ({ ...prev, visible: false }));
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/10 hover:text-white text-gray-400 transition-colors text-left"
                                >
                                    <FiRefreshCw className="w-4 h-4" />
                                    <span>Refresh Explorer</span>
                                </button>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* MODAL 1: CREATE / EDIT FOLDER */}
            <AnimatePresence>
                {folderModalOpen && (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-black border border-white/20 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative text-white"
                        >
                            <div className="flex items-center justify-between border-b border-white/10 pb-4">
                                <h3 className="text-base font-extrabold flex items-center gap-2">
                                    <FiFolder className={theme.text} />
                                    {editingFolder ? 'Edit Folder' : 'Create New Folder'}
                                </h3>
                                <button onClick={() => setFolderModalOpen(false)} className="text-gray-400 hover:text-white">
                                    <FiX className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSaveFolder} className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-1">Folder Name *</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Documentation, Design Assets, Internal Tools..."
                                        value={folderForm.name}
                                        onChange={(e) => setFolderForm(prev => ({ ...prev, name: e.target.value }))}
                                        className={`w-full bg-[#0d0d0d] border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none ${theme.borderFocus}`}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-1">Parent Category / Folder</label>
                                    <select
                                        value={folderForm.parent_id}
                                        onChange={(e) => setFolderForm(prev => ({ ...prev, parent_id: e.target.value }))}
                                        className={`w-full bg-[#0d0d0d] border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none ${theme.borderFocus}`}
                                    >
                                        <option value="">📁 Root (Top Level)</option>
                                        {flatSelectOptions.map(opt => (
                                            <option key={opt.id} value={opt.id}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-1">Color Accent</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {COLOR_PRESETS.map(preset => (
                                            <button
                                                type="button"
                                                key={preset.id}
                                                onClick={() => setFolderForm(prev => ({ ...prev, color: preset.id }))}
                                                className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${folderForm.color === preset.id
                                                    ? `${preset.bg} ${preset.border} ${preset.text} border-2`
                                                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                                                    }`}
                                            >
                                                <span className={`w-2.5 h-2.5 rounded-full ${preset.bg} ${preset.border}`} />
                                                <span className="capitalize">{preset.id}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-1">Description (Optional)</label>
                                    <textarea
                                        rows="3"
                                        placeholder="Brief summary of what resources are inside this folder..."
                                        value={folderForm.description}
                                        onChange={(e) => setFolderForm(prev => ({ ...prev, description: e.target.value }))}
                                        className={`w-full bg-[#0d0d0d] border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none ${theme.borderFocus}`}
                                    />
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                                    <button
                                        type="button"
                                        onClick={() => setFolderModalOpen(false)}
                                        className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-300"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-lg ${theme.bgBtn}`}
                                    >
                                        {editingFolder ? 'Save Changes' : 'Create Folder'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* MODAL 2: CREATE / EDIT LINK CARD */}
            <AnimatePresence>
                {linkModalOpen && (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-black border border-white/20 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative text-white"
                        >
                            <div className="flex items-center justify-between border-b border-white/10 pb-4">
                                <h3 className="text-base font-extrabold flex items-center gap-2">
                                    <FiLink className="text-emerald-400" />
                                    {editingLink ? 'Edit Link Card' : 'Create Link Card'}
                                </h3>
                                <button onClick={() => setLinkModalOpen(false)} className="text-gray-400 hover:text-white">
                                    <FiX className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSaveLink} className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-1">Title / Resource Name *</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Pressmatics Admin Portal, GitHub Repo, Design Guidelines..."
                                        value={linkForm.title}
                                        onChange={(e) => setLinkForm(prev => ({ ...prev, title: e.target.value }))}
                                        className="w-full bg-[#0d0d0d] border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-1">Destination URL *</label>
                                    <input
                                        type="text"
                                        placeholder="https://example.com or example.com"
                                        value={linkForm.url}
                                        onChange={(e) => setLinkForm(prev => ({ ...prev, url: e.target.value }))}
                                        className="w-full bg-[#0d0d0d] border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-1">Folder Category</label>
                                    <select
                                        value={linkForm.category_id}
                                        onChange={(e) => setLinkForm(prev => ({ ...prev, category_id: e.target.value }))}
                                        className="w-full bg-[#0d0d0d] border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                    >
                                        <option value="">📁 Root Level</option>
                                        {flatSelectOptions.map(opt => (
                                            <option key={opt.id} value={opt.id}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-1">Card Icon</label>
                                    <div className="grid grid-cols-6 gap-2">
                                        {Object.keys(ICON_MAP).map(iconKey => {
                                            const Icon = ICON_MAP[iconKey];
                                            return (
                                                <button
                                                    type="button"
                                                    key={iconKey}
                                                    onClick={() => setLinkForm(prev => ({ ...prev, icon: iconKey }))}
                                                    className={`p-2.5 rounded-xl border flex items-center justify-center transition-all ${linkForm.icon === iconKey
                                                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                                                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                                                        }`}
                                                >
                                                    <Icon className="w-4 h-4" />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-1">Color Accent</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {COLOR_PRESETS.map(preset => (
                                            <button
                                                type="button"
                                                key={preset.id}
                                                onClick={() => setLinkForm(prev => ({ ...prev, color: preset.id }))}
                                                className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${linkForm.color === preset.id
                                                    ? `${preset.bg} ${preset.border} ${preset.text} border-2`
                                                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                                                    }`}
                                            >
                                                <span className={`w-2.5 h-2.5 rounded-full ${preset.bg} ${preset.border}`} />
                                                <span className="capitalize">{preset.id}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-1">Description (Optional)</label>
                                    <textarea
                                        rows="2"
                                        placeholder="Add notes, access instructions, or credentials info..."
                                        value={linkForm.description}
                                        onChange={(e) => setLinkForm(prev => ({ ...prev, description: e.target.value }))}
                                        className="w-full bg-[#0d0d0d] border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-1">Tags (Comma-separated)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. dev, api, production, docs"
                                        value={linkForm.tags}
                                        onChange={(e) => setLinkForm(prev => ({ ...prev, tags: e.target.value }))}
                                        className="w-full bg-[#0d0d0d] border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                                    <button
                                        type="button"
                                        onClick={() => setLinkModalOpen(false)}
                                        className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-300"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg shadow-emerald-600/20"
                                    >
                                        {editingLink ? 'Save Changes' : 'Create Link Card'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* MODAL 3: CONFIRM DELETE DIALOG */}
            <AnimatePresence>
                {deleteConfirmModal.open && (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-black border border-rose-500/30 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-center text-white"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                                <FiTrash2 className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-extrabold">
                                Delete {deleteConfirmModal.type === 'folder' ? 'Folder & Contents' : 'Link Card'}?
                            </h3>
                            <p className="text-xs text-gray-400">
                                {deleteConfirmModal.type === 'folder'
                                    ? `Are you sure you want to delete "${deleteConfirmModal.item?.name}"? All subfolders and link cards inside will be permanently removed.`
                                    : `Are you sure you want to delete link "${deleteConfirmModal.item?.title}"?`
                                }
                            </p>
                            <div className="flex items-center justify-center gap-3 pt-2">
                                <button
                                    onClick={() => setDeleteConfirmModal({ open: false, type: null, item: null })}
                                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-lg shadow-rose-600/20"
                                >
                                    Confirm Delete
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function ResourcesExplorerPage() {
    return (
        <Suspense fallback={
            <div className="py-24 text-center text-white">
                <FiRefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-400" />
                <p className="text-xs text-gray-400 font-mono mt-2">Loading Explorer...</p>
            </div>
        }>
            <ResourcesExplorerContent />
        </Suspense>
    );
}
