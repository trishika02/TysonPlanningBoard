// src/lib/stores/tooltip.js
import { writable } from 'svelte/store';

/**
 * Stores the state of the global tooltip.
 * @type {import('svelte/store').Writable<{visible: boolean, content: string, x: number, y: number}>}
 */
export const tooltipState = writable({
    visible: false,
    content: '',
    x: 0,
    y: 0
});

// You would then create a Tooltip.svelte component to read this store
