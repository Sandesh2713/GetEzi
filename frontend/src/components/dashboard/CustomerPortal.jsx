'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, User, RefreshCw, Clock, Users, MapPin, Phone, Mail, Calendar, X, Map, List, ChevronRight, ChevronLeft, Check, Leaf, XCircle } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import CustomerProfile from './CustomerProfile';
import CustomerPreferences from './CustomerPreferences';
import { SmartCalendar } from '../ui/SmartCalendar';

import { useMemo } from 'react';


export default function CustomerPortal({ user, onLogout, onRefresh, office = {}, availableOffices = [], onOfficeSelect, onBook, tokens = [], onUpdateToken, onUpdateUser }) {
    const [selectedOffice, setSelectedOffice] = useState(office?.id);
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const [appointmentDate, setAppointmentDate] = useState(new Date().toISOString().split('T')[0]);
    const [locationMode, setLocationMode] = useState('map');

    // Address Validation State
    const [showNotifications, setShowNotifications] = useState(false); // Notification State
    const [notifications, setNotifications] = useState([]); // Real notifications state
    const [showProfile, setShowProfile] = useState(false); // Profile State
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [activeProfileTab, setActiveProfileTab] = useState('profile');
    const [viewMode, setViewMode] = useState('dashboard');
    const [showProfileCompletionModal, setShowProfileCompletionModal] = useState(false);

    // Search & validation state
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState(null);
    const [resolvedAddress, setResolvedAddress] = useState(null);

    const unreadCount = notifications.filter(n => !n.read).length;

    // ... hooks ...



    const markAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    // Sync selectedOffice with prop
    useEffect(() => {
        if (office?.id) setSelectedOffice(office.id);
    }, [office]);
    // ... existing useEffects


    // Form state
    const [formData, setFormData] = useState({
        fullName: user?.name || '',
        email: user?.email || '',
        phone: user?.phone || '',
        service: null,
        location: null,
    });

    // Update form defaults when user prop changes
    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            fullName: user?.name || prev.fullName,
            email: user?.email || prev.email,
            phone: user?.phone || prev.phone
        }));
    }, [user]);

    // Check Profile Completion on Mount
    useEffect(() => {
        if (user) {
            // Simple check: if phone or address is missing (assuming these are critical)
            // Note: Since 'address' might not be on the base user object yet, checking phone is a good proxy for "new user" or just checking if they've visited profile.
            // For this feature, we'll aggressively check if we think they are new.
            // If the user object doesn't have these fields populated, we show the prompt.
            // Comprehensive check excluding medical info
            const requiredFields = [
                'name', 'email', 'phone', 'dob', 'gender',
                'address', 'city', 'state', 'zip_code',
                'emergency_contact_name', 'emergency_contact_phone'
            ];

            // Check if any required field is falsy
            const isIncomplete = requiredFields.some(field => !user[field]);

            if (isIncomplete) {
                // Add Notification
                setNotifications(prev => {
                    if (prev.find(n => n.id === 'profile-incomplete')) return prev;
                    return [
                        {
                            id: 'profile-incomplete',
                            title: 'Complete Your Profile',
                            message: 'Please complete your profile to reach 100% and enable all features.',
                            time: 'Now',
                            type: 'alert',
                            read: false
                        },
                        ...prev
                    ];
                });

                // Show Popup
                const hasSeenPopup = localStorage.getItem('profilePopupSeen');
                if (!hasSeenPopup) {
                    setShowProfileCompletionModal(true);
                    localStorage.setItem('profilePopupSeen', 'true'); // Show only once per session/browser to avoid annoyance, or remove this check to enforce it every time.
                    // User asked to "pop-up a message", implying a strong prompt. I'll show it.
                }
            }
        }
    }, [user]);

    // --- FETCH USER TOKENS (ALL OFFICES) ---
    const [userTokens, setUserTokens] = useState({ active: [], upcoming: [] });

    // Initial fetch + Periodic Poll (fallback for socket)
    useEffect(() => {
        if (!user?.id) return;
        const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
        const fetchUserTokens = async () => {
            try {
                // Use sessionStorage as AuthContext uses it
                const token = sessionStorage.getItem('token');
                const res = await fetch(`${API_BASE}/api/users/${user.id}/tokens`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    // Backend now returns { active: [], upcoming: [] }
                    setUserTokens(data);
                } else {
                    console.error("Fetch failed", res.status);
                }
            } catch (e) {
                console.error("Failed to fetch user tokens", e);
            }
        };

        fetchUserTokens();
        const interval = setInterval(fetchUserTokens, 10000); // refresh every 10s
        return () => clearInterval(interval);
    }, [user?.id, tokens]);

    // Simple Accessors matching new structure
    const activeTokens = userTokens.active || [];
    const futureTokens = userTokens.upcoming || [];

    // Process real data
    const currentOffice = availableOffices.find(o => o.id === selectedOffice) || office || {};

    // Calculate stats
    // Calculate Active Bookings for Today (to subtract from Capacity)
    const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayBookingsCount = (tokens || []).filter(t => {
        // Include only tokens for this office
        if (t.office_id !== selectedOffice) return false;

        // Exclude cancelled/no-show/hold (if hold consumes slot? usually yes, but let's stick to active)
        if (['cancelled', 'no-show'].includes(t.status)) return false;

        // Date Logic
        if (t.appointment_date) {
            // Scheduled: Must match Today
            return t.appointment_date === todayStr;
        } else {
            // Walk-in (No Date): Must be created TODAY
            // If created yesterday and still waiting, it technically consumes a slot today, but usually we care about 'New Bookings' capacity.
            // If we strictly want to reset "Daily Capacity" for "New Intakes", we should count how many slots are taken *for today*.
            // A rollover token consumes a slot. So created_at check might be lenient for WAIT, but strict for COMPLETED.

            // Fix: If COMPLETED/HISTORY, checks created_at. If WAIT, checks freshness?
            // Simplest: Check if created_at is today.
            const created = new Date(t.created_at);
            return created >= todayStart;
        }
    }).length;

    // Calculate Active Queue Length (Waiting + Allocated + Being Served)
    const currentQueueLength = (tokens || []).filter(t =>
        t.office_id === currentOffice?.id &&
        ['WAIT', 'ALLOCATED', 'CALLED'].includes(t.status)
    ).length;

    // Wait Time = Queue Length * Avg Service Time
    // If queue is empty, wait time is 0 (or we could show "Minimal")
    const waitTime = currentOffice
        ? `${currentQueueLength * (currentOffice.avg_service_minutes || 10)} min`
        : '-';

    // Open Slots = Capacity - Today's Valid Bookings
    const availableSlots = currentOffice ? Math.max(0, (currentOffice.daily_capacity || 50) - todayBookingsCount) : '-';

    const services = currentOffice.service_type
        ? currentOffice.service_type.split(',').map((s, i) => ({ id: s.trim(), name: s.trim(), duration: `${currentOffice.avg_service_minutes || 15} mins` })).filter(s => s.name)
        : [{ id: 'General', name: 'General Service', duration: '15 mins' }];

    const locations = availableOffices.length > 0
        ? availableOffices.map(o => ({ id: o.id, name: o.name, address: o.address, lat: o.lat || 12.9716, lng: o.lng || 77.5946 }))
        : (currentOffice.id ? [{ id: currentOffice.id, name: currentOffice.name, address: currentOffice.address, lat: 12.9716, lng: 77.5946 }] : []);

    // Animation variants
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
    };

    const floatingVariants = {
        animate: { y: [0, -10, 0], transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' } },
    };

    // Handlers
    const handleNextStep = () => {
        if (currentStep === 2) {
            // Validate Date
            if (!appointmentDate) return alert('Please select a date');
            if (appointmentDate < new Date().toISOString().split('T')[0]) return alert('Cannot book in past');

            // Check Closed Days
            const dateObj = new Date(appointmentDate);
            const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dateObj.getDay()];
            const workingDays = (currentOffice?.working_days || 'Mon,Tue,Wed,Thu,Fri,Sat').split(',').map(d => d.trim());

            let isClosed = false;
            if (dayName === 'Sun') {
                isClosed = !currentOffice?.allow_sunday;
            } else {
                isClosed = !workingDays.includes(dayName);
            }

            if (isClosed) return alert(`Office is closed on ${dayName}. Please choose another date.`);
        }
        if (currentStep === 3) {
            if (!formData.service) return alert('Please select a service');
        }
        if (currentStep < 4) setCurrentStep(currentStep + 1);
    };

    const handlePrevStep = () => {
        if (currentStep > 1) setCurrentStep(currentStep - 1);
    };

    const handleConfirmBooking = () => {
        // Validate Location (Step 4)
        if (!formData.userCoords) {
            return alert('Please select a location on the map or search for an address.');
        }

        onBook({
            customerName: formData.fullName,
            customerEmail: formData.email,
            customerContact: formData.phone,
            appointmentDate,
            serviceType: formData.service,
            // Match backend expectation: it looks for 'lat', 'lng', 'customerAddress'
            // The handleBookingSubmit in App.jsx maps userLat/userLng to body lat/lng.
            // So we send userLat/userLng here to match App.jsx expectation.
            userLat: formData.userCoords?.[1],
            userLng: formData.userCoords?.[0],
            customerAddress: resolvedAddress || 'Pinned Location',
            note: 'Booked via Portal'
        });
        setShowBookingModal(false);
        setCurrentStep(1);
    };

    const closeModal = () => {
        setShowBookingModal(false);
        setCurrentStep(1);
    };

    // Map Integration
    const mapContainer = useRef(null);
    const map = useRef(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Filter locations based on search
    const filteredLocations = searchQuery
        ? locations.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()) || l.address.toLowerCase().includes(searchQuery.toLowerCase()))
        : locations;

    useEffect(() => {
        if (showBookingModal && currentStep === 4 && mapContainer.current && !map.current) {
            // Default center: current office loc or generic Bangalore coords
            const defaultCenter = [77.5946, 12.9716];

            map.current = new maplibregl.Map({
                container: mapContainer.current,
                style: 'https://demotiles.maplibre.org/style.json',
                center: defaultCenter,
                zoom: 12
            });

            // Add Controls
            map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
            const geolocate = new maplibregl.GeolocateControl({
                positionOptions: { enableHighAccuracy: true },
                trackUserLocation: true
            });
            map.current.addControl(geolocate, 'top-right');

            // User Location Marker (Draggable)
            const userMarker = new maplibregl.Marker({ color: '#2563eb', draggable: true })
                .setLngLat(defaultCenter)
                .addTo(map.current);

            // Sync marker with formData
            if (formData.userCoords) {
                userMarker.setLngLat(formData.userCoords);
                map.current.setCenter(formData.userCoords);
            }

            const updateLocation = () => {
                const lngLat = userMarker.getLngLat();
                setFormData(prev => ({ ...prev, userCoords: [lngLat.lng, lngLat.lat] }));
                setResolvedAddress(null); // Clear address if user manually moves pin
            };

            userMarker.on('dragend', updateLocation);

            // Allow clicking map to move marker
            map.current.on('click', (e) => {
                userMarker.setLngLat(e.lngLat);
                updateLocation();
            });

            // Trigger geolocate on load if no coords set
            map.current.on('load', () => {
                map.current.resize();
                if (!formData.userCoords) {
                    geolocate.trigger();
                }
            });

            // Specific fix for map rendering in modal
            setTimeout(() => {
                map.current?.resize();
            }, 500);
        }
    }, [showBookingModal, currentStep]);

    useEffect(() => {
        if (!showBookingModal || currentStep !== 4) {
            if (map.current) {
                map.current.remove();
                map.current = null;
            }
        }
    }, [showBookingModal, currentStep]);


    // Render
    if (viewMode === 'profile') {
        return <CustomerProfile user={user} onBack={() => setViewMode('dashboard')} onUpdateUser={onUpdateUser} />;
    }

    if (viewMode === 'preferences') {
        return <CustomerPreferences onBack={() => setViewMode('dashboard')} />;
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-[GeistSans] text-slate-800">
            {/* Soft Background Gradient */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-100/40 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-100/40 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />
            </div>

            {/* Header */}
            <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm transition-all duration-300">
                <div className="container mx-auto h-16 max-w-7xl px-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.reload()}>
                        <div className="flex items-center gap-1">
                            <span className="text-xl font-bold tracking-tight text-gray-900">GetEzi</span>
                            <motion.div
                                animate={{ rotate: [0, 10, -10, 0] }}
                                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                            >
                                <Leaf className="h-5 w-5 text-emerald-500" />
                            </motion.div>
                        </div>
                        <div className="hidden sm:block h-6 w-px bg-gray-200 mx-2" />
                        <p className="hidden sm:block text-xs font-bold text-gray-400 tracking-widest uppercase mt-0.5">Queue Portal</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className={`relative p-2.5 rounded-full transition-all active:scale-95 shadow-sm hover:shadow border border-transparent hover:border-slate-100 ${showNotifications ? '!bg-blue-50 !text-blue-600 ring-2 ring-blue-100' : '!bg-white !text-slate-500 hover:!bg-slate-50 hover:!text-slate-600'
                                    }`}
                            >
                                <Bell size={20} />
                                {unreadCount > 0 && (
                                    <span className="absolute top-2 right-2.5 flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 border-2 border-white"></span>
                                    </span>
                                )}
                            </button>

                            {/* Notification Dropdown */}
                            <AnimatePresence>
                                {showNotifications && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        transition={{ duration: 0.2 }}
                                        className="absolute right-0 top-full mt-3 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-50 origin-top-right overflow-hidden"
                                    >
                                        <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-2">
                                            <h3 className="font-bold text-slate-800">Notifications</h3>
                                            {notifications.length > 0 && (
                                                <button onClick={markAllRead} className="text-xs font-bold text-blue-600 hover:underline">Mark all read</button>
                                            )}
                                        </div>

                                        <div className="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                                            {notifications.length === 0 ? (
                                                <div className="text-center py-8">
                                                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
                                                        <Bell size={20} />
                                                    </div>
                                                    <p className="text-sm font-medium text-slate-500">No new notifications</p>
                                                    <p className="text-xs text-slate-400 mt-1">We'll let you know when something happens.</p>
                                                </div>
                                            ) : (
                                                notifications.map((notif, idx) => (
                                                    <div key={idx} className={`flex gap-3 p-3 rounded-xl transition-colors cursor-pointer ${notif.read ? 'hover:bg-slate-50 bg-white' : 'bg-blue-50/50 hover:bg-blue-50'}`}>
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${notif.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                                                            {notif.type === 'success' ? <Check size={14} /> : <Clock size={14} />}
                                                        </div>
                                                        <div>
                                                            <p className={`text-sm ${notif.read ? 'font-medium text-slate-700' : 'font-bold text-slate-900'}`}>{notif.title}</p>
                                                            <p className="text-xs text-slate-500 mt-0.5">{notif.message}</p>
                                                            <p className="text-[10px] text-slate-400 font-medium mt-1">{notif.time}</p>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                        <div className="relative">
                            <button
                                onClick={() => setShowProfile(!showProfile)}
                                className={`flex items-center gap-2 !px-3 !py-1.5 !rounded-full !text-sm !font-medium transition-all border ${showProfile ? '!bg-blue-50 !border-blue-200 !text-blue-700' : '!bg-slate-50 !border-slate-100 !text-slate-700 hover:!bg-slate-100'
                                    }`}
                            >
                                <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center border border-slate-100 text-slate-400">
                                    <User size={12} />
                                </div>
                                {user?.name || 'Profile'}
                                <ChevronRight size={14} className={`transition-transform duration-200 ${showProfile ? 'rotate-90' : ''}`} />
                            </button>

                            {/* Profile Dropdown */}
                            <AnimatePresence>
                                {showProfile && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        transition={{ duration: 0.2 }}
                                        className="absolute right-0 top-full mt-3 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 origin-top-right overflow-hidden"
                                    >
                                        <div className="p-3 bg-slate-50 rounded-xl mb-1">
                                            <p className="font-bold text-slate-800 text-sm truncate">{user?.name || 'Guest User'}</p>
                                            <p className="text-xs text-slate-500 truncate">{user?.email || 'guest@example.com'}</p>
                                        </div>

                                        <div className="py-1">
                                            <button
                                                onClick={() => { setShowProfile(false); setViewMode('profile'); }}
                                                className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg flex items-center gap-2 transition-colors"
                                            >
                                                <User size={14} /> My Profile
                                            </button>
                                            <button
                                                onClick={() => { setShowProfile(false); setViewMode('preferences'); }}
                                                className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg flex items-center gap-2 transition-colors"
                                            >
                                                <Bell size={14} /> Preferences
                                            </button>
                                        </div>

                                        <div className="h-px bg-slate-100 my-1" />

                                        <button
                                            onClick={onLogout}
                                            className="w-full text-left px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 transition-colors font-medium"
                                        >
                                            <RefreshCw size={14} className="rotate-180" /> Sign Out
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Left Sidebar */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Office Selection */}
                        <div className="bg-white rounded-2xl p-5 shadow-sm border-2 border-slate-300">
                            <h2 className="text-[18px] font-bold text-slate-800 mb-4 px-1">Select Office</h2>
                            <div className="space-y-3">
                                {availableOffices.length > 0 ? availableOffices.map((off) => {
                                    const isSelected = selectedOffice === off.id;
                                    return (
                                        <div
                                            key={off.id}
                                            onClick={() => {
                                                setSelectedOffice(off.id);
                                                if (onOfficeSelect) onOfficeSelect(off.id);
                                            }}
                                            className={`
                                                w-full flex justify-between items-center p-4 rounded-xl border-2 transition-all duration-200 group relative bg-white cursor-pointer select-none
                                                ${isSelected
                                                    ? 'border-blue-500 bg-blue-50/30 ring-2 ring-blue-500/20 shadow-[0_8px_30px_rgba(59,130,246,0.25)]'
                                                    : 'border-slate-200 shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.15)] hover:border-blue-300 hover:-translate-y-1'
                                                }
                                            `}
                                        >
                                            <div className="flex flex-col items-start gap-1">
                                                <h3 className={`text-[15px] font-bold ${isSelected ? 'text-blue-700' : 'text-slate-900 group-hover:text-slate-700'}`}>
                                                    {off.name}
                                                </h3>
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500">
                                                    {off.hours || '24×7'}
                                                </span>
                                            </div>

                                            <div className="text-right pl-4">
                                                <p className="text-[13px] font-medium text-slate-600 leading-tight max-w-[140px] truncate">
                                                    {off.address}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                }) : <p className="text-sm italic text-slate-400">No offices found</p>}
                            </div>
                        </div>

                        {/* Current Status */}
                        <div className="bg-white rounded-2xl p-5 shadow-sm border-2 border-slate-300">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Office Details</p>
                            <h2 className="text-xl font-bold text-slate-800 mb-3">{currentOffice?.name || 'Select an Office'}</h2>
                            {currentOffice?.id ? (
                                <div className="space-y-2 mb-5">
                                    <div className="flex items-start gap-2 text-sm text-slate-600">
                                        <MapPin size={16} className="text-slate-400 shrink-0 mt-0.5" />
                                        <span>{currentOffice.address || 'Location not available'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <Clock size={16} className="text-slate-400 shrink-0" />
                                        <span>9:00 AM - 6:00 PM</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <Phone size={16} className="text-slate-400 shrink-0" />
                                        <span>+1 (555) 123-4567</span>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500 mb-5">Please select an office to view details and booking status.</p>
                            )}

                            {currentOffice?.id && (
                                <div className="grid grid-cols-2 gap-3 mb-5">
                                    <div className="p-3 bg-blue-50 rounded-xl border-2 border-blue-200 flex flex-col items-center justify-center text-center">
                                        <Clock size={20} className="text-blue-500 mb-1" />
                                        <span className="text-xs font-semibold text-slate-600 mb-1">Wait Time</span>
                                        <span className="text-lg font-bold text-blue-700">{waitTime}</span>
                                    </div>
                                    <div className="p-3 bg-emerald-50 rounded-xl border-2 border-emerald-200 flex flex-col items-center justify-center text-center">
                                        <Users size={20} className="text-emerald-500 mb-1" />
                                        <span className="text-xs font-semibold text-slate-600 mb-1">Open Slots</span>
                                        <span className="text-lg font-bold text-emerald-700">{availableSlots}</span>
                                    </div>
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    window.location.reload();
                                }}
                                className="w-full flex items-center justify-center gap-2 !py-3 !bg-white !border-2 !border-slate-100 !text-slate-700 !rounded-xl hover:!border-blue-200 hover:!bg-blue-50 transition-all !font-bold !text-sm"
                            >
                                <RefreshCw size={16} className="text-slate-400" />
                                Refresh Status
                            </button>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="lg:col-span-3 space-y-6">
                        {/* Hero Section */}
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden group">
                            <div className="relative z-10">
                                <h2 className="text-3xl font-bold mb-2">Ready to visit?</h2>
                                <p className="text-blue-100 text-lg mb-8 max-w-md">Book your slot now and skip the long wait. We'll notify you when it's your turn.</p>
                                <button
                                    onClick={() => {
                                        // CHECK PROFILE COMPLETION
                                        // Required fields (Except Medical)
                                        const required = [
                                            'name', 'email', 'phone',
                                            // 'dob' (dateOfBirth might be dob in DB), 'gender', 'blood_type',
                                            'dob', 'gender',
                                            // 'blood_type', // Exclude medical info
                                            'address', 'city', 'state', 'zip_code',
                                            'emergency_contact_name', 'emergency_contact_phone'
                                        ];
                                        const missing = required.filter(field => !user?.[field]);

                                        if (missing.length > 0) {
                                            alert(`Please complete your profile first! Missing: ${missing.join(', ').replace(/_/g, ' ')}`);
                                            setViewMode('profile');
                                            return;
                                        }
                                        setShowBookingModal(true);
                                    }}
                                    className="!px-8 !py-3.5 !bg-white !text-blue-600 !rounded-xl !font-bold hover:shadow-lg hover:scale-105 transition-all active:scale-95"
                                >
                                    Book an Appointment
                                </button>
                            </div>
                            {/* Decorative Background */}
                            <div className="absolute right-0 top-0 h-full w-1/2 bg-white/5 skew-x-12 translate-x-20" />
                            <Calendar size={120} className="absolute -bottom-6 -right-6 text-white/10 rotate-12 group-hover:scale-110 transition-transform duration-500" />
                        </div>

                        {/* Smart Info Banner */}


                        {/* Recent Bookings */}
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 mb-4 px-1">Active Tickets (Today)</h3>


                            {activeTokens.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {activeTokens.map((token) => (
                                        <div key={token.id} className="bg-white p-4 rounded-2xl border-2 border-slate-100 shadow-sm hover:border-blue-200 transition-colors group relative overflow-hidden">
                                            {/* Status Badge */}
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-800 text-lg">#{token.token_number}</span>
                                                    <span className="text-xs text-slate-500 font-medium">{token.service_type || 'General Service'}</span>
                                                    {token.office_name && (
                                                        <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider mt-1">{token.office_name}</span>
                                                    )}
                                                </div>
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${token.status === 'CALLED' ? 'bg-green-100 text-green-700 border-green-200' :
                                                    token.status === 'ALLOCATED' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                                        'bg-amber-100 text-amber-700 border-amber-200'
                                                    }`}>
                                                    {token.status}
                                                </span>
                                            </div>

                                            {/* Time Info */}
                                            <div className="space-y-1 mb-4">
                                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                                    <Clock size={14} className="text-slate-400" />
                                                    <span className="font-medium">
                                                        {token.status === 'CALLED' ? 'Serving Now' :
                                                            token.status === 'ALLOCATED' ? 'Head to Counter' :
                                                                `ETA: ${Math.round(token.eta_minutes || 0)} mins`}
                                                    </span>
                                                </div>
                                                {token.service_start_time && (
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <Calendar size={14} className="text-slate-400" />
                                                        <span>{new Date(token.service_start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                )}
                                                {token.assigned_counter && (
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <MapPin size={14} className="text-slate-400" />
                                                        <span>Counter {token.assigned_counter}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action Buttons */}
                                            {['ALLOCATED', 'WAIT'].includes(token.status) && token.presence_status !== 'ARRIVED' && (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => onUpdateToken(token.id, 'arrive')}
                                                        className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                                                    >
                                                        <MapPin size={14} />
                                                        I've Arrived
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (confirm('Are you sure you want to cancel this ticket?')) {
                                                                onUpdateToken(token.id, 'cancel');
                                                            }
                                                        }}
                                                        className="py-2 px-4 bg-white border-2 border-rose-300 text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                                                    >
                                                        <XCircle size={14} />
                                                        Cancel
                                                    </button>
                                                </div>
                                            )}

                                            {token.presence_status === 'ARRIVED' && token.status === 'ALLOCATED' && (
                                                <div className="w-full py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border-2 border-emerald-200">
                                                    <Check size={14} />
                                                    You've Arrived
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-slate-50 rounded-2xl p-6 border-2 border-slate-300 flex flex-col items-center justify-center text-center border-dashed">
                                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm text-slate-300">
                                        <Calendar size={24} />
                                    </div>
                                    <p className="text-sm font-bold text-slate-600">No bookings yet</p>
                                    <p className="text-xs text-slate-400 mt-1 max-w-[200px]">Book your first appointment to avoid the queue!</p>
                                </div>
                            )}
                        </div>

                        {/* Future Bookings Section */}
                        {futureTokens.length > 0 && (
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 mb-4 px-1 flex items-center gap-2">
                                    <Calendar className="text-blue-600" size={20} />
                                    Upcoming Tickets
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {futureTokens.map((token) => (
                                        <div key={token.id} className="bg-white p-4 rounded-2xl border-2 border-slate-100 shadow-sm hover:border-indigo-200 transition-colors group relative overflow-hidden">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-800 text-lg">#{token.token_number}</span>
                                                    <span className="text-xs text-slate-500 font-medium">{token.service_type || 'General Service'}</span>
                                                </div>
                                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border bg-indigo-50 text-indigo-700 border-indigo-100">
                                                    Scheduled
                                                </span>
                                            </div>

                                            <div className="space-y-2 mb-2">
                                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                                    <Calendar size={14} className="text-indigo-400" />
                                                    <span className="font-medium">
                                                        {new Date(token.appointment_date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <MapPin size={14} className="text-slate-400" />
                                                    <span>{token.office_name || currentOffice?.name || 'Office'}</span>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => {
                                                    if (confirm('Are you sure you want to cancel this upcoming appointment?')) {
                                                        onUpdateToken(token.id, 'cancel');
                                                    }
                                                }}
                                                className="w-full py-2 bg-white border-2 border-rose-300 text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                                            >
                                                <XCircle size={14} />
                                                Cancel
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Booking Modal */}
            <AnimatePresence>
                {showBookingModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
                            onClick={closeModal}
                        />
                        <motion.div
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden"
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        >
                            {/* Modal Header */}
                            <div className="bg-slate-50 px-8 py-6 flex items-center justify-between border-b border-slate-100">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">Book Appointment</h3>
                                    <p className="text-slate-500 text-xs font-medium mt-1 uppercase tracking-wider">Step {currentStep} of 4</p>
                                </div>
                                <button onClick={closeModal} className="!p-2 hover:!bg-slate-200 !bg-transparent !rounded-full transition-colors !text-slate-500">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Progress Line */}
                            <div className="h-1 bg-slate-100 w-full">
                                <motion.div
                                    className="h-full bg-blue-600"
                                    initial={{ width: '0%' }}
                                    animate={{ width: `${(currentStep / 4) * 100}%` }}
                                />
                            </div>

                            <div className="p-8">
                                <AnimatePresence mode="wait">
                                    {/* STEP 1: DETAILS */}
                                    {currentStep === 1 && (
                                        <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                                            <div className="space-y-1">
                                                <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                                                <input
                                                    value={formData.fullName}
                                                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 focus:bg-white outline-none transition-all font-medium text-slate-800"
                                                    placeholder="Enter your name"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                                                <input
                                                    type="email"
                                                    value={formData.email}
                                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 focus:bg-white outline-none transition-all font-medium text-slate-800"
                                                    placeholder="name@example.com"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-bold text-slate-500 uppercase">Phone</label>
                                                <input
                                                    type="tel"
                                                    value={formData.phone}
                                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 focus:bg-white outline-none transition-all font-medium text-slate-800"
                                                    placeholder="+1 234 567 890"
                                                />
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* STEP 2: DATE */}
                                    {currentStep === 2 && (
                                        <motion.div key="step2-date" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                                            <h4 className="text-lg font-bold text-slate-800 mb-2">Select Date</h4>
                                            <SmartCalendar
                                                officeId={selectedOffice}
                                                selectedDate={appointmentDate}
                                                onSelect={setAppointmentDate}
                                            />
                                        </motion.div>
                                    )}

                                    {/* STEP 3: SERVICE */}
                                    {currentStep === 3 && (
                                        <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
                                            <h4 className="text-lg font-bold text-slate-800 mb-4">Select Service</h4>
                                            {services.map((service) => (
                                                <button
                                                    key={service.id}
                                                    onClick={() => setFormData({ ...formData, service: service.id })}
                                                    className={`w-full !p-4 !rounded-xl !border-2 text-left transition-all flex items-center justify-between group ${formData.service === service.id
                                                        ? '!border-blue-500 !bg-blue-50'
                                                        : '!border-slate-100 !bg-white hover:!border-blue-200'
                                                        }`}
                                                >
                                                    <div>
                                                        <div className={`font-bold ${formData.service === service.id ? '!text-blue-700' : '!text-slate-700'}`}>{service.name}</div>
                                                        <div className="text-xs !text-slate-400 font-medium mt-1">{service.duration}</div>
                                                    </div>
                                                    {formData.service === service.id && (
                                                        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                                            <Check className="text-white w-3 h-3" strokeWidth={4} />
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}

                                    {/* STEP 4: USER LOCATION */}
                                    {currentStep === 4 && (
                                        <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-lg font-bold text-slate-800">Where are you coming from?</h4>
                                                <button
                                                    onClick={() => {
                                                        if (navigator.geolocation) {
                                                            setIsSearching(true);
                                                            navigator.geolocation.getCurrentPosition(async (pos) => {
                                                                const { latitude, longitude } = pos.coords;

                                                                // 1. Update Map
                                                                if (map.current) {
                                                                    map.current.flyTo({ center: [longitude, latitude], zoom: 16 });
                                                                    // We need to update the marker position visually too, usually handled by re-render or explicit set
                                                                    // But since map setup is in useEffect dependent on showBookingModal, we assume the marker listens to formData changes or we force it?
                                                                    // Actually checking line 296: userMarker.setLngLat(formData.userCoords) is inside initialization.
                                                                    // We might need to manually update marker if it exists. 
                                                                    // Let's defer that to the map effect or just rely on state. 
                                                                    // Wait, the map effect (line 296) only runs on MOUNT. 
                                                                    // We need to update the marker instance if it exists.
                                                                    // But we don't have easy access to 'userMarker' variable here unless we store it in ref.
                                                                    // The code at line 291 creates 'userMarker' locally. That's a bug in previous code if we want it to update reactively.
                                                                    // HOWEVER, the user request is about ADDRESS verification.
                                                                }

                                                                // 2. Reverse Geocode
                                                                try {
                                                                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                                                                    const data = await res.json();
                                                                    if (data && data.display_name) {
                                                                        setResolvedAddress(data.display_name);
                                                                        setSearchQuery(""); // Clear search query as we used GPS
                                                                    }
                                                                } catch (e) {
                                                                    console.error("Geocoding failed", e);
                                                                    setResolvedAddress("Current Location (Address lookup failed)");
                                                                } finally {
                                                                    setIsSearching(false);
                                                                    setFormData(prev => ({ ...prev, userCoords: [longitude, latitude] }));
                                                                }
                                                            }, (err) => {
                                                                console.error(err);
                                                                setIsSearching(false);
                                                                alert("Could not pull location. Please ensure GPS is enabled.");
                                                            });
                                                        }
                                                    }}
                                                    className="text-xs !font-bold !text-blue-600 flex items-center gap-1 hover:underline !bg-transparent"
                                                >
                                                    <MapPin size={12} /> Use my location
                                                </button>
                                            </div>

                                            {/* Search / Address Input */}
                                            <div className="space-y-2">
                                                <div className="relative">
                                                    <input
                                                        placeholder="Enter address & press Enter..."
                                                        value={searchQuery}
                                                        onChange={(e) => {
                                                            setSearchQuery(e.target.value);
                                                            setSearchError(null);
                                                            if (!e.target.value) setResolvedAddress(null);
                                                        }}
                                                        onKeyDown={async (e) => {
                                                            if (e.key === 'Enter' && searchQuery.length > 3) {
                                                                setIsSearching(true);
                                                                setSearchError(null);
                                                                try {
                                                                    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
                                                                    const data = await res.json();
                                                                    if (data && data.length > 0) {
                                                                        const { lat, lon, display_name } = data[0];
                                                                        setFormData(prev => ({ ...prev, userCoords: [parseFloat(lon), parseFloat(lat)] }));
                                                                        setResolvedAddress(display_name);
                                                                    } else {
                                                                        setSearchError("Address not found. Please try a different query.");
                                                                        setResolvedAddress(null);
                                                                    }
                                                                } catch (err) {
                                                                    setSearchError("Unable to validate address. Please check your connection.");
                                                                } finally {
                                                                    setIsSearching(false);
                                                                }
                                                            }
                                                        }}
                                                        disabled={isSearching}
                                                        className={`w-full pl-10 pr-10 py-3 bg-slate-50 border-2 rounded-xl outline-none text-sm font-medium transition-colors ${searchError ? '!border-rose-300 focus:!border-rose-500' :
                                                            resolvedAddress ? '!border-emerald-300 focus:!border-emerald-500' :
                                                                '!border-slate-100 focus:!border-blue-500'
                                                            }`}
                                                    />
                                                    <MapPin size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${resolvedAddress ? 'text-emerald-500' : 'text-slate-400'}`} />

                                                    {isSearching ? (
                                                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                                                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                                        </div>
                                                    ) : resolvedAddress ? (
                                                        <Check size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500" />
                                                    ) : null}
                                                </div>

                                                {/* Validation Feedback */}
                                                {searchError && (
                                                    <p className="text-xs text-rose-500 font-medium px-1 flex items-center gap-1">
                                                        <X size={12} /> {searchError}
                                                    </p>
                                                )}
                                                {resolvedAddress && (
                                                    <p className="text-xs text-emerald-600 font-medium px-1 flex items-center gap-1">
                                                        <Check size={12} /> Found: <span className="truncate max-w-[280px]">{resolvedAddress}</span>
                                                    </p>
                                                )}
                                            </div>

                                            {/* Map Area */}
                                            <div className="relative h-64 rounded-xl overflow-hidden border-2 border-slate-100 bg-slate-50">
                                                <LocationPickerMap
                                                    onLocationSelect={(coords) => setFormData(prev => ({ ...prev, userCoords: coords }))}
                                                    initialCoords={formData.userCoords}
                                                />
                                                <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full text-xs font-bold shadow-sm text-slate-600 pointer-events-none z-10 border border-slate-100">
                                                    Tap to pin your location
                                                </div>
                                            </div>

                                            {/* Selected Location Display */}
                                            {formData.userCoords && (
                                                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                                                        <MapPin size={16} />
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <p className="text-xs font-bold text-blue-800 uppercase">Selected Location</p>
                                                        <p className="text-sm font-medium text-blue-900 truncate">
                                                            {resolvedAddress || `${formData.userCoords[1].toFixed(4)}, ${formData.userCoords[0].toFixed(4)}`}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-6 border-t border-slate-100 flex justify-between bg-slate-50/50">
                                <button
                                    onClick={handlePrevStep}
                                    disabled={currentStep === 1}
                                    className={`!px-6 !py-2.5 !rounded-xl !font-bold !text-sm transition-colors !border-0 ${currentStep === 1 ? '!text-slate-300 !cursor-not-allowed !bg-transparent' : '!text-slate-600 hover:!bg-slate-100 !bg-transparent'
                                        }`}
                                >
                                    Back
                                </button>
                                <button
                                    onClick={currentStep === 4 ? handleConfirmBooking : handleNextStep}
                                    className="!px-8 !py-2.5 !bg-gradient-to-r !from-blue-600 !to-indigo-600 !text-white !rounded-xl !font-bold !text-sm hover:!shadow-lg hover:!scale-105 transition-all active:!scale-95 flex items-center gap-2"
                                >
                                    {currentStep === 4 ? 'Confirm Booking' : 'Next Step'}
                                    {currentStep !== 3 && <ChevronRight size={16} />}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Profile & Preferences Modal */}
            <AnimatePresence>
                {showProfileModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            {/* Modal Header */}
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <h3 className="text-lg font-bold text-slate-800">
                                    {activeProfileTab === 'profile' ? 'My Profile' : 'Preferences'}
                                </h3>
                                <button onClick={() => setShowProfileModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="p-6 overflow-y-auto">
                                {activeProfileTab === 'profile' ? (
                                    <div className="space-y-4">
                                        <div className="flex flex-col items-center mb-6">
                                            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-3 border-4 border-blue-50">
                                                <User size={40} />
                                            </div>
                                            <button className="text-xs font-bold text-blue-600 hover:underline">Change Photo</button>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                                            <input defaultValue={user?.name} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 outline-none text-sm font-medium transition-colors" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Email Address</label>
                                            <input defaultValue={user?.email} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 outline-none text-sm font-medium transition-colors" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Phone Number</label>
                                            <input defaultValue={user?.phone || ''} placeholder="+1 (555) 000-0000" className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 outline-none text-sm font-medium transition-colors" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white rounded-lg text-blue-600 shadow-sm">
                                                    <Mail size={20} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-700 text-sm">Email Notifications</p>
                                                    <p className="text-xs text-slate-500">Receive booking updates via email</p>
                                                </div>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" defaultChecked className="sr-only peer" />
                                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                            </label>
                                        </div>

                                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white rounded-lg text-emerald-600 shadow-sm">
                                                    <Phone size={20} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-700 text-sm">SMS Notifications</p>
                                                    <p className="text-xs text-slate-500">Receive booking updates via text</p>
                                                </div>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" defaultChecked className="sr-only peer" />
                                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="p-6 border-t border-slate-100 bg-slate-50/50">
                                <button className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:shadow-lg transition-all active:scale-95 text-sm">
                                    Save Changes
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Profile Completion Modal (Popup) */}
            <AnimatePresence>
                {showProfileCompletionModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden text-center p-6"
                        >
                            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <User size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Complete Your Profile</h3>
                            <p className="text-slate-500 mb-6 text-sm">
                                Your profile is incomplete. Please add your contact and address details to get the best experience and reach 100% completion.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowProfileCompletionModal(false)}
                                    className="flex-1 py-2.5 text-slate-500 font-bold text-sm hover:bg-slate-50 rounded-xl transition-colors"
                                >
                                    Later
                                </button>
                                <button
                                    onClick={() => {
                                        setShowProfileCompletionModal(false);
                                        setViewMode('profile');
                                    }}
                                    className="flex-1 py-2.5 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 hover:shadow-lg transition-all"
                                >
                                    Complete Now
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div >
    );
}

// Dedicated Map Component to handle lifecycle and resizing robustly
// ... existing LocationPickerMap component lines...
function LocationPickerMap({ onLocationSelect, initialCoords }) {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const marker = useRef(null);

    useEffect(() => {
        if (!mapContainer.current) return;

        // Cleanup existing map if it exists (react strict mode safety)
        if (map.current) return;

        const defaultCenter = [77.5946, 12.9716];
        const center = initialCoords || defaultCenter;

        map.current = new maplibregl.Map({
            container: mapContainer.current,
            // Use Carto Voyager Raster Tiles for detailed street view
            style: {
                version: 8,
                sources: {
                    'carto-voyager': {
                        type: 'raster',
                        tiles: ['https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'],
                        tileSize: 256,
                        attribution: '&copy; CartoDB &copy; OpenStreetMap'
                    }
                },
                layers: [{
                    id: 'carto-voyager-layer',
                    type: 'raster',
                    source: 'carto-voyager',
                    minzoom: 0,
                    maxzoom: 20
                }]
            },
            center: center,
            zoom: 13, // Slightly closer zoom for street detail
            attributionControl: false
        });

        // Controls
        map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
        const geolocate = new maplibregl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: true
        });
        map.current.addControl(geolocate, 'top-right');

        // Marker
        marker.current = new maplibregl.Marker({ color: '#2563eb', draggable: true })
            .setLngLat(center)
            .addTo(map.current);

        const updateMarker = () => {
            const lngLat = marker.current.getLngLat();
            onLocationSelect([lngLat.lng, lngLat.lat]);
        };

        marker.current.on('dragend', updateMarker);

        map.current.on('click', (e) => {
            marker.current.setLngLat(e.lngLat);
            updateMarker();
        });

        map.current.on('load', () => {
            map.current.resize();
            if (!initialCoords) {
                geolocate.trigger();
            }
        });

        // Robust Resize Observer
        const resizeObserver = new ResizeObserver(() => {
            if (map.current) {
                map.current.resize();
            }
        });
        resizeObserver.observe(mapContainer.current);

        return () => {
            resizeObserver.disconnect();
            map.current?.remove();
            map.current = null;
        };
    }, []); // Run once on mount

    // Update marker if initialCoords changes externally (e.g. from search)
    useEffect(() => {
        if (initialCoords && map.current && marker.current) {
            // Only update if significantly different to avoid loops
            const current = marker.current.getLngLat();
            if (Math.abs(current.lng - initialCoords[0]) > 0.0001 || Math.abs(current.lat - initialCoords[1]) > 0.0001) {
                marker.current.setLngLat(initialCoords);
                map.current.flyTo({ center: initialCoords, zoom: 14 });
            }
        }
    }, [initialCoords]);

    return <div ref={mapContainer} className="w-full h-full" style={{ minHeight: '100%' }} />;
}
