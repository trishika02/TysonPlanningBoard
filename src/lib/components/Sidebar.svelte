<script>
    let {
        floors = [],
        lines = [],
        rowHeight = 36,
        onDateChange = () => {},
        onResetDate = () => {},
        dateRange = null // { from_date: 'YYYY-MM-DD', to_date: 'YYYY-MM-DD' }
    } = $props();

    function formatMonth(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }

    let dateValue = $state('');
    let sidebarRows; // Reference to the rows container

    export function setScrollTop(scrollTop) {
        if (sidebarRows) {
            sidebarRows.scrollTop = scrollTop;
        }
    }

    function handleDateGo() {
        if (dateValue) {
            onDateChange(dateValue);
        }
    }

    function handleReset() {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        dateValue = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        onResetDate();
    }
</script>

<div id="sidebar" class="sticky-sidebar flex-shrink-0 bg-white shadow-lg z-20 flex flex-col h-full w-64 border-r border-gray-200">
    <!-- Sidebar Header -->
    <!-- Sidebar Header (3 Rows) -->
    <div class="sidebar-header h-36 border-b border-gray-200 flex flex-col sticky-header bg-white flex-shrink-0 z-30">
        
        <!-- ROW 1 (Top): Date Selector -->
        <div class="h-12 w-full border-b border-gray-200 flex items-center justify-start px-4 bg-white">
            <!-- Left: Date Selector -->
             <div class="flex items-center space-x-2 bg-gray-100 rounded-md px-2 py-1 border border-gray-200 hover:border-blue-300 transition-colors">
                <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                <input 
                    type="date" 
                    id="date-picker" 
                    class="text-xs bg-transparent border-none p-0 text-gray-700 font-medium focus:ring-0 cursor-pointer w-24"
                    bind:value={dateValue}
                    placeholder="Select Date"
                >
                <button 
                    onclick={handleDateGo}
                    class="text-[10px] uppercase font-bold text-blue-600 hover:text-blue-800 px-1"
                >GO</button>
                <span class="text-gray-300">|</span>
                <button 
                    onclick={handleReset}
                    class="text-[10px] uppercase font-bold text-green-600 hover:text-green-800 px-1"
                >TODAY</button>
            </div>
        </div>

        <!-- ROW 2 (Middle): Work Hours Date Range -->
        <div class="h-12 w-full border-b border-gray-200 flex flex-col items-center justify-center bg-gray-50/50 px-2">
            {#if dateRange}
                <span class="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Work Hours Period</span>
                <span class="text-xs font-semibold text-indigo-600 text-center leading-tight">
                    {formatMonth(dateRange.from_date)} — {formatMonth(dateRange.to_date)}
                </span>
            {:else}
                <span class="text-xs font-bold text-gray-300 uppercase tracking-widest">Loading...</span>
            {/if}
        </div>

        <!-- ROW 3 (Bottom): Titles (Floor | Lines) -->
        <div class="h-12 w-full flex">
             <!-- Floor Header -->
            <div class="w-16 border-r border-gray-200 flex flex-col items-center justify-center font-bold text-xs uppercase text-gray-500 bg-gray-50 p-2 text-center h-full">
                Floor
            </div>
            <!-- Line Header -->
            <div class="flex-1 flex flex-col items-center justify-center p-2 bg-white h-full">
                <h2 class="text-sm font-bold text-gray-800 text-center">Lines</h2>
            </div>
        </div>
    </div>

    <!-- Sidebar Body (Line Rows) -->
    <div 
        bind:this={sidebarRows}
        id="sidebar-rows" 
        class="overflow-hidden flex-1 no-scrollbar bg-white"
    >
        {#each floors as floor (floor.id)}
            <div class="flex border-b border-gray-200">
                <!-- Floor Column -->
                <div 
                    class="w-16 border-r border-gray-100 bg-gray-50 flex items-center justify-center font-bold text-xs text-gray-600 relative p-2"
                    style="height: {floor.lines.length * rowHeight}px;"
                >
                    <span class="text-center">{floor.name}</span>
                </div>
                <!-- Lines Column -->
                <div class="flex-1 flex flex-col divide-y divide-gray-100">
                    {#each floor.lines as line (line.id)}
                        <div 
                            class="flex items-center px-4 text-xs font-bold text-gray-700 hover:bg-gray-50"
                            style="height: {rowHeight}px;"
                        >
                            {line.name}
                        </div>
                    {/each}
                </div>
            </div>
        {/each}
    </div>
</div>

<style>
    .no-scrollbar::-webkit-scrollbar {
        display: none;
    }
    .no-scrollbar {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }
</style>
