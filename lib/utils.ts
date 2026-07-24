
import { formatToElSalvadorDate } from '../utils/dates';

export const getLastDueDate = (dayStr: string): string | null => {
    const d = parseInt(dayStr, 10);
    if (isNaN(d) || d < 1 || d > 31) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInThis = new Date(year, month + 1, 0).getDate();
    return formatToElSalvadorDate(new Date(year, month, Math.min(d, daysInThis)));
};

export const getNextDueDate = (dayStr: string): string | null => {
    const d = parseInt(dayStr, 10);
    if (isNaN(d) || d < 1 || d > 31) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const targetDay = Math.min(d, daysInMonth);
    let due = new Date(year, month, targetDay);
    if (due <= now) {
        const nextMonth = month + 1;
        const nextYear = nextMonth === 12 ? year + 1 : year;
        const nextMonthIndex = nextMonth % 12;
        const daysInNext = new Date(nextYear, nextMonthIndex + 1, 0).getDate();
        due = new Date(nextYear, nextMonthIndex, Math.min(d, daysInNext));
    }
    return formatToElSalvadorDate(due);
};

export const getDaysOverdue = (dayStr: string): number => {
    const lastDue = getLastDueDate(dayStr);
    if (!lastDue) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(lastDue + 'T00:00:00');
    if (today <= due) return 0;
    const diffTime = today.getTime() - due.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};
