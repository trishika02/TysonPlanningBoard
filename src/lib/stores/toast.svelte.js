let toasts = $state([]);
let _id = 0;

function add(type, message, duration = 4000) {
    const id = ++_id;
    toasts.push({ id, type, message });
    if (duration > 0) setTimeout(() => dismiss(id), duration);
    return id;
}

export function dismiss(id) {
    const i = toasts.findIndex((t) => t.id === id);
    if (i !== -1) toasts.splice(i, 1);
}

export { toasts };

export const toast = {
    success: (message, duration) => add('success', message, duration),
    error:   (message, duration) => add('error',   message, duration),
    info:    (message, duration) => add('info',    message, duration),
    warning: (message, duration) => add('warning', message, duration),
};
