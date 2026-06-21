<script>
    import { fly } from 'svelte/transition';
    import { toasts, dismiss } from '$lib/stores/toast.svelte.js';

    const cfg = {
        success: {
            border: 'border-emerald-500',
            icon_bg: 'bg-emerald-50',
            icon_color: 'text-emerald-600',
            title: 'Success',
            icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>`
        },
        error: {
            border: 'border-red-500',
            icon_bg: 'bg-red-50',
            icon_color: 'text-red-600',
            title: 'Error',
            icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>`
        },
        info: {
            border: 'border-blue-500',
            icon_bg: 'bg-blue-50',
            icon_color: 'text-blue-600',
            title: 'Info',
            icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 110 20A10 10 0 0112 2z"/>`
        },
        warning: {
            border: 'border-amber-500',
            icon_bg: 'bg-amber-50',
            icon_color: 'text-amber-600',
            title: 'Warning',
            icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>`
        }
    };
</script>

<div class="fixed bottom-6 right-6 z-[9999] flex flex-col-reverse gap-2.5 pointer-events-none" aria-live="polite">
    {#each toasts as t (t.id)}
        <div
            class="pointer-events-auto flex items-start gap-3 bg-white shadow-2xl rounded-xl border-l-4 px-4 py-3.5 w-[340px] {cfg[t.type].border}"
            transition:fly={{ x: 60, duration: 280, opacity: 0 }}
        >
            <!-- Icon -->
            <div class="shrink-0 w-8 h-8 rounded-full {cfg[t.type].icon_bg} {cfg[t.type].icon_color} flex items-center justify-center mt-0.5">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {@html cfg[t.type].icon}
                </svg>
            </div>

            <!-- Text -->
            <div class="flex-1 min-w-0 pt-0.5">
                <p class="text-sm font-semibold text-gray-900 leading-none mb-1">{cfg[t.type].title}</p>
                <p class="text-sm text-gray-500 leading-snug">{t.message}</p>
            </div>

            <!-- Dismiss -->
            <button
                onclick={() => dismiss(t.id)}
                class="shrink-0 mt-0.5 text-gray-300 hover:text-gray-500 transition-colors"
                aria-label="Dismiss"
            >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        </div>
    {/each}
</div>
