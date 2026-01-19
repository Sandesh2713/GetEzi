import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, Check, MapPin, Building2, Clock, User, Zap, Mail, Lock, Phone, LocateFixed, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import maplibregl from 'maplibre-gl';

const LabeledInput = ({ label, ...props }) => (
    <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-gray-700">{label}</label>
        <Input {...props} />
    </div>
);
import 'maplibre-gl/dist/maplibre-gl.css';

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
                // Simple string comparison for time (HH:MM) works for validation
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
                    avgServiceMinutes: 15, // Default
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

    return (
        <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col overflow-hidden">
            {/* Header / Progress */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
                <div onClick={onBack} className="flex items-center gap-2 cursor-pointer text-emerald-700 font-bold text-xl">
                    <span>GetEzi</span>
                    <span className="text-sm font-normal text-gray-500 hidden md:inline">| Owner Setup</span>
                </div>

                {/* Desktop Steps */}
                <div className="hidden md:flex items-center gap-1">
                    {steps.map((s, idx) => (
                        <div key={s.id} className="flex items-center">
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${currentStep === s.id ? 'bg-emerald-100 text-emerald-700' :
                                currentStep > s.id ? 'text-emerald-600' : 'text-gray-400'
                                }`}>
                                <s.icon className="w-4 h-4" />
                                <span>{s.title}</span>
                            </div>
                            {idx < steps.length - 1 && <div className={`w-6 h-0.5 ${currentStep > idx + 1 ? 'bg-emerald-200' : 'bg-gray-100'}`} />}
                        </div>
                    ))}
                </div>

                {/* Mobile Step Indicator */}
                <div className="md:hidden text-sm font-medium text-emerald-600">
                    Step {currentStep} of 6
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center">
                <div className="w-full max-w-2xl">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStep}
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -20, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8"
                        >
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">{steps[currentStep - 1].title}</h2>
                            <p className="text-gray-500 mb-6 text-sm">Please fill in the details below to proceed.</p>

                            {error && (
                                <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-center gap-2">
                                    <span className="font-bold">Error:</span> {error}
                                </div>
                            )}

                            {/* Render Steps */}
                            {currentStep === 1 && (
                                <div className="space-y-4">
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <LabeledInput label="Full Name" value={formData.name} onChange={e => updateField('name', e.target.value)} placeholder="John Doe" />
                                        <LabeledInput label="Phone Number" value={formData.phone} onChange={e => updateField('phone', e.target.value)} placeholder="+91 98765 43210" />
                                    </div>
                                    <LabeledInput label="Email Address" type="email" value={formData.email} onChange={e => updateField('email', e.target.value)} placeholder="owner@business.com" />
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <LabeledInput label="Password" type="password" value={formData.password} onChange={e => updateField('password', e.target.value)} placeholder="Strong password" />
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
                                    <div className="h-64 bg-gray-100 rounded-xl overflow-hidden relative border border-gray-300">
                                        <MapPicker lat={formData.lat} lng={formData.lng} onLocationSelect={(lat, lng) => {
                                            updateField('lat', lat);
                                            updateField('lng', lng);
                                        }} />

                                        {/* Floating Locate Button inside Map */}
                                        <button
                                            onClick={() => {
                                                if (!navigator.geolocation) {
                                                    setError("Geolocation is not supported by your browser");
                                                    return;
                                                }
                                                setLoading(true);
                                                setError(''); // Clear previous errors

                                                const options = {
                                                    enableHighAccuracy: true,
                                                    timeout: 10000,
                                                    maximumAge: 0
                                                };

                                                navigator.geolocation.getCurrentPosition((pos) => {
                                                    updateField('lat', pos.coords.latitude);
                                                    updateField('lng', pos.coords.longitude);
                                                    setLoading(false);
                                                }, (err) => {
                                                    let msg = "Location error: ";
                                                    switch (err.code) {
                                                        case err.PERMISSION_DENIED:
                                                            msg += "User denied the request for Geolocation.";
                                                            break;
                                                        case err.POSITION_UNAVAILABLE:
                                                            msg += "Location information is unavailable. Check your network connection.";
                                                            break;
                                                        case err.TIMEOUT:
                                                            msg += "The request to get user location timed out.";
                                                            break;
                                                        default:
                                                            msg += err.message;
                                                    }
                                                    setError(msg);
                                                    setLoading(false);
                                                }, options);
                                            }}
                                            className="absolute bottom-4 right-4 bg-white p-2 rounded-full shadow-md border border-gray-200 hover:bg-gray-50 text-emerald-600 transition-all z-10"
                                            title="Use my current location"
                                        >
                                            <LocateFixed className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <div className="text-xs text-gray-500 text-center">Click on the map to pin your exact location</div>
                                </div>
                            )}

                            {currentStep === 4 && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        <LabeledInput label="Opens At" type="time" value={formData.openingTime} onChange={e => updateField('openingTime', e.target.value)} />
                                        <LabeledInput label="Closes At" type="time" value={formData.closingTime} onChange={e => updateField('closingTime', e.target.value)} />
                                    </div>
                                    <div className="border-t border-gray-100 pt-4">
                                        <h4 className="text-sm font-medium text-gray-700 mb-4">Lunch Break (Optional)</h4>
                                        <div className="grid grid-cols-2 gap-6">
                                            <LabeledInput label="Start Time" type="time" value={formData.lunchStart} onChange={e => updateField('lunchStart', e.target.value)} />
                                            <LabeledInput label="End Time" type="time" value={formData.lunchEnd} onChange={e => updateField('lunchEnd', e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {currentStep === 5 && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                                        <div>
                                            <div className="font-semibold text-gray-900">Auto No-Show Detection</div>
                                            <div className="text-sm text-gray-500">Automatically mark tokens as 'No Show' if not present</div>
                                        </div>
                                        <input type="checkbox" checked={formData.autoNoShow} onChange={e => updateField('autoNoShow', e.target.checked)} className="w-5 h-5 accent-emerald-600" />
                                    </div>
                                    {formData.autoNoShow && (
                                        <LabeledInput label="Grace Period (Minutes)" type="number" value={formData.graceMinutes} onChange={e => updateField('graceMinutes', e.target.value)} />
                                    )}
                                </div>
                            )}

                            {currentStep === 6 && (
                                <div className="space-y-6">
                                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                        <h3 className="font-bold text-emerald-800 mb-2">Account Summary</h3>
                                        <div className="text-sm text-emerald-700 grid grid-cols-2 gap-2">
                                            <div>Name: {formData.name}</div>
                                            <div>Role: Owner</div>
                                            <div className="col-span-2">Email: {formData.email}</div>
                                        </div>
                                    </div>
                                    <div className="border border-gray-200 rounded-xl divide-y">
                                        <div className="p-3 bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500">Office Profile</div>
                                        <div className="p-4 grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="block text-gray-500 text-xs">Name</span>
                                                <span className="font-medium">{formData.officeName}</span>
                                            </div>
                                            <div>
                                                <span className="block text-gray-500 text-xs">Type</span>
                                                <span className="font-medium">{formData.serviceType}</span>
                                            </div>
                                            <div className="col-span-2">
                                                <span className="block text-gray-500 text-xs">Address</span>
                                                <span className="font-medium">{formData.address}, {formData.city}</span>
                                            </div>
                                            <div>
                                                <span className="block text-gray-500 text-xs">Hours</span>
                                                <span className="font-medium">{formData.openingTime} - {formData.closingTime}</span>
                                            </div>
                                            <div>
                                                <span className="block text-gray-500 text-xs">Config</span>
                                                <span className="font-medium">{formData.counterCount} Counters</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Footer Controls */}
                    <div className="mt-8 flex items-center justify-between">
                        <Button variant="ghost" onClick={handleBack} disabled={loading} className="text-gray-600 hover:text-gray-900 border border-gray-200">
                            {currentStep === 1 ? 'Cancel' : 'Back'}
                        </Button>

                        <div className="flex gap-2">
                            {currentStep < 6 ? (
                                <Button onClick={handleNext} className="min-w-[120px] text-white" style={{ backgroundColor: '#059669' }}>
                                    Next <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            ) : (
                                <Button onClick={handleSubmit} disabled={loading} className="min-w-[140px] text-white" style={{ backgroundColor: '#059669' }}>
                                    {loading ? 'Creating...' : 'Create Office'}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
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
            style: 'https://demotiles.maplibre.org/style.json', // Open/Demo style
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
