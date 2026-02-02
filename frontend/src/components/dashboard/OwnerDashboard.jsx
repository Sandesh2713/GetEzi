'use client';

import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users,
    BarChart3,
    Settings,
    Bell,
    LogOut,
    Plus,
    Edit2,
    Trash2,
    AlertCircle,
    Download,
    RefreshCw,
    Zap,
    TrendingUp,
    Clock,
    CheckCircle2,
    Activity,
    Shield,
} from 'lucide-react';

export default function OwnerDashboard({ user, offices, onUpdate, onLogout }) {
    const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
    const [showAddStaffModal, setShowAddStaffModal] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');

    // Use first office for now
    const activeOffice = offices && offices.length > 0 ? offices[0] : null;
    const [capacity, setCapacity] = useState(activeOffice?.active_counters || 1);

    const handleUpdateCapacity = async () => {
        if (!activeOffice) return;

        // Safety Check
        if (activeOffice.counter_count && capacity > activeOffice.counter_count) {
            const confirmed = window.confirm(
                `WARNING: You are setting active capacity to active-counters.\n\n` +
                `This exceeds your physical counter limit (${activeOffice.counter_count}).\n` +
                `Are you sure you want to proceed?`
            );
            if (!confirmed) return;
        }

        try {
            const token = sessionStorage.getItem('token');
            const res = await fetch(`${API_BASE}/api/offices/${activeOffice.id}/active-counters`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ activeCounters: capacity })
            });
            if (res.status === 401 || res.status === 403) {
                alert('Session Expired/Invalid Token. Please log in again.');
                if (onLogout) onLogout();
                return;
            }
            const data = await res.json();
            if (data.success) {
                alert('Capacity Updated!');
                if (onUpdate) onUpdate();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (err) {
            alert('Failed to update capacity');
            console.error(err);
        }
    };

    const handleAuthError = (res) => {
        // 401 = Unauthorized (invalid/missing token) - definitely logout
        if (res.status === 401) {
            alert('Session Expired. Please log in again.');
            if (onLogout) onLogout();
            return true;
        }
        // 403 = Forbidden (could be auth issue OR permission issue)
        // We'll let the caller decide based on the error message
        return false;
    };

    const handleShutdown = async () => {
        if (!activeOffice) return;

        const confirmed = window.confirm(
            "CRITICAL WARNING: Are you sure you want to PAUSE & SHUT DOWN operations?\n\n" +
            "This will:\n" +
            "1. Set system status to OFFLINE\n" +
            "2. Notify ALL staff and customers immediately\n" +
            "3. Stop all queue processing\n\n" +
            "Click OK to confirm SHUTDOWN."
        );

        if (!confirmed) return;

        try {
            const token = sessionStorage.getItem('token');
            const res = await fetch(`${API_BASE}/api/offices/${activeOffice.id}/shutdown`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({})
            });
            if (handleAuthError(res)) return;
            const data = await res.json();
            if (data.success) {
                alert('System is now OFFLINE.');
                if (onUpdate) onUpdate();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (err) {
            alert('Failed to shutdown system');
            console.error(err);
        }
    };

    const handleResume = async () => {
        if (!activeOffice) return;
        try {
            const token = sessionStorage.getItem('token');
            const res = await fetch(`${API_BASE}/api/offices/${activeOffice.id}/resume`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (handleAuthError(res)) return;
            const data = await res.json();
            if (data.success) {
                alert('System is now LIVE.');
                if (onUpdate) onUpdate();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (err) {
            alert('Failed to resume operations');
            console.error(err);
        }
    };

    const [realStaff, setRealStaff] = useState([]);
    const [timings, setTimings] = useState({
        opening_time: '09:00', closing_time: '17:00',
        working_days: 'Mon,Tue,Wed,Thu,Fri,Sat', allow_sunday: false, daily_capacity: 100
    });
    const [editStaffMode, setEditStaffMode] = useState(null); // null or staff object
    const [newStaffData, setNewStaffData] = useState({ name: '', email: '', password: '', counter: 1 });
    const [holidays, setHolidays] = useState([]);
    const [newHoliday, setNewHoliday] = useState({ date: '', reason: '' });

    const socketRef = useRef(null);

    useEffect(() => {
        if (activeOffice) {
            setCapacity(activeOffice.active_counters || 1);
            setTimings({
                opening_time: activeOffice.opening_time || '09:00',
                closing_time: activeOffice.closing_time || '17:00',
                working_days: activeOffice.working_days || 'Mon,Tue,Wed,Thu,Fri,Sat',
                allow_sunday: activeOffice.allow_sunday === 1,
                daily_capacity: activeOffice.daily_capacity || 100
            });
            fetchStaff();
            fetchHolidays();

            // Connect Socket
            const socket = io(API_BASE);
            socketRef.current = socket;

            socket.on('connect', () => {
                socket.emit('join_office', activeOffice.id);
            });

            socket.on('staff_list_update', () => {
                fetchStaff();
            });

            return () => {
                socket.disconnect();
            };
        }
    }, [activeOffice]);

    const fetchHolidays = async () => {
        if (!activeOffice) return;
        try {
            const res = await fetch(`${API_BASE}/api/offices/${activeOffice.id}/holidays`);
            const data = await res.json();
            if (Array.isArray(data)) setHolidays(data);
        } catch (e) { console.error(e); }
    };

    const handleAddHoliday = async () => {
        if (!newHoliday.date) return alert('Date is required');
        try {
            const token = sessionStorage.getItem('token');
            const res = await fetch(`${API_BASE}/api/offices/${activeOffice.id}/holidays`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(newHoliday)
            });
            if (res.ok) {
                setNewHoliday({ date: '', reason: '' });
                fetchHolidays();
                alert('Holiday Added');
            } else {
                const d = await res.json();
                alert('Error: ' + d.error);
            }
        } catch (e) { alert(e.message); }
    };

    const handleDeleteHoliday = async (id) => {
        if (!window.confirm('Delete this holiday?')) return;
        try {
            const token = sessionStorage.getItem('token');
            const res = await fetch(`${API_BASE}/api/offices/${activeOffice.id}/holidays/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) fetchHolidays();
        } catch (e) { alert(e.message); }
    };

    const fetchStaff = async () => {
        if (!activeOffice) return;
        try {
            const token = sessionStorage.getItem('token');
            const res = await fetch(`${API_BASE}/api/offices/${activeOffice.id}/staff`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (handleAuthError(res)) return;
            const data = await res.json();
            if (data.staff) setRealStaff(data.staff);
        } catch (err) {
            console.error('Failed to fetch staff', err);
        }
    };

    const handleDeleteStaff = async (staffId) => {
        if (!window.confirm("PERMANENT DELETE: This will remove the staff member and their login credentials forever. Are you sure?")) return;
        try {
            const token = sessionStorage.getItem('token');
            const res = await fetch(`${API_BASE}/api/offices/${activeOffice.id}/staff/${staffId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (handleAuthError(res)) return;
            if (res.ok) {
                alert('Staff Deleted Permanently');
                fetchStaff();
            }
        } catch (err) {
            alert('Failed to delete staff');
        }
    };

    const handleSaveStaff = async () => {
        if (!activeOffice) return;

        try {
            const token = sessionStorage.getItem('token');
            let res;

            if (editStaffMode) {
                res = await fetch(`${API_BASE}/api/offices/${activeOffice.id}/staff/${editStaffMode.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(newStaffData)
                });
            } else {
                res = await fetch(`${API_BASE}/api/offices/${activeOffice.id}/staff`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(newStaffData)
                });
            }

            if (handleAuthError(res)) return;

            const data = await res.json();

            if (res.ok) {
                alert(editStaffMode ? 'Staff Updated' : 'Staff Added Successfully');
                setShowAddStaffModal(false);
                setEditStaffMode(null);
                setNewStaffData({ name: '', email: '', password: '', counter: 1 });
                fetchStaff();
            } else {
                alert(data.error || 'Operation failed');
            }
        } catch (e) {
            console.error(e);
            alert('An error occurred connecting to the server');
        }
    };

    const handleUpdateTimings = async () => {
        try {
            const token = sessionStorage.getItem('token');
            if (!token) {
                alert('Session Expired. Please log in again.');
                if (onLogout) onLogout();
                return;
            }

            console.log('=== UPDATE TIMINGS DEBUG ===');
            console.log('Office ID:', activeOffice?.id);
            console.log('User:', user);
            console.log('Timings data:', timings);

            const res = await fetch(`${API_BASE}/api/offices/${activeOffice.id}/config`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    workingDays: timings.working_days,
                    allowSunday: timings.allow_sunday,
                    dailyCapacity: timings.daily_capacity
                })
            });

            console.log('Response status:', res.status);
            console.log('Response ok:', res.ok);

            // Get response text first to see what we're dealing with
            const responseText = await res.text();
            console.log('Response text:', responseText);

            let data;
            try {
                data = JSON.parse(responseText);
                console.log('Parsed response data:', data);
            } catch (parseError) {
                console.error('Failed to parse JSON:', parseError);
                console.error('Raw response:', responseText);
                alert('Error: Invalid server response. Please try again.');
                return;
            }

            // Handle 401 - definitely auth error, logout
            if (res.status === 401) {
                console.error('401 Unauthorized - logging out');
                alert('Session Expired. Please log in again.');
                if (onLogout) onLogout();
                return;
            }

            // Handle 403 - could be auth or permission issue
            if (res.status === 403) {
                const errorMsg = (data?.error || 'Access denied').toLowerCase();
                console.error('403 Forbidden - Error:', errorMsg);
                console.error('Full data:', data);

                // Check if it's an auth issue - these are keywords that indicate token/auth problems
                const isAuthError =
                    errorMsg.includes('token') ||
                    errorMsg.includes('unauthorized') ||
                    errorMsg.includes('no token') ||
                    errorMsg.includes('invalid token') ||
                    errorMsg.includes('expired') ||
                    errorMsg.includes('authentication');

                if (isAuthError) {
                    console.error('Auth error detected - logging out');
                    alert('Session Expired. Please log in again.');
                    if (onLogout) onLogout();
                } else {
                    // Permission issue - don't logout, just show error
                    console.error('Permission error - showing message only');
                    alert(`Error: ${data?.error || 'Access denied. Only the office owner can update timings.'}`);
                }
                return;
            }

            // Handle success
            if (res.ok && data.success) {
                console.log('Success! Timings updated');
                alert('Operating Hours Updated!');
                if (onUpdate) onUpdate();
            } else {
                // Other errors
                const errorMsg = data?.error || 'Failed to update operating hours';
                console.error('Request failed:', errorMsg);
                alert(`Error: ${errorMsg}`);
            }
        } catch (e) {
            console.error('Exception updating timings:', e);
            // Don't logout on network errors - these are not auth issues
            const errorMsg = e.message || 'Network error';
            if (errorMsg.includes('CORS') || errorMsg.includes('Failed to fetch') || errorMsg.includes('Network')) {
                alert('Connection error: Please check if the backend server is running.');
            } else {
                alert('Error updating timings: ' + errorMsg);
            }
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.05 },
        },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    };

    const floatingVariants = {
        animate: {
            y: [0, -10, 0],
            transition: { duration: 4, repeat: Infinity },
        },
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-green-50">
            {/* Floating Background Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    className="absolute top-20 left-10 w-96 h-96 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
                    animate={{ y: [0, 50, 0], x: [0, 30, 0] }}
                    transition={{ duration: 8, repeat: Infinity }}
                />
                <motion.div
                    className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-to-br from-green-200 to-teal-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
                    animate={{ y: [0, -50, 0], x: [0, -30, 0] }}
                    transition={{ duration: 10, repeat: Infinity }}
                />
            </div>

            {/* Header */}
            <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm transition-all duration-300">
                <div className="container mx-auto h-16 max-w-7xl px-4 flex items-center justify-between">
                    {/* Logo/Title */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                            <span className="text-xl font-bold tracking-tight text-gray-900">GetEzi</span>
                            <motion.div
                                animate={{ rotate: [0, 10, -10, 0] }}
                                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                            >
                                {/* Using Leaf import, need to ensure it's imported (it is not in the original file, need to check imports) */}
                                {/* Original OwnerDashboard has: Users, BarChart3, Settings, Bell, LogOut, Plus, Edit2, Trash2, AlertCircle, Download, RefreshCw, Zap, TrendingUp, Clock, CheckCircle2, Activity, Shield */}
                                {/* I need to add Leaf to imports or use Shield as temporary if I can't add import easily in this replace step. */}
                                {/* Wait, I can't add import easily here without another call. */}
                                {/* I will use Shield for now but styled like the Leaf? No, I should add the import if possible. */}
                                {/* Actually, Step 1: Add Leaf to imports. Step 2: Update Header. */}
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.77 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></svg>
                            </motion.div>
                        </div>
                        <div className="hidden sm:block h-6 w-px bg-gray-200 mx-2" />
                        <div>
                            <p className="hidden sm:block text-xs font-bold text-gray-400 tracking-widest uppercase mt-0.5">Owner Panel</p>
                            <p className="text-[10px] text-gray-400 font-medium sm:hidden">Owner</p>
                        </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-4">
                        <motion.button
                            onClick={() => alert("Notifications feature coming soon!")}
                            className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors relative border-none bg-transparent"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <Bell size={20} />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white" />
                        </motion.button>

                        <div className="h-8 w-px bg-gray-200" />

                        <div className="flex items-center gap-3">
                            <div className="text-right hidden md:block">
                                <p className="text-sm font-bold text-gray-900">{user?.name || 'Owner'}</p>
                                <p className="text-xs text-gray-500">Administrator</p>
                            </div>
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                                <Users size={20} className="text-green-600" />
                            </div>
                        </div>

                        <motion.button
                            onClick={onLogout}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors border-none bg-transparent"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            title="Logout"
                        >
                            <LogOut size={20} />
                        </motion.button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-12 relative z-10">
                {/* Portal Title */}
                <motion.div
                    className="mb-12"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <motion.h2
                        className="text-4xl font-bold text-gray-900 mb-2"
                        variants={itemVariants}
                    >
                        Super Admin Portal
                    </motion.h2>
                    <motion.p className="text-lg text-gray-600" variants={itemVariants}>
                        Clinic Management System
                    </motion.p>
                    <motion.div
                        className="flex items-center gap-2 mt-4 text-green-600"
                        variants={itemVariants}
                    >
                        <div className={`w-3 h-3 rounded-full animate-pulse ${activeOffice?.state === 'LIVE' ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="font-medium">
                            {activeOffice?.state === 'LIVE' ? 'System Live' : (activeOffice?.state || 'Offline')}
                        </span>
                    </motion.div>
                </motion.div>

                {/* Navigation Tabs */}
                <motion.div
                    className="flex gap-3 mb-8 flex-wrap"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    {[
                        { id: 'overview', label: 'Staff & Counters', icon: Users },
                        { id: 'analytics', label: 'Office Controls', icon: Settings },
                        { id: 'reports', label: 'Analytics', icon: BarChart3 },
                    ].map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <motion.button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all border-none ${activeTab === tab.id
                                    ? '!bg-gradient-to-r !from-green-600 !to-emerald-600 !text-white shadow-lg'
                                    : '!bg-white !text-gray-700 border !border-gray-200 hover:!border-green-300'
                                    }`}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                variants={itemVariants}
                            >
                                <Icon size={18} />
                                {tab.label}
                            </motion.button>
                        );
                    })}
                </motion.div>

                {/* Content Sections */}
                <div className="space-y-8">
                    {/* Staff Management Section */}
                    {activeTab === 'overview' && (
                        <>
                            {/* Operational Capacity */}
                            <motion.div
                                className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm"
                                variants={itemVariants}
                                whileHover={{ y: -5 }}
                            >
                                <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <Activity size={24} className="text-green-600" />
                                    Operational Capacity
                                </h3>

                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">
                                            Active Counters
                                        </label>
                                        <div className="flex items-center gap-4">
                                            <input
                                                type="number"
                                                value={capacity}
                                                onChange={(e) => setCapacity(Number(e.target.value))}
                                                className="w-20 px-4 py-3 border border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none"
                                            />
                                            <motion.button
                                                onClick={handleUpdateCapacity}
                                                className="px-6 py-3 !bg-gradient-to-r !from-green-600 !to-emerald-600 !text-white rounded-lg font-semibold hover:shadow-lg transition-all border-none"
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                            >
                                                Update Capacity
                                            </motion.button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Emergency Controls */}
                            {/* Emergency / Resume Controls */}
                            <motion.div
                                className={`bg-gradient-to-r ${activeOffice?.state === 'LIVE' ? 'from-red-50 to-orange-50 border-red-200' : 'from-green-50 to-emerald-50 border-green-200'} border rounded-2xl p-8`}
                                variants={itemVariants}
                                whileHover={{ y: -5 }}
                            >
                                <h3 className={`text-2xl font-bold ${activeOffice?.state === 'LIVE' ? 'text-red-900' : 'text-green-900'} mb-4 flex items-center gap-2`}>
                                    {activeOffice?.state === 'LIVE' ? (
                                        <AlertCircle size={24} className="text-red-600" />
                                    ) : (
                                        <Zap size={24} className="text-green-600" />
                                    )}
                                    {activeOffice?.state === 'LIVE' ? 'Emergency Controls' : 'Resume Operations'}
                                </h3>
                                <motion.button
                                    onClick={activeOffice?.state === 'LIVE' ? handleShutdown : handleResume}
                                    className={`w-full py-3 ${activeOffice?.state === 'LIVE' ? '!bg-red-600 hover:!bg-red-700' : '!bg-green-600 hover:!bg-green-700'} !text-white rounded-lg font-semibold transition-all border-none`}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    {activeOffice?.state === 'LIVE' ? 'Pause Operations' : 'Resume & Go Online'}
                                </motion.button>
                            </motion.div>

                            {/* Staff Management */}
                            <motion.div
                                className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm"
                                variants={itemVariants}
                                whileHover={{ y: -5 }}
                            >
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                        <Users size={24} className="text-green-600" />
                                        Staff Management
                                    </h3>
                                    <motion.button
                                        onClick={() => setShowAddStaffModal(true)}
                                        className="px-6 py-3 !bg-gradient-to-r !from-green-600 !to-emerald-600 !text-white rounded-lg font-semibold flex items-center gap-2 hover:shadow-lg transition-all border-none"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        <Plus size={18} />
                                        Add New Staff
                                    </motion.button>
                                </div>

                                <p className="text-gray-600 mb-4">
                                    Manage who can operate counters.
                                </p>
                                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                                    <p className="text-sm text-gray-700">
                                        <span className="font-bold">Current Active Capacity:</span>{' '}
                                        <span className="text-green-600 font-bold">{capacity} counters</span>
                                    </p>
                                </div>

                                {/* Staff Table */}
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-gray-200">
                                                <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 uppercase">
                                                    Staff Member
                                                </th>
                                                <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 uppercase">
                                                    Assigned Counter
                                                </th>
                                                <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 uppercase">
                                                    Status
                                                </th>
                                                <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 uppercase">
                                                    Action
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {realStaff.map((staff, index) => (
                                                <motion.tr
                                                    key={staff.id}
                                                    className="border-b border-gray-100 hover:bg-green-50 transition-colors"
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: index * 0.1 }}
                                                >
                                                    <td className="py-4 px-4">
                                                        <div>
                                                            <p className="font-semibold text-gray-900">{staff.name}</p>
                                                            <p className="text-sm text-gray-500">{staff.email}</p>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4 text-gray-700">{staff.counter}</td>
                                                    <td className="py-4 px-4">
                                                        <span
                                                            className={`px-3 py-1 rounded-full text-sm font-medium ${staff.status === 'Active'
                                                                ? 'bg-green-100 text-green-700'
                                                                : 'bg-gray-100 text-gray-700'
                                                                }`}
                                                        >
                                                            {staff.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-4 flex gap-2">
                                                        <motion.button
                                                            onClick={() => {
                                                                setEditStaffMode(staff);
                                                                setShowAddStaffModal(true);
                                                            }}
                                                            className="p-2 !bg-transparent hover:!bg-green-100 rounded-lg transition-colors shadow-none border-none"
                                                            whileHover={{ scale: 1.1 }}
                                                            whileTap={{ scale: 0.95 }}
                                                        >
                                                            <Edit2 size={18} className="text-green-600" />
                                                        </motion.button>
                                                        <motion.button
                                                            onClick={() => handleDeleteStaff(staff.id)}
                                                            className="p-2 !bg-transparent hover:!bg-red-100 rounded-lg transition-colors shadow-none border-none"
                                                            whileHover={{ scale: 1.1 }}
                                                            whileTap={{ scale: 0.95 }}
                                                        >
                                                            <Trash2 size={18} className="text-red-600" />
                                                        </motion.button>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
                        </>
                    )}

                    {/* Office Controls Tab */}
                    {activeTab === 'analytics' && (
                        <div className="space-y-6">
                            <motion.div
                                className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm"
                                variants={itemVariants}
                                whileHover={{ y: -5 }}
                            >
                                <h3 className="text-2xl font-bold text-gray-900 mb-6">General Settings</h3>
                                <div className="grid md:grid-cols-2 gap-6">
                                    {/* Timing & Days */}
                                    <div className="space-y-4">
                                        <div>
                                            <h4 className="font-bold text-gray-900 mb-2">Operating Hours</h4>
                                            <div className="flex gap-2">
                                                <input type="time" value={timings.opening_time} onChange={(e) => setTimings({ ...timings, opening_time: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
                                                <span className="self-center">-</span>
                                                <input type="time" value={timings.closing_time} onChange={(e) => setTimings({ ...timings, closing_time: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 mb-2">Working Days</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                                    <label key={d} className="flex items-center gap-1 px-3 py-1 bg-gray-50 border rounded-lg cursor-pointer hover:bg-green-50">
                                                        <input
                                                            type="checkbox"
                                                            checked={(timings.working_days || '').includes(d)}
                                                            onChange={e => {
                                                                const days = (timings.working_days || '').split(',').filter(x => x).map(s => s.trim());
                                                                if (e.target.checked) days.push(d);
                                                                else {
                                                                    const idx = days.indexOf(d);
                                                                    if (idx > -1) days.splice(idx, 1);
                                                                }
                                                                setTimings({ ...timings, working_days: days.join(',') });
                                                            }}
                                                        />
                                                        <span className="text-sm">{d}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Capacity & Sunday */}
                                    <div className="space-y-4">
                                        <div>
                                            <h4 className="font-bold text-gray-900 mb-2">Daily Capacity</h4>
                                            <input
                                                type="number"
                                                value={timings.daily_capacity}
                                                onChange={e => setTimings({ ...timings, daily_capacity: parseInt(e.target.value) })}
                                                className="w-full px-3 py-2 border rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 mb-2">Sunday Operations</h4>
                                            <label className="flex items-center gap-2 px-3 py-2 bg-gray-50 border rounded-lg cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={timings.allow_sunday}
                                                    onChange={e => setTimings({ ...timings, allow_sunday: e.target.checked })}
                                                />
                                                <span>Allow Open on Sundays</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-6">
                                    <button onClick={handleUpdateTimings} className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors">
                                        Save All Settings
                                    </button>
                                </div>
                            </motion.div>

                            {/* Holidays Manager */}
                            <motion.div
                                className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm"
                                variants={itemVariants}
                                whileHover={{ y: -5 }}
                            >
                                <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <Clock size={24} className="text-red-500" />
                                    Holiday Manager
                                </h3>

                                <div className="mb-6 flex gap-4 items-end">
                                    <div className="flex-1">
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Date</label>
                                        <input type="date" value={newHoliday.date} onChange={e => setNewHoliday({ ...newHoliday, date: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Reason</label>
                                        <input type="text" value={newHoliday.reason} onChange={e => setNewHoliday({ ...newHoliday, reason: e.target.value })} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Festival" />
                                    </div>
                                    <button onClick={handleAddHoliday} className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold h-[42px]">Add</button>
                                </div>

                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full">
                                        <thead className="bg-gray-50 border-b">
                                            <tr>
                                                <th className="text-left py-3 px-4 font-bold text-gray-600">Date</th>
                                                <th className="text-left py-3 px-4 font-bold text-gray-600">Reason</th>
                                                <th className="text-right py-3 px-4 font-bold text-gray-600">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {holidays.length === 0 && (
                                                <tr><td colSpan="3" className="py-4 px-4 text-center text-gray-500">No holidays added.</td></tr>
                                            )}
                                            {holidays.map(h => (
                                                <tr key={h.id} className="border-b last:border-0 hover:bg-gray-50">
                                                    <td className="py-3 px-4">{h.date}</td>
                                                    <td className="py-3 px-4">{h.reason}</td>
                                                    <td className="py-3 px-4 text-right">
                                                        <button onClick={() => handleDeleteHoliday(h.id)} className="text-red-500 hover:text-red-700">Delete</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
                        </div>
                    )}

                    {/* Analytics Tab */}
                    {activeTab === 'reports' && (
                        <>
                            {/* Data & Reports Section */}
                            <motion.div
                                className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm"
                                variants={itemVariants}
                                whileHover={{ y: -5 }}
                            >
                                <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <BarChart3 size={24} className="text-green-600" />
                                    Data & Reports
                                </h3>

                                <div className="space-y-6">
                                    {/* Data Retention Policy */}
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">
                                            Data Retention Policy
                                        </label>
                                        <div className="flex items-center gap-4">
                                            <select className="px-4 py-3 border border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none">
                                                <option>7 Days</option>
                                                <option>30 Days</option>
                                                <option>60 Days</option>
                                                <option>90 Days</option>
                                                <option>1 Year</option>
                                            </select>
                                            <motion.button
                                                className="px-6 py-3 !bg-green-600 !text-white rounded-lg font-semibold hover:!bg-green-700 transition-all border-none"
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                            >
                                                Save
                                            </motion.button>
                                        </div>
                                    </div>

                                    {/* Download Token History */}
                                    <div className="pt-6 border-t border-gray-200">
                                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">
                                            Download Token History
                                        </label>
                                        <div className="flex items-center gap-4 mb-4">
                                            <input
                                                type="date"
                                                className="px-4 py-3 border border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none"
                                            />
                                            <span className="text-gray-500">to</span>
                                            <input
                                                type="date"
                                                className="px-4 py-3 border border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none"
                                            />
                                        </div>
                                        <motion.button
                                            className="w-full py-3 !bg-gradient-to-r !from-green-600 !to-emerald-600 !text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:shadow-lg transition-all border-none"
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            <Download size={18} />
                                            Download CSV Report
                                        </motion.button>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Analytics Dashboard */}
                            <motion.div
                                className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-200 p-8"
                                variants={itemVariants}
                                whileHover={{ y: -5 }}
                            >
                                <h3 className="text-2xl font-bold text-gray-900 mb-6">Analytics Dashboard</h3>
                                <div className="grid md:grid-cols-3 gap-6">
                                    {[
                                        { label: 'Total Customers', value: '1,234', icon: Users },
                                        { label: 'Avg Wait Time', value: '8 min', icon: Clock },
                                        { label: 'Completed Today', value: '156', icon: CheckCircle2 },
                                    ].map((stat, index) => {
                                        const Icon = stat.icon;
                                        return (
                                            <motion.div
                                                key={index}
                                                className="p-6 bg-white rounded-xl border border-gray-200 text-center hover:shadow-lg transition-shadow"
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.1 }}
                                                whileHover={{ y: -5 }}
                                            >
                                                <Icon size={32} className="text-green-600 mx-auto mb-3" />
                                                <p className="text-gray-600 text-sm mb-2">{stat.label}</p>
                                                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        </>
                    )}
                </div>
            </main>

            {/* Add Staff Modal */}
            <AnimatePresence>
                {showAddStaffModal && (
                    <motion.div
                        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowAddStaffModal(false)}
                    >
                        <motion.div
                            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8"
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-2xl font-bold text-gray-900 mb-6">{editStaffMode ? 'Edit Staff Details' : 'Add New Staff Member'}</h3>

                            <div className="space-y-4 mb-6">
                                <input
                                    type="text"
                                    placeholder="Full Name"
                                    value={newStaffData.name}
                                    onChange={(e) => setNewStaffData({ ...newStaffData, name: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none"
                                />
                                <input
                                    type="email"
                                    placeholder="Email Address"
                                    value={newStaffData.email}
                                    onChange={(e) => setNewStaffData({ ...newStaffData, email: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none"
                                />
                                {!editStaffMode && (
                                    <input
                                        type="password"
                                        placeholder="Set Password"
                                        value={newStaffData.password}
                                        onChange={(e) => setNewStaffData({ ...newStaffData, password: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none"
                                    />
                                )}
                                <select
                                    value={newStaffData.counter}
                                    onChange={(e) => setNewStaffData({ ...newStaffData, counter: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none"
                                >
                                    <option value="1">Counter #1</option>
                                    <option value="2">Counter #2</option>
                                    <option value="3">Counter #3</option>
                                    <option value="4">Counter #4</option>
                                </select>
                            </div>

                            <div className="flex gap-4">
                                <motion.button
                                    onClick={() => setShowAddStaffModal(false)}
                                    className="flex-1 px-4 py-3 !bg-gray-100 !text-gray-900 rounded-lg font-semibold hover:!bg-gray-200 transition-colors border-none"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    Cancel
                                </motion.button>
                                <motion.button
                                    onClick={handleSaveStaff}
                                    className="flex-1 px-4 py-3 !bg-gradient-to-r !from-green-600 !to-emerald-600 !text-white rounded-lg font-semibold hover:shadow-lg transition-all border-none"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    {editStaffMode ? 'Save Changes' : 'Add Staff'}
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
