import { writable, derived } from 'svelte/store';
import { generateCalendarDays } from '../utils/dateUtils.js';
import { CONFIG } from '../utils/constants.js';

function createPlanningStore() {
    const { subscribe, set, update } = writable({
        lines: [],
        tasks: [],
        holidays: [],
        today: new Date(),
        numDaysToShow: CONFIG.NUM_DAYS_DEFAULT,
        isLoading: true,
    });

    return {
        subscribe,
        setData: (lines, tasks, holidays) => {
            update(state => ({
                ...state,
                lines,
                tasks,
                holidays,
                isLoading: false,
            }));
        },
        updateTask: (taskId, updates) => {
            update(state => ({
                ...state,
                // Create a NEW array with the updated task (immutable update)
                tasks: state.tasks.map(t => 
                    t.id === taskId ? { ...t, ...updates } : t
                )
            }));
        },
        setToday: (date) => {
            update(state => ({ ...state, today: date }));
        },
        loadMoreDays: () => {
            update(state => ({ ...state, numDaysToShow: state.numDaysToShow + 30 }));
        },
        setLoading: (isLoading) => {
            update(state => ({ ...state, isLoading }));
        }
    };
}

export const planningStore = createPlanningStore();

export const calendarDays = derived(
    planningStore,
    $store => generateCalendarDays($store.today, $store.numDaysToShow, $store.holidays)
);