const OfficeStatusEngine = {
    /**
     * Calculate the current status of an office.
     * @param {Object} office - The office object with timing fields.
     * @param {Date} [nowDate] - Optional date object for 'now'. Defaults to new Date().
     * @returns {Object} result - { status: 'OPEN' | 'CLOSED' | 'LUNCH_BREAK', message: string, nextChange: string | null }
     */
    getStatus: (office, nowDate = new Date()) => {
        // 1. Basic Checks
        if (!office.opening_time || !office.closing_time) {
            return { status: 'OPEN', message: 'No timings configured', nextChange: null };
        }

        // 2. Parse Times (Local Time logic - assumes server time aligns or handling simple HH:MM comparisons)
        // Ideally, we should handle timezones. For this project, we assume Office & Server are in same timezone or just use string comparison for HH:MM if simple.
        // However, string comparison '09:00' < '17:00' works.

        // We need 'now' in HH:MM format
        const getHHMM = (date) => {
            const h = date.getHours().toString().padStart(2, '0');
            const m = date.getMinutes().toString().padStart(2, '0');
            return `${h}:${m}`;
        };

        const currentHHMM = getHHMM(nowDate);
        const { opening_time, closing_time, lunch_start, lunch_end } = office;

        // 3. Check OPEN/CLOSED
        if (currentHHMM < opening_time || currentHHMM >= closing_time) {
            return {
                status: 'CLOSED',
                message: `Office is closed. Opens at ${opening_time}`,
                nextChange: opening_time
            };
        }

        // 4. Check LUNCH
        if (lunch_start && lunch_end) {
            if (currentHHMM >= lunch_start && currentHHMM < lunch_end) {
                return {
                    status: 'LUNCH_BREAK',
                    message: `Office on lunch break. Resumes at ${lunch_end}`,
                    nextChange: lunch_end
                };
            }
        }

        // 5. Default OPEN
        // Find next event (Lunch start or Closing)
        let nextEvent = closing_time;
        if (lunch_start && currentHHMM < lunch_start) {
            nextEvent = lunch_start;
        }

        return {
            status: 'OPEN',
            message: 'Office is open',
            nextChange: nextEvent
        };
    },

    /**
     * Check if a specific time (ETA) falls within lunch break and needs shifting.
     * @param {Date} estimatedTime 
     * @param {Object} office 
     * @returns {Date} adjustedTime
     */
    adjustForLunch: (estimatedTime, office) => {
        if (!office.lunch_start || !office.lunch_end) return estimatedTime;

        const getHHMM = (date) => {
            const h = date.getHours().toString().padStart(2, '0');
            const m = date.getMinutes().toString().padStart(2, '0');
            return `${h}:${m}`;
        };

        const etaHHMM = getHHMM(estimatedTime);

        // If ETA is inside lunch window, shift to end of lunch
        if (etaHHMM >= office.lunch_start && etaHHMM < office.lunch_end) {
            const [lunchEndH, lunchEndM] = office.lunch_end.split(':').map(Number);
            const adjusted = new Date(estimatedTime);
            adjusted.setHours(lunchEndH, lunchEndM, 0, 0);
            return adjusted;
        }

        return estimatedTime;
    }
};

module.exports = OfficeStatusEngine;
