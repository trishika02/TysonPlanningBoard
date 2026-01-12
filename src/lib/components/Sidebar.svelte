<script>
    let { 
        floors = [], 
        lines = [], // Fallback/Unused now but kept for prop safety if needed
        rowHeight = 36,
        onDateChange = () => {},
        onResetDate = () => {}
    } = $props();

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
        dateValue = '';
        onResetDate();
    }
</script>

<div id="sidebar" class="sticky-sidebar flex-shrink-0 bg-white shadow-lg z-20 flex flex-col h-full w-64 border-r border-gray-200">
    <!-- Sidebar Header -->
    <div class="sidebar-header h-24 border-b border-gray-200 flex sticky-header bg-white flex-shrink-0 z-30">
        <!-- Floor Header -->
        <div class="w-16 border-r border-gray-200 flex flex-col items-center justify-center font-bold text-xs uppercase text-gray-500 bg-gray-50 p-2 text-center">
            Floor
        </div>
        <!-- Line Header + Controls -->
        <div class="flex-1 flex flex-col justify-center p-2 bg-white">
            <h2 class="text-sm font-bold text-gray-800 text-center mb-1">Lines</h2>
            <!-- Mini Date Controls -->
             <div class="flex space-x-1 justify-center">
                <input 
                    type="date" 
                    id="date-picker" 
                    class="text-[10px] p-0.5 border rounded w-20"
                    bind:value={dateValue}
                >
                <button 
                    onclick={handleDateGo}
                    class="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded"
                >Go</button>
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
