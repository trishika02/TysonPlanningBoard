<script>
    let {
        visible = $bindable(false),
        task = null,
        onClose = () => {}
    } = $props();

    function close() {
        visible = false;
        onClose();
    }

    function handleKeydown(e) {
        if (e.key === 'Escape') close();
    }

    /** Format an ISO date string to a readable date+time */
    function formatDateTime(isoStr) {
        if (!isoStr) return '—';
        const d = new Date(isoStr);
        if (isNaN(d)) return isoStr;
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}  ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    /** Rows to display in the detail table */
    let rows = $derived(task ? [
        { label: 'Strip ID',            value: task.id ?? '—' },
        { label: 'Order ID',            value: task.orderId ?? '—' },
        { label: 'Style',               value: task.style ?? '—' },
        { label: 'Line',                value: task.lineId ?? '—' },
        { label: 'Quantity',            value: task.quantity?.toLocaleString() ?? '—' },
        { label: 'Completed Quantity',  value: task.completed_quantity?.toLocaleString() ?? '—' },
        { label: 'Start Date',          value: formatDateTime(task.start) },
        { label: 'End Date',            value: formatDateTime(task.end) },
        { label: 'Total Days',          value: task.total_days ?? '—' },
        { label: 'Working Days',        value: task.total_working_days ?? '—' },
        { label: 'Completed Days',      value: task.completed_days ?? '—' },
    ] : []);

    /** Completion % */
    let completionPct = $derived(
        task && task.quantity > 0
            ? Math.round((task.completed_quantity / task.quantity) * 100)
            : 0
    );
</script>

<svelte:window onkeydown={handleKeydown} />

{#if visible && task}
    <!-- Backdrop -->
    <div
        class="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="strip-details-title"
        onclick={(e) => { if (e.target === e.currentTarget) close(); }}
        onkeydown={handleKeydown}
        tabindex="-1"
    >
        <!-- Panel -->
        <div class="relative w-full max-w-lg mx-4 rounded-2xl shadow-2xl overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 animate-in">
            <!-- Header -->
            <div class="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600">
                <div>
                    <h2 id="strip-details-title" class="text-lg font-bold text-white tracking-tight">
                        📋 Strip Details
                    </h2>
                    <p class="text-blue-200 text-xs mt-0.5">{task.orderId ?? task.id}</p>
                </div>
                <button
                    class="w-8 h-8 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-colors"
                    onclick={close}
                    aria-label="Close"
                >
                    ✕
                </button>
            </div>

            <!-- Progress bar -->
            <div class="px-6 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div class="flex items-center justify-between mb-1">
                    <span class="text-xs font-medium text-gray-500 dark:text-gray-400">Completion Progress</span>
                    <span class="text-xs font-bold text-blue-600 dark:text-blue-400">{completionPct}%</span>
                </div>
                <div class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                        class="h-full rounded-full transition-all duration-500"
                        style="width: {completionPct}%; background: linear-gradient(90deg, #3b82f6, #6366f1);"
                    ></div>
                </div>
            </div>

            <!-- Completed segments (if any) -->
            {#if task.completed_segments && task.completed_segments.length > 0}
                <div class="px-6 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Segments</p>
                    <div class="flex gap-2 flex-wrap">
                        {#each task.completed_segments as seg, i}
                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white {seg.color ?? 'bg-blue-500'}">
                                Seg {i + 1}: {seg.qty?.toLocaleString() ?? '—'}
                            </span>
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- Detail Table -->
            <div class="overflow-y-auto max-h-[50vh]">
                <table class="w-full text-sm">
                    <thead class="sticky top-0 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                        <tr>
                            <th class="px-6 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/2">Field</th>
                            <th class="px-6 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/2">Value</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                        {#each rows as row, i}
                            <tr class="{i % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800/60'} hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                                <td class="px-6 py-3 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">{row.label}</td>
                                <td class="px-6 py-3 text-gray-900 dark:text-white font-mono text-xs">{row.value}</td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                <button
                    class="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm"
                    onclick={close}
                >
                    Close
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .animate-in {
        animation: fadeScaleIn 0.18s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    @keyframes fadeScaleIn {
        from { opacity: 0; transform: scale(0.95) translateY(8px); }
        to   { opacity: 1; transform: scale(1) translateY(0); }
    }
</style>
