<script>
    import { fade, scale } from 'svelte/transition';

    let {
        visible = $bindable(false),
        sourceTask = null,
        candidates = [],
        onMerge = () => {},
        onCancel = () => {}
    } = $props();

    let searchQuery = $state('');

    const filteredCandidates = $derived(
        searchQuery.trim() === ''
            ? candidates
            : candidates.filter(t =>
                (t.id ?? '').toLowerCase().includes(searchQuery.trim().toLowerCase())
              )
    );

    function handleMerge(targetTask) {
        onMerge(targetTask);
    }

    $effect(() => {
        if (!visible) searchQuery = '';
    });
</script>

{#if visible}
    <div
        class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
        transition:fade={{ duration: 200 }}
    >
        <div
            class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-gray-700 transform transition-all"
            transition:scale={{ start: 0.95, duration: 200 }}
        >
            <!-- Header -->
            <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                <div>
                    <h3 class="text-lg font-bold text-gray-900 dark:text-white">Merge Task</h3>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Select a task on the right to merge with.</p>
                </div>
                <button
                    onclick={onCancel}
                    aria-label="Close modal"
                    class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>

            <!-- Search Bar -->
            <div class="px-6 pt-4 pb-2">
                <div class="relative">
                    <span class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                        </svg>
                    </span>
                    <input
                        type="text"
                        placeholder="Search by strip ID…"
                        bind:value={searchQuery}
                        class="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    />
                    {#if searchQuery}
                        <span class="absolute inset-y-0 right-3 flex items-center">
                            <button
                                onclick={() => searchQuery = ''}
                                class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                aria-label="Clear search"
                            >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </span>
                    {/if}
                </div>
            </div>

            <!-- Content -->
            <div class="px-6 pb-6 pt-2 max-h-[50vh] overflow-y-auto custom-scrollbar">
                {#if candidates.length === 0}
                    <div class="text-center py-8 text-gray-500 dark:text-gray-400">
                        <p>No compatible tasks found to merge.</p>
                        <p class="text-xs mt-2 opacity-70">(Must match Order ID & Style)</p>
                    </div>
                {:else if filteredCandidates.length === 0}
                    <div class="text-center py-8 text-gray-500 dark:text-gray-400">
                        <p class="text-sm">No strips match <span class="font-mono font-medium">"{searchQuery}"</span></p>
                    </div>
                {:else}
                    <div class="space-y-3">
                        {#each filteredCandidates as task}
                            <button
                                onclick={() => handleMerge(task)}
                                class="w-full group relative flex flex-col items-start gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all text-left"
                            >
                                <div class="flex justify-between items-start w-full">
                                    <div class="flex flex-col gap-1">
                                        <span class="text-[11px] font-mono text-gray-400 dark:text-gray-500 leading-none">{task.id}</span>
                                        <div class="flex items-center gap-2">
                                            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                                {task.lineId}
                                            </span>
                                            <span class="text-sm font-medium text-gray-900 dark:text-white">
                                                {task.orderId}
                                            </span>
                                        </div>
                                    </div>
                                    <span class="text-xs font-mono font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded shrink-0">
                                        Qty: {task.quantity}
                                    </span>
                                </div>

                                <div class="w-full flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-2 mt-1 group-hover:border-blue-100 dark:group-hover:border-blue-900 transition-colors">
                                    <span>{new Date(task.start).toLocaleDateString()}</span>
                                    <span>→</span>
                                    <span>{new Date(task.end).toLocaleDateString()}</span>
                                </div>

                                <!-- Hover Indicator -->
                                <div class="absolute inset-0 border-2 border-transparent group-hover:border-blue-500 rounded-xl pointer-events-none transition-all opacity-0 group-hover:opacity-100"></div>
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                <button
                    onclick={onCancel}
                    class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                >
                    Cancel
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background-color: rgba(156, 163, 175, 0.5);
        border-radius: 20px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background-color: rgba(107, 114, 128, 0.8);
    }
</style>
