import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bell,
    Mail,
    MessageSquare,
    Smartphone,
    Clock,
    Lock,
    Eye,
    Calendar,
    MapPin,
    Globe,
    Volume2,
    LogOut,
    Save,
    RotateCcw,
    ArrowLeft,
    X,
    Check,
    FlaskConical // For Beta icon
} from 'lucide-react';

export default function CustomerPreferences({ onBack }) {
    // Default Preferences
    const defaultPreferences = [
        // Notification Preferences
        {
            id: 'email_notifications',
            title: 'Email Notifications',
            description: 'Receive booking updates and reminders via email',
            icon: <Mail size={20} />,
            enabled: true,
            category: 'notifications',
        },
        {
            id: 'sms_notifications',
            title: 'SMS Notifications',
            description: 'Receive quick booking updates via text message',
            icon: <MessageSquare size={20} />,
            enabled: true,
            category: 'notifications',
        },
        {
            id: 'reminder_notifications',
            title: 'Appointment Reminders',
            description: 'Receive reminders 1 hour before your appointment',
            icon: <Clock size={20} />,
            enabled: true,
            category: 'notifications',
        },

        // Booking Preferences
        {
            id: 'auto_confirm',
            title: 'Auto-Confirm Bookings',
            description: 'Automatically confirm eligible appointments',
            icon: <Calendar size={20} />,
            enabled: false,
            category: 'booking',
        },

        // Privacy & Security
        {
            id: 'profile_visibility',
            title: 'Public Profile',
            description: 'Allow others to see your basic profile information',
            icon: <Eye size={20} />,
            enabled: false,
            category: 'privacy',
        },

        // System Preferences
        {
            id: 'sound_notifications',
            title: 'Sound Notifications',
            description: 'Play sound for incoming notifications and alerts',
            icon: <Volume2 size={20} />,
            enabled: true,
            category: 'system',
        },
        {
            id: 'dark_mode',
            title: 'Dark Mode',
            description: 'Use dark theme for the application interface',
            icon: <Eye size={20} />,
            enabled: false,
            category: 'system',
        },

        // Beta Features
        {
            id: 'push_notifications',
            title: 'Push Notifications',
            description: 'Get instant alerts on your mobile device (Beta)',
            icon: <Smartphone size={20} />,
            enabled: false,
            category: 'beta',
        },
        {
            id: 'location_based',
            title: 'Location-Based Offers',
            description: 'Show special offers for nearby offices',
            icon: <MapPin size={20} />,
            enabled: true,
            category: 'beta',
        },
        {
            id: 'reschedule_suggestions',
            title: 'Reschedule Suggestions',
            description: 'Get suggestions for alternative time slots',
            icon: <Clock size={20} />,
            enabled: true,
            category: 'beta',
        },
        {
            id: 'data_collection',
            title: 'Usage Analytics',
            description: 'Help us improve by sharing anonymous usage data',
            icon: <Globe size={20} />,
            enabled: true,
            category: 'beta',
        },
        {
            id: 'marketing_emails',
            title: 'Marketing Communications',
            description: 'Receive promotional offers and updates about new features',
            icon: <Mail size={20} />,
            enabled: false,
            category: 'beta',
        },
    ];

    const [preferences, setPreferences] = useState(() => {
        const saved = localStorage.getItem('customerPreferences');
        return saved ? JSON.parse(saved) : defaultPreferences;
    });

    const [saveStatus, setSaveStatus] = useState('idle');
    const [hasChanges, setHasChanges] = useState(false);

    // Password Modal State
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
    const [passwordStatus, setPasswordStatus] = useState('idle'); // idle, saving, success, error
    const [passwordError, setPasswordError] = useState('');

    const togglePreference = (id) => {
        setPreferences(
            preferences.map((pref) =>
                pref.id === id ? { ...pref, enabled: !pref.enabled } : pref
            )
        );
        setHasChanges(true);
    };

    const handleSaveChanges = async () => {
        setSaveStatus('saving');
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Persist
        localStorage.setItem('customerPreferences', JSON.stringify(preferences));

        setSaveStatus('saved');
        setHasChanges(false);
        setTimeout(() => setSaveStatus('idle'), 2000);
    };

    const handleReset = () => {
        setPreferences(defaultPreferences);
        setHasChanges(true); // Mark as changed so save button is enabled
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setPasswordError('');

        if (passwordData.new !== passwordData.confirm) {
            setPasswordError("New passwords do not match.");
            return;
        }
        if (passwordData.new.length < 6) {
            setPasswordError("Password must be at least 6 characters.");
            return;
        }
        if (passwordData.current === passwordData.new) {
            setPasswordError("New password cannot be the same as current password.");
            return;
        }

        setPasswordStatus('saving');
        await new Promise(resolve => setTimeout(resolve, 1500));

        setPasswordStatus('success');
        setTimeout(() => {
            setShowPasswordModal(false);
            setPasswordStatus('idle');
            setPasswordData({ current: '', new: '', confirm: '' });
        }, 1000);
    };

    const categories = [
        { id: 'notifications', title: 'Notifications', color: 'from-blue-500 to-cyan-500' },
        { id: 'booking', title: 'Booking Preferences', color: 'from-purple-500 to-pink-500' },
        { id: 'privacy', title: 'Privacy & Security', color: 'from-orange-500 to-red-500' },
        { id: 'system', title: 'System Preferences', color: 'from-green-500 to-emerald-500' },
        { id: 'beta', title: 'Beta & Experimental', color: 'from-pink-500 to-rose-500', isBeta: true },
    ];

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
            },
        },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.4 },
        },
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
            {/* Animated Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full blur-3xl opacity-20"
                    animate={{
                        x: [0, 30, 0],
                        y: [0, 40, 0],
                    }}
                    transition={{ duration: 8, repeat: Infinity }}
                />
                <motion.div
                    className="absolute top-1/2 -left-40 w-80 h-80 bg-cyan-200 rounded-full blur-3xl opacity-20"
                    animate={{
                        x: [0, -30, 0],
                        y: [0, -40, 0],
                    }}
                    transition={{ duration: 10, repeat: Infinity }}
                />
            </div>

            <div className="relative z-10 max-w-5xl mx-auto px-4 py-8">
                {/* Header */}
                <motion.div
                    className="mb-12"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <div className="flex items-center gap-4 mb-2">
                        {onBack && (
                            <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
                                <ArrowLeft size={24} />
                            </button>
                        )}
                        <h1 className="text-4xl font-bold text-slate-900">Preferences</h1>
                    </div>
                    <p className="text-slate-500 ml-14">
                        Customize your experience and manage notification settings
                    </p>
                </motion.div>

                {/* Preferences by Category */}
                <motion.div
                    className="space-y-8"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    {categories.map((category) => {
                        const categoryPrefs = preferences.filter((p) => p.category === category.id);
                        if (categoryPrefs.length === 0) return null;

                        return (
                            <motion.div key={category.id} variants={itemVariants}>
                                {/* Category Header */}
                                <div className="mb-4">
                                    <div className={`flex items-center gap-3 mb-2`}>
                                        <div className={`h-1 w-8 rounded-full bg-gradient-to-r ${category.color}`} />
                                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                                            {category.title}
                                            {category.isBeta && (
                                                <span className="text-xs px-2 py-0.5 bg-pink-100 text-pink-600 rounded-full font-bold border border-pink-200 flex items-center gap-1">
                                                    <FlaskConical size={12} /> Beta
                                                </span>
                                            )}
                                        </h2>
                                    </div>
                                    <p className="text-slate-500 text-sm ml-11">
                                        {category.id === 'notifications' && 'Manage how you receive updates and alerts'}
                                        {category.id === 'booking' && 'Customize your appointment booking experience'}
                                        {category.id === 'privacy' && 'Control your data and privacy settings'}
                                        {category.id === 'system' && 'Adjust application settings and preferences'}
                                        {category.id === 'beta' && 'Experimental features currently under development'}
                                    </p>
                                </div>

                                {/* Preference Cards */}
                                <div className="space-y-3">
                                    {categoryPrefs.map((pref, index) => (
                                        <motion.div
                                            key={pref.id}
                                            className="bg-white shadow-sm border border-slate-100 rounded-xl p-4 hover:shadow-md transition-all duration-300 cursor-pointer group"
                                            whileHover={{ scale: 1.02, borderColor: 'rgba(59, 130, 246, 0.5)' }}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.08 }}
                                            onClick={() => togglePreference(pref.id)}
                                        >
                                            <div className="flex items-center gap-4">
                                                {/* Icon */}
                                                <motion.div
                                                    className={`p-3 rounded-lg flex-shrink-0 ${pref.enabled
                                                        ? `bg-gradient-to-br ${category.color} text-white`
                                                        : 'bg-slate-100 text-slate-500'
                                                        }`}
                                                    whileHover={{ scale: 1.1 }}
                                                    transition={{ duration: 0.2 }}
                                                >
                                                    {pref.icon}
                                                </motion.div>

                                                {/* Text */}
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-slate-900 font-semibold text-sm md:text-base truncate">
                                                        {pref.title}
                                                    </h3>
                                                    <p className="text-slate-500 text-xs md:text-sm mt-1 line-clamp-2">
                                                        {pref.description}
                                                    </p>
                                                </div>

                                                {/* Toggle Switch */}
                                                <motion.button
                                                    className={`relative w-14 h-8 rounded-full transition-colors duration-300 flex-shrink-0 ml-auto ${pref.enabled ? 'bg-blue-500' : 'bg-slate-200'
                                                        }`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        togglePreference(pref.id);
                                                    }}
                                                    whileTap={{ scale: 0.95 }}
                                                >
                                                    <motion.div
                                                        className="absolute top-[4px] left-[4px] w-6 h-6 bg-white rounded-full shadow-lg"
                                                        animate={{
                                                            x: pref.enabled ? 24 : 0,
                                                        }}
                                                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                                    />
                                                </motion.button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </motion.div>
                        );
                    })}
                </motion.div>

                {/* Info Box */}
                {hasChanges && (
                    <motion.div
                        className="mt-6 p-4 bg-blue-50/50 border border-blue-200 rounded-lg text-blue-700 text-sm flex items-center justify-between"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                    >
                        <span>You have unsaved changes. Click "Save Changes" to apply your preferences.</span>
                    </motion.div>
                )}

                {/* Additional Options */}
                <motion.div
                    className="mt-12 space-y-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                >
                    <div className="bg-white shadow-sm border border-slate-100 rounded-xl p-6">
                        <h3 className="text-slate-900 font-bold text-lg mb-4">Account Security</h3>
                        <div className="space-y-3">
                            <motion.button
                                onClick={() => setShowPasswordModal(true)}
                                className="w-full flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <Lock size={20} className="text-slate-600 group-hover:text-blue-600 transition-colors" />
                                    <span className="text-slate-700 font-medium group-hover:text-blue-700 transition-colors">Change Password</span>
                                </div>
                                <span className="text-slate-400 group-hover:text-slate-600 transition-colors">→</span>
                            </motion.button>
                            <motion.button className="w-full flex items-center justify-between p-3 hover:bg-red-50 rounded-lg transition-colors group">
                                <div className="flex items-center gap-3">
                                    <LogOut size={20} className="text-red-500" />
                                    <span className="text-slate-700 font-medium group-hover:text-red-600 transition-colors">Logout from All Devices</span>
                                </div>
                                <span className="text-slate-400 group-hover:text-red-400 transition-colors">→</span>
                            </motion.button>
                        </div>
                    </div>
                </motion.div>

                {/* Action Buttons */}
                <motion.div
                    className="mt-12 flex gap-4 justify-end"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                >
                    <motion.button
                        onClick={handleReset}
                        disabled={!hasChanges}
                        className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${hasChanges
                            ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                        whileHover={hasChanges ? { scale: 1.05 } : {}}
                        whileTap={hasChanges ? { scale: 0.95 } : {}}
                    >
                        <RotateCcw size={18} />
                        Reset Defaults
                    </motion.button>

                    <motion.button
                        onClick={handleSaveChanges}
                        disabled={!hasChanges || saveStatus !== 'idle'}
                        className={`flex items-center gap-2 px-8 py-3 rounded-lg font-semibold transition-all duration-300 ${hasChanges && saveStatus === 'idle'
                            ? 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-md'
                            : saveStatus === 'saved'
                                ? 'bg-green-500 text-white'
                                : 'bg-blue-100 text-blue-400 cursor-not-allowed'
                            }`}
                        whileHover={hasChanges && saveStatus === 'idle' ? { scale: 1.05 } : {}}
                        whileTap={hasChanges && saveStatus === 'idle' ? { scale: 0.95 } : {}}
                    >
                        {saveStatus === 'saving' && (
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity }}
                            >
                                <RotateCcw size={18} />
                            </motion.div>
                        )}
                        {saveStatus === 'saved' && <div>✓</div>}
                        {saveStatus === 'idle' && <Save size={18} />}
                        {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save Changes'}
                    </motion.button>
                </motion.div>
            </div>

            {/* Change Password Modal */}
            <AnimatePresence>
                {showPasswordModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative"
                        >
                            <button
                                onClick={() => setShowPasswordModal(false)}
                                className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X size={20} />
                            </button>

                            <div className="p-6">
                                <h3 className="text-2xl font-bold text-slate-900 mb-6">Change Password</h3>

                                <form onSubmit={handlePasswordChange} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Current Password</label>
                                        <input
                                            type="password"
                                            required
                                            value={passwordData.current}
                                            onChange={e => setPasswordData({ ...passwordData, current: e.target.value })}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all placeholder:text-slate-300"
                                            placeholder="Enter your current password"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">New Password</label>
                                        <input
                                            type="password"
                                            required
                                            value={passwordData.new}
                                            onChange={e => setPasswordData({ ...passwordData, new: e.target.value })}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all placeholder:text-slate-300"
                                            placeholder="Min. 6 characters"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Confirm New Password</label>
                                        <input
                                            type="password"
                                            required
                                            value={passwordData.confirm}
                                            onChange={e => setPasswordData({ ...passwordData, confirm: e.target.value })}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all placeholder:text-slate-300"
                                            placeholder="Retype new password"
                                        />
                                    </div>

                                    {passwordError && (
                                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                                            {passwordError}
                                        </div>
                                    )}

                                    <div className="pt-2">
                                        <button
                                            type="submit"
                                            disabled={passwordStatus === 'saving'}
                                            className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 hover:shadow-lg transition-all flex items-center justify-center gap-2"
                                        >
                                            {passwordStatus === 'saving' ? (
                                                <>
                                                    <motion.div
                                                        animate={{ rotate: 360 }}
                                                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                                    >
                                                        <RotateCcw size={18} />
                                                    </motion.div>
                                                    Updating...
                                                </>
                                            ) : passwordStatus === 'success' ? (
                                                <>
                                                    <Check size={20} /> Updated Successfully
                                                </>
                                            ) : (
                                                'Update Password'
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
