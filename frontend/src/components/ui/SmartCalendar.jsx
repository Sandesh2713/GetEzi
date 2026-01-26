import { useState, useEffect } from 'react';
import {
    format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isBefore, startOfDay
} from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

export function SmartCalendar({ officeId, onSelect, selectedDate }) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [calendarData, setCalendarData] = useState([]);
    const [loading, setLoading] = useState(false);

    // Fetch Data
    useEffect(() => {
        if (!officeId) return;
        const fetchCalendar = async () => {
            setLoading(true);
            try {
                const query = format(currentMonth, 'yyyy-MM');
                const token = sessionStorage.getItem('token');
                const res = await fetch(`http://localhost:4000/api/offices/${officeId}/calendar?month=${query}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.calendar) setCalendarData(data.calendar);
            } catch (err) {
                console.error("Calendar fetch error", err);
            } finally {
                setLoading(false);
            }
        };
        fetchCalendar();
    }, [officeId, currentMonth]);

    const getDayStatus = (date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return calendarData.find(d => d.date === dateStr)?.status || 'UNKNOWN';
    };

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

    // Generate Grid
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 w-full max-w-[350px] mx-auto select-none">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-800">
                    {format(currentMonth, 'MMMM yyyy')}
                </h2>
                <div className="flex gap-2">
                    <button onClick={prevMonth} disabled={isBefore(currentMonth, startOfMonth(new Date()))} className="p-1 hover:bg-slate-100 rounded-lg disabled:opacity-30">
                        <ChevronLeft size={20} />
                    </button>
                    <button onClick={nextMonth} className="p-1 hover:bg-slate-100 rounded-lg">
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 mb-2">
                {weekDays.map(day => (
                    <div key={day} className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-1">
                        {day}
                    </div>
                ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const isSelected = selectedDate === dateStr;
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isPast = isBefore(day, startOfDay(new Date()));
                    const status = getDayStatus(day);

                    let isDisabled = isPast || ['FULL', 'HOLIDAY', 'CLOSED_SUNDAY', 'CLOSED_WEEKDAY'].includes(status);

                    // Styling logic
                    let baseClass = "h-10 rounded-lg flex flex-col items-center justify-center relative transition-colors text-sm font-medium cursor-pointer";
                    let colorClass = "text-slate-700 hover:bg-slate-50";
                    let dotColor = null;

                    if (!isCurrentMonth) {
                        colorClass = "text-slate-300";
                        isDisabled = true;
                    } else if (isDisabled) {
                        baseClass += " opacity-60 cursor-not-allowed";
                        // Make closed days visibly distinct (grey/redish)
                        if (['CLOSED_SUNDAY', 'CLOSED_WEEKDAY', 'CLOSED'].includes(status)) {
                            colorClass = "text-slate-400 bg-slate-100 border border-slate-200";
                        } else if (status === 'FULL') {
                            colorClass = "text-red-500 bg-red-50 border border-red-100 font-bold";
                        } else if (status === 'HOLIDAY') {
                            colorClass = "text-indigo-600 bg-indigo-50 border border-indigo-100 font-medium";
                        }
                    } else if (isSelected) {
                        colorClass = "bg-blue-600 text-white shadow-md transform scale-105 z-10";
                    } else {
                        // Status Colors for available days
                        if (status === 'AVAILABLE') {
                            colorClass = "text-emerald-700 hover:bg-emerald-50 bg-emerald-50/30";
                            dotColor = "bg-emerald-500";
                        }
                        if (status === 'BUSY') {
                            colorClass = "text-amber-700 hover:bg-amber-50 bg-amber-50/30";
                            dotColor = "bg-amber-500";
                        }
                    }

                    return (
                        <div
                            key={dateStr}
                            onClick={() => !isDisabled && onSelect(dateStr)}
                            className={`${baseClass} ${colorClass}`}
                            title={status === 'HOLIDAY' ? 'Holiday' : status}
                        >
                            <span>{format(day, 'd')}</span>
                            {/* Dot Indicator */}
                            {dotColor && !isSelected && (
                                <span className={`w-1 h-1 rounded-full absolute bottom-1 ${dotColor}`} />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Footer Legend */}
            <div className="flex items-center justify-between mt-4 px-1 py-3 border-t border-slate-100 flex-wrap gap-2">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> <span className="text-[10px] text-slate-500 font-medium">Available</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> <span className="text-[10px] text-slate-500 font-medium">Busy</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-400" /> <span className="text-[10px] text-slate-500 font-medium">Holiday</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" /> <span className="text-[10px] text-slate-500 font-medium">Full</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-300" /> <span className="text-[10px] text-slate-500 font-medium">Closed</span></div>
            </div>



            {loading && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center rounded-2xl">
                    <Loader2 className="animate-spin text-blue-600" />
                </div>
            )}
        </div>
    );
}
