'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Info, MapPin, Calendar, Sparkles, CheckCircle2 } from 'lucide-react';

export default function SmartInfoBanner({ office, queueStats, userToken }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isHovered, setIsHovered] = useState(false);

    // Prepare slides based on available data
    const slides = [];

    // 1. Office Activity / Queue Info
    if (office) {
        slides.push({
            id: 'status',
            icon: <Clock size={20} className="text-blue-600" />,
            title: office.name,
            content: `Wait Time: ${queueStats.waitTime} • Open Slots: ${queueStats.openSlots}`,
            bg: 'bg-blue-50 border-blue-100',
            text: 'text-blue-900',
            subText: 'text-blue-700'
        });
    }

    // 2. Personal Token Info (High Priority)
    if (userToken) {
        slides.unshift({ // Add to front
            id: 'token',
            icon: <CheckCircle2 size={20} className="text-emerald-600" />,
            title: `Your Token: #${userToken.token_number}`,
            content: userToken.status === 'CALLED' ? 'Proceed to Counter!' : `Est. Arrival: ${new Date(new Date().getTime() + (userToken.eta || 15) * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            bg: 'bg-emerald-50 border-emerald-100',
            text: 'text-emerald-900',
            subText: 'text-emerald-700'
        });
    }

    // 3. Status/Holidays (Example)
    /*
    if (office?.is_paused) {
         slides.push({
            id: 'paused',
            icon: <Coffee size={20} className="text-amber-600" />,
            title: 'Queue Paused',
            content: 'We are taking a short break. Back soon!',
            bg: 'bg-amber-50 border-amber-100',
            text: 'text-amber-900'
        });
    }
    */

    // 4. Tips / General
    slides.push({
        id: 'tips',
        icon: <Sparkles size={20} className="text-purple-600" />,
        title: 'Did you know?',
        content: 'You can track your live status from anywhere.',
        bg: 'bg-purple-50 border-purple-100',
        text: 'text-purple-900',
        subText: 'text-purple-700'
    });

    // 5. Travel Info (Placeholder logic if we had user location distance)
    /*
    slides.push({
        id: 'travel',
        icon: <MapPin ... />
        ...
    })
    */

    useEffect(() => {
        if (slides.length <= 1 || isHovered) return;

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % slides.length);
        }, 4000);

        return () => clearInterval(interval);
    }, [slides.length, isHovered]);

    const currentSlide = slides[currentIndex] || slides[0];

    if (!currentSlide) return null;

    return (
        <div
            className="relative overflow-hidden rounded-2xl"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentSlide.id}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className={`border p-4 flex items-center gap-4 rounded-2xl shadow-sm ${currentSlide.bg}`}
                >
                    <div className={`p-2 rounded-full bg-white/60 shrink-0 shadow-sm backdrop-blur-sm`}>
                        {currentSlide.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className={`font-bold text-sm ${currentSlide.text} truncate`}>{currentSlide.title}</p>
                        <p className={`text-sm ${currentSlide.subText} truncate`}>{currentSlide.content}</p>
                    </div>

                    {/* Progress Indicator (Dots) */}
                    <div className="absolute top-4 right-4 flex gap-1">
                        {slides.map((_, idx) => (
                            <div
                                key={idx}
                                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${idx === currentIndex ? 'bg-current opacity-60 scale-125' : 'bg-current opacity-20'}`}
                            />
                        ))}
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
