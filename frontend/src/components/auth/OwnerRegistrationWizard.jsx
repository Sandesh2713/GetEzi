import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, Check, MapPin, Building2, Clock, User, Zap, Mail, Lock, Phone, LocateFixed, Loader2, Leaf, Sparkles, Eye, EyeOff } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const LabeledInput = ({ label, ...props }) => (
    <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-gray-700">{label}</label>
        <Input {...props} className="h-11 bg-gray-50/50 border-gray-200 focus:bg-white focus:border-emerald-500 rounded-xl" />
    </div>
);

const steps = [
    { id: 1, title: 'Owner Account', icon: User },
    { id: 2, title: 'Office Info', icon: Building2 },
    { id: 3, title: 'Location', icon: MapPin },
    { id: 4, title: 'Timings', icon: Clock },
    { id: 5, title: 'Automation', icon: Zap },
    { id: 6, title: 'Review', icon: Check }
];

export function OwnerRegistrationWizard({ onSubmit, onBack }) {
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        // Step 1: Owner
        name: '', email: '', password: '', confirmPassword: '', phone: '',
        // Step 2: Office Basic
        officeName: '', serviceType: '', dailyCapacity: 100, counterCount: 1,
        // Step 3: Location
        address: '', city: 'Bangalore', pincode: '', lat: 12.9716, lng: 77.5946,
        // Step 4: Timings
        openingTime: '09:00', closingTime: '17:00', lunchStart: '13:00', lunchEnd: '13:30',
        // Step 5: Automation
        autoNoShow: false, graceMinutes: 5
    });

    const updateField = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setError('');
    };

    // Validation Logic
    const validateStep = (step) => {
        const d = formData;
        switch (step) {
            case 1:
                if (!d.name || !d.email || !d.password || !d.phone) return "All fields required";
                if (d.password !== d.confirmPassword) return "Passwords do not match";
                if (d.password.length < 6) return "Password too weak";
                return null;
            case 2:
                if (!d.officeName || !d.serviceType) return "Office Name & Service Type required";
                if (d.dailyCapacity < 1) return "Daily Capacity must be > 0";
                if (d.counterCount < 1) return "Counters must be > 0";
                return null;
            case 3:
                if (!d.address || !d.city) return "Address & City required";
                return null;
            case 4:
                if (d.closingTime <= d.openingTime) return "Closing time must be after Opening time";
                if (d.lunchStart && d.lunchEnd && d.lunchEnd <= d.lunchStart) return "Lunch End must be after Start";
                return null;
            default:
                return null;
        }
    };

    const handleNext = () => {
        const err = validateStep(currentStep);
        if (err) {
            setError(err);
            return;
        }
        if (currentStep < 6) setCurrentStep(curr => curr + 1);
    };

    const handleBack = () => {
        if (currentStep > 1) setCurrentStep(curr => curr - 1);
        else onBack();
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            await onSubmit({
                name: formData.name,
                email: formData.email,
                password: formData.password,
                phone: formData.phone,
                role: 'office_owner',
                dob: null,
                gender: null,
                officeDetails: {
                    name: formData.officeName,
                    address: `${formData.address}, ${formData.city} - ${formData.pincode}`,
                    serviceType: formData.serviceType,
                    dailyCapacity: parseInt(formData.dailyCapacity),
                    avgServiceMinutes: 15,
                    counterCount: parseInt(formData.counterCount),
                    openingTime: formData.openingTime,
                    closingTime: formData.closingTime,
                    lunchStart: formData.lunchStart,
                    lunchEnd: formData.lunchEnd,
                    autoNoShow: formData.autoNoShow,
                    autoNoShowGrace: formData.graceMinutes,
                    latitude: formData.lat,
                    longitude: formData.lng
                }
            });
        } catch (err) {
            setError(err.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    const handleGeocode = async () => {
        if (!formData.address && !formData.city) {
            setError('Please enter at least an Address or City to check location.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const query = `${formData.address}, ${formData.city}, ${formData.pincode}`;
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
            const data = await res.json();

            if (data && data.length > 0) {
                const { lat, lon } = data[0];
                updateField('lat', parseFloat(lat));
                updateField('lng', parseFloat(lon));
            } else {
                setError('Could not find location. Please try adjusting the address or pin manually.');
            }
        } catch (err) {
            setError('Failed to check location. Please pin manually.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 w-screen h-screen flex overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-teal-50">
            {/* Branding - Top Left */}
            <div className="absolute top-8 left-8 z-50">
                <div className="flex items-center gap-3 cursor-pointer" onClick={onBack}>
                    <span className="text-3xl font-bold tracking-tight text-emerald-900 lg:text-white">GetEzi</span>
                    <Leaf className="h-8 w-8 text-emerald-600 lg:text-emerald-300" />
                </div>
            </div>

            {/* Animated Background Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl text-emerald-900"
                    animate={{ scale: [1, 1.2, 1], x: [0, 30, 0], y: [0, -20, 0] }}
                    transition={{ duration: 8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                />
                <motion.div
                    className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-200/30 rounded-full blur-3xl"
                    animate={{ scale: [1.2, 1, 1.2], x: [0, -20, 0], y: [0, 30, 0] }}
                    transition={{ duration: 10, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                />
            </div>

            {/* Left Panel - Progress & Info */}
            <motion.div
                className="hidden lg:flex lg:w-1/2 relative flex-col justify-center items-center p-12 bg-gradient-to-br from-emerald-600 to-teal-700"
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.8 }}
            >
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%23ffffff' fillOpacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />
                </div>

                <div className="relative z-10 w-full max-w-md">
                    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
                        <h1 className="text-4xl font-bold text-white mb-4">Setup Your Office</h1>
                        <p className="text-emerald-100 text-lg mb-10">Complete these steps to launch your digital queue system.</p>
                    </motion.div>

                    {/* Left Side Stepper */}
                    <div className="space-y-4">
                        {steps.map((s, idx) => {
                            const isActive = currentStep === s.id;
                            const isCompleted = currentStep > s.id;
                            return (
                                <motion.div
                                    key={s.id}
                                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${isActive ? 'bg-white/20 border-white/40 shadow-lg' :
                                            isCompleted ? 'bg-emerald-800/20 border-emerald-500/30' : 'opacity-50 border-transparent'
                                        }`}
                                    initial={{ x: -20, opacity: 0 }}
                                    animate={{ x: 0, opacity: isActive || isCompleted ? 1 : 0.5 }}
                                    transition={{ delay: 0.4 + idx * 0.1 }}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive ? 'bg-white text-emerald-600' :
                                            isCompleted ? 'bg-emerald-400 text-white' : 'bg-white/10 text-white'
                                        }`}>
                                        {isCompleted ? <Check className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
                                    </div>
                                    <div className="text-white">
                                        <div className="font-semibold">{s.title}</div>
                                        {isActive && <div className="text-xs text-emerald-100">Step {s.id} of 6</div>}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </motion.div>

            {/* Right Panel - Form Wizard */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 relative z-10 overflow-y-auto">
                <motion.div
                    className="w-full max-w-2xl"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    {/* Mobile Branding */}
                    <motion.div className="lg:hidden text-center mb-8" initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
                        <div onClick={onBack} className="inline-flex items-center gap-2 cursor-pointer">
                            <span className="text-2xl font-bold text-emerald-600">GetEzi</span>
                            <span className="text-xl">🌱</span>
                        </div>
                    </motion.div>

                    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-emerald-500/10 p-6 md:p-10 border border-white/50 min-h-[500px] flex flex-col">

                        <div className="flex-1">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentStep}
                                    initial={{ x: 20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    exit={{ x: -20, opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    {/* Mobile progress */}
                                    <div className="lg:hidden mb-6 flex justify-between items-center text-sm font-semibold text-emerald-600">
                                        <span>{steps[currentStep - 1].title}</span>
                                        <span>Step {currentStep}/6</span>
                                    </div>

                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{steps[currentStep - 1].title}</h2>
                                    <p className="text-gray-500 mb-6 text-sm">Please fill in the details below to proceed.</p>

                                    {error && (
                                        <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-center gap-2 animate-pulse">
                                            <span className="font-bold">Error:</span> {error}
                                        </div>
                                    )}

                                    {/* --- STEPS CONTENT --- */}
                                    {currentStep === 1 && (
                                        <div className="space-y-4">
                                            <div className="grid md:grid-cols-2 gap-4">
                                                <LabeledInput label="Full Name" value={formData.name} onChange={e => updateField('name', e.target.value)} placeholder="John Doe" />
                                                <LabeledInput label="Phone Number" value={formData.phone} onChange={e => updateField('phone', e.target.value)} placeholder="+91 98765 43210" />
                                            </div>
                                            <LabeledInput label="Email Address" type="email" value={formData.email} onChange={e => updateField('email', e.target.value)} placeholder="owner@business.com" />
                                            <div className="grid md:grid-cols-2 gap-4">
                                                <div className="relative group">
                                                    <LabeledInput label="Password" type={showPassword ? "text" : "password"} value={formData.password} onChange={e => updateField('password', e.target.value)} placeholder="Strong password" />
                                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-[34px] text-gray-400 hover:text-emerald-500">
                                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                                <LabeledInput label="Confirm Password" type="password" value={formData.confirmPassword} onChange={e => updateField('confirmPassword', e.target.value)} placeholder="Repeat password" />
                                            </div>
                                        </div>
                                    )}

                                    {currentStep === 2 && (
                                        <div className="space-y-4">
                                            <LabeledInput label="Office / Clinic Name" value={formData.officeName} onChange={e => updateField('officeName', e.target.value)} placeholder="e.g. Apollo Diagnostics" />
                                            <LabeledInput label="Service Type" value={formData.serviceType} onChange={e => updateField('serviceType', e.target.value)} placeholder="e.g. General Consultation" />
                                            <div className="grid grid-cols-2 gap-4">
                                                <LabeledInput label="Daily Capacity" type="number" value={formData.dailyCapacity} onChange={e => updateField('dailyCapacity', e.target.value)} />
                                                <LabeledInput label="No. of Counters" type="number" value={formData.counterCount} onChange={e => updateField('counterCount', e.target.value)} />
                                            </div>
                                        </div>
                                    )}

                                    {currentStep === 3 && (
                                        <div className="space-y-6">
                                            <div className="space-y-4">
                                                <LabeledInput label="Street Address" value={formData.address} onChange={e => updateField('address', e.target.value)} placeholder="#123, Main Street" />
                                                <div className="grid grid-cols-2 gap-4">
                                                    <LabeledInput label="City" value={formData.city} onChange={e => updateField('city', e.target.value)} />
                                                    <LabeledInput label="Pincode" value={formData.pincode} onChange={e => updateField('pincode', e.target.value)} />
                                                </div>
                                            </div>
                                            <div className="flex justify-end mb-2">
                                                <Button variant="outline" size="sm" onClick={handleGeocode} disabled={loading} className="text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                                                    {loading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <MapPin className="w-3 h-3 mr-2" />}
                                                    Check Location
                                                </Button>
                                            </div>
                                            <div className="h-48 md:h-64 bg-gray-100 rounded-xl overflow-hidden relative border border-gray-300 shadow-inner">
                                                <MapPicker lat={formData.lat} lng={formData.lng} onLocationSelect={(lat, lng) => { updateField('lat', lat); updateField('lng', lng); }} />
                                            </div>
                                            <div className="text-xs text-gray-400 text-center">Pin your exact location on the map</div>
                                        </div>
                                    )}

                                    {currentStep === 4 && (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-2 gap-6">
                                                <LabeledInput label="Opens At" type="time" value={formData.openingTime} onChange={e => updateField('openingTime', e.target.value)} />
                                                <LabeledInput label="Closes At" type="time" value={formData.closingTime} onChange={e => updateField('closingTime', e.target.value)} />
                                            </div>
                                            <div className="border-t border-gray-100 pt-4">
                                                <h4 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400" /> Lunch Break (Optional)</h4>
                                                <div className="grid grid-cols-2 gap-6">
                                                    <LabeledInput label="Start Time" type="time" value={formData.lunchStart} onChange={e => updateField('lunchStart', e.target.value)} />
                                                    <LabeledInput label="End Time" type="time" value={formData.lunchEnd} onChange={e => updateField('lunchEnd', e.target.value)} />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {currentStep === 5 && (
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl bg-gray-50 hover:border-emerald-200 transition-colors">
                                                <div className="flex gap-3">
                                                    <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><Zap className="w-5 h-5" /></div>
                                                    <div>
                                                        <div className="font-semibold text-gray-900">Auto No-Show Detection</div>
                                                        <div className="text-sm text-gray-500">Automatically mark tokens as 'No Show'</div>
                                                    </div>
                                                </div>
                                                <input type="checkbox" checked={formData.autoNoShow} onChange={e => updateField('autoNoShow', e.target.checked)} className="w-6 h-6 accent-emerald-600 rounded cursor-pointer" />
                                            </div>
                                            {formData.autoNoShow && (
                                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}>
                                                    <LabeledInput label="Grace Period (Minutes)" type="number" value={formData.graceMinutes} onChange={e => updateField('graceMinutes', e.target.value)} />
                                                </motion.div>
                                            )}
                                        </div>
                                    )}

                                    {currentStep === 6 && (
                                        <div className="space-y-6">
                                            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                                                <h3 className="font-bold text-emerald-800 mb-4 flex items-center gap-2"><Check className="w-5 h-5" /> Account Summary</h3>
                                                <div className="text-sm text-emerald-700 grid grid-cols-2 gap-y-3">
                                                    <div><span className="opacity-70 text-xs block">Name</span>{formData.name}</div>
                                                    <div><span className="opacity-70 text-xs block">Role</span>Owner</div>
                                                    <div className="col-span-2"><span className="opacity-70 text-xs block">Email</span>{formData.email}</div>
                                                </div>
                                            </div>
                                            <div className="border border-gray-200 rounded-xl overflow-hidden">
                                                <div className="p-3 bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200">Office Profile</div>
                                                <div className="p-5 grid grid-cols-2 gap-4 text-sm">
                                                    <div><span className="block text-gray-400 text-xs font-semibold uppercase">Details</span><span className="font-medium text-gray-800">{formData.officeName}<br />{formData.serviceType}</span></div>
                                                    <div><span className="block text-gray-400 text-xs font-semibold uppercase">Config</span><span className="font-medium text-gray-800">{formData.counterCount} Counters<br />{formData.openingTime} - {formData.closingTime}</span></div>
                                                    <div className="col-span-2"><span className="block text-gray-400 text-xs font-semibold uppercase">Location</span><span className="font-medium text-gray-800">{formData.address}, {formData.city}</span></div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        {/* Footer Controls */}
                        <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-between">
                            <Button variant="ghost" onClick={handleBack} disabled={loading} className="text-gray-500 hover:text-emerald-600 hover:bg-emerald-50">
                                {currentStep === 1 ? 'Cancel' : 'Back'}
                            </Button>

                            <Button
                                onClick={currentStep < 6 ? handleNext : handleSubmit}
                                disabled={loading}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px] shadow-lg shadow-emerald-200 rounded-xl h-11"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                    <>
                                        {currentStep < 6 ? 'Next Step' : 'Create Account'}
                                        {currentStep < 6 ? <ArrowRight className="w-4 h-4 ml-2" /> : <Sparkles className="w-4 h-4 ml-2" />}
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

// Simple Map Picker Component using MapLibre
function MapPicker({ lat, lng, onLocationSelect }) {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const marker = useRef(null);

    useEffect(() => {
        if (map.current) return;

        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json', // Detailed Street Map
            center: [lng, lat],
            zoom: 12
        });

        marker.current = new maplibregl.Marker({ color: '#10b981' })
            .setLngLat([lng, lat])
            .addTo(map.current);

        map.current.on('click', (e) => {
            const { lng, lat } = e.lngLat;
            marker.current.setLngLat([lng, lat]);
            onLocationSelect(lat, lng);
        });

        // Resize to fix blank map issues
        map.current.on('load', () => {
            map.current.resize();
        });

    }, []);

    // React to prop changes (e.g. from Geolocation)
    useEffect(() => {
        if (!map.current || !marker.current) return;

        map.current.flyTo({
            center: [lng, lat],
            zoom: 14,
            essential: true
        });

        marker.current.setLngLat([lng, lat]);
    }, [lat, lng]);

    return <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />;
}
