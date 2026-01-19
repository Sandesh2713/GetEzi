import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, ChevronRight, ChevronLeft, Map as MapIcon, List, Check } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function BookingModal({ isOpen, onClose, onSubmit, office, availableOffices = [], user }) {
    const [step, setStep] = useState('details');
    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
        phone: user?.phone || ''
    });
    const [selectedService, setSelectedService] = useState(null);
    const [selectedLocation, setSelectedLocation] = useState(office?.id);
    const [locationMode, setLocationMode] = useState('map'); // 'map' or 'manual'

    // Map Ref
    const mapContainer = useRef(null);
    const map = useRef(null);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep('details');
            setFormData({
                name: user?.name || '',
                email: user?.email || '',
                phone: user?.phone || ''
            });
            setSelectedLocation(office?.id);
            // Default to first service if available? No, let user select.
        }
    }, [isOpen, user, office]);

    // Initialize Map when step becomes 'location' and mode is 'map'
    useEffect(() => {
        if (isOpen && step === 'location' && locationMode === 'map' && mapContainer.current && !map.current) {
            // Find center - default to first office or generic coords
            const center = availableOffices.length > 0 && availableOffices[0].lat && availableOffices[0].lng
                ? [availableOffices[0].lng, availableOffices[0].lat]
                : [77.5946, 12.9716]; // Default to Bangalore/generic

            map.current = new maplibregl.Map({
                container: mapContainer.current,
                style: 'https://demotiles.maplibre.org/style.json', // Free demo style
                center: center,
                zoom: 11
            });

            // Add markers
            availableOffices.forEach(off => {
                if (off.lat && off.lng) {
                    const marker = new maplibregl.Marker({ color: selectedLocation === off.id ? '#2563eb' : '#6b7280' })
                        .setLngLat([off.lng, off.lat])
                        .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(`<b>${off.name}</b><br>${off.address}`))
                        .addTo(map.current);

                    // Add click listener to element
                    marker.getElement().addEventListener('click', () => {
                        setSelectedLocation(off.id);
                    });
                }
            });
        }

        // Cleanup map on unmount or mode switch
        return () => {
            // We don't verify destroy here to avoid re-initializing issues in fast toggles, 
            // but for production app we might want strict cleanup. 
            // For now, let's clear ref if we unmount.
        };
    }, [isOpen, step, locationMode, availableOffices]);

    // Cleanup map completely when modal closes
    useEffect(() => {
        if (!isOpen && map.current) {
            map.current.remove();
            map.current = null;
        }
    }, [isOpen]);

    const handleNext = () => {
        if (step === 'details') {
            if (!formData.name || !formData.email) return alert('Name and Email are required');
            setStep('service');
        } else if (step === 'service') {
            if (!selectedService) return alert('Please select a service');
            setStep('location');
        } else if (step === 'location') {
            if (!selectedLocation) return alert('Please select a location');
            handleSubmit();
        }
    };

    const handleBack = () => {
        if (step === 'location') setStep('service');
        else if (step === 'service') setStep('details');
    };

    const handleSubmit = () => {
        onSubmit({
            customerName: formData.name,
            customerEmail: formData.email,
            customerContact: formData.phone,
            serviceType: selectedService,
            locationId: selectedLocation,
            note: 'Booked via Modal'
        });
        onClose();
    };

    const services = office?.service_type
        ? office.service_type.split(',').map(s => ({ id: s.trim(), name: s.trim() }))
        : [{ id: 'General', name: 'General Service' }];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Book Appointment</h2>
                        <p className="text-sm text-gray-500">Step {step === 'details' ? '1' : step === 'service' ? '2' : '3'} of 3</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                        <X size={20} />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="h-1 bg-gray-100 w-full shrink-0">
                    <div
                        className="h-full bg-blue-600 transition-all duration-300 ease-out"
                        style={{ width: step === 'details' ? '33%' : step === 'service' ? '66%' : '100%' }}
                    />
                </div>

                {/* Body - Scrollable */}
                <div className="p-8 overflow-y-auto flex-1">
                    <AnimatePresence mode="wait">
                        {step === 'details' && (
                            <motion.div
                                key="details"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-5"
                            >
                                <h3 className="text-lg font-bold text-gray-900">Your Contact Details</h3>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Full Name</label>
                                    <input
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                                        placeholder="Enter your name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Email Address</label>
                                    <input
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                                        placeholder="Enter your email"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Phone (Optional)</label>
                                    <input
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                                        placeholder="+1 234 567 890"
                                    />
                                </div>
                            </motion.div>
                        )}

                        {step === 'service' && (
                            <motion.div
                                key="service"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-4"
                            >
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Select a Service</h3>
                                <div className="grid grid-cols-1 gap-3">
                                    {services.map(s => (
                                        <button
                                            key={s.id}
                                            onClick={() => setSelectedService(s.id)}
                                            className={`p-5 rounded-xl border-2 text-left transition-all flex items-center justify-between ${selectedService === s.id
                                                    ? 'border-blue-600 bg-blue-50'
                                                    : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            <span className="font-bold text-gray-900">{s.name}</span>
                                            {selectedService === s.id && <Check className="text-blue-600" size={20} />}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {step === 'location' && (
                            <motion.div
                                key="location"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="h-full flex flex-col"
                            >
                                <div className="flex items-center justify-between mb-4 shrink-0">
                                    <h3 className="text-lg font-bold text-gray-900">Choose Location</h3>
                                    <div className="flex bg-gray-100 p-1 rounded-lg">
                                        <button
                                            onClick={() => setLocationMode('map')}
                                            className={`p-2 rounded-md flex items-center gap-2 text-xs font-bold transition-all ${locationMode === 'map' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500'
                                                }`}
                                        >
                                            <MapIcon size={14} /> Map
                                        </button>
                                        <button
                                            onClick={() => setLocationMode('manual')}
                                            className={`p-2 rounded-md flex items-center gap-2 text-xs font-bold transition-all ${locationMode === 'manual' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500'
                                                }`}
                                        >
                                            <List size={14} /> List
                                        </button>
                                    </div>
                                </div>

                                {locationMode === 'map' ? (
                                    <div className="relative flex-1 min-h-[300px] bg-gray-100 rounded-xl overflow-hidden border border-gray-200 shadow-inner">
                                        <div ref={mapContainer} className="absolute inset-0" />
                                        {/* Overlay instruction */}
                                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-4 py-2 rounded-full text-xs font-medium shadow-sm z-10">
                                            Select a pin on the map
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 space-y-3 overflow-y-auto max-h-[400px]">
                                        {availableOffices.map(off => (
                                            <button
                                                key={off.id}
                                                onClick={() => setSelectedLocation(off.id)}
                                                className={`w-full p-4 rounded-xl border-2 text-left transition-all group ${selectedLocation === off.id
                                                        ? 'border-blue-600 bg-blue-50'
                                                        : 'border-gray-200 hover:border-blue-200'
                                                    }`}
                                            >
                                                <div className="font-bold text-gray-900 mb-1 flex items-center justify-between">
                                                    {off.name}
                                                    {selectedLocation === off.id && <Check className="text-blue-600" size={16} />}
                                                </div>
                                                <div className="text-sm text-gray-500 flex items-center gap-2">
                                                    <MapPin size={14} /> {off.address}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 flex items-center justify-between bg-gray-50 shrink-0">
                    {step !== 'details' ? (
                        <button onClick={handleBack} className="text-gray-600 font-bold hover:underline flex items-center gap-1">
                            <ChevronLeft size={16} /> Back
                        </button>
                    ) : (
                        <button onClick={onClose} className="text-gray-500 font-medium hover:text-gray-900">Cancel</button>
                    )}

                    <button
                        onClick={handleNext}
                        className="bg-black text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-800 transition-transform active:scale-95 flex items-center gap-2"
                    >
                        {step === 'location' ? 'Confirm Booking' : 'Next Step'}
                        {step !== 'location' && <ChevronRight size={16} />}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
