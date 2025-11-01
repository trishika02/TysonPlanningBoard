export const CONFIG = {
    NUM_DAYS_DEFAULT: 60,
    DAY_COLUMN_WIDTH: 200,
    ROW_HEIGHT: 100,
    START_HOUR: 8,
    END_HOUR: 18,
};

export const WORK_HOURS = {
    SUNDAY: 0,
    MONDAY: 10,
    TUESDAY: 10,
    WEDNESDAY: 10,
    THURSDAY: 10,
    FRIDAY: 8,
    SATURDAY: 0,
};

export function getWorkHoursPerDay(dayOfWeek) {
    const hours = [
        WORK_HOURS.SUNDAY,
        WORK_HOURS.MONDAY,
        WORK_HOURS.TUESDAY,
        WORK_HOURS.WEDNESDAY,
        WORK_HOURS.THURSDAY,
        WORK_HOURS.FRIDAY,
        WORK_HOURS.SATURDAY,
    ];
    return hours[dayOfWeek] || 0;
}