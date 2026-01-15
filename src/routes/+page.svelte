        
        <script>
            import Calendar from '$lib/components/Calendar.svelte';
            import Sidebar from '$lib/components/Sidebar.svelte';
            import Tooltip from '$lib/components/Tooltip.svelte';
            import { onMount } from 'svelte';
    import { slide } from 'svelte/transition';
        
            // === 1. TOP LEVEL STATE ===
            let tasks = $state([]);
            let lines = $state([]);
            let showUnplanned = $state(false); // State for toggling unplanned panel
            let sidebar; // Sidebar instance binding
            
            // === 2. MOCK DATA & CONSTANTS ===
            const MOCK_FLOORS_LINES = [
                {
                    "id":"floor_1",
                    "name":"Floor 1",
                    "lines": [
                            { id: 'line-1', name: 'Line 01' },
                            { id: 'line-2', name: 'Line 02' },
                            { id: 'line-3', name: 'Line 03' },
                            { id: 'line-4', name: 'Line 04 (Sewing)' },
                            { id: 'line-5', name: 'Line 05' },
                            { id: 'line-6', name: 'Line 06 (Sewing)' },
                            { id: 'line-7', name: 'Line 07 (Finishing)' },
                            { id: 'line-8', name: 'Line 08' },
                            { id: 'line-9', name: 'Line 09' },
                            { id: 'line-10', name: 'Line 10' },
                        ]
                },
                {
                    "id":"floor_2",
                    "name":"Floor 2",
                    "lines": [
                        { id: 'line-11', name: 'Line 11' },
                        { id: 'line-12', name: 'Line 12' },
                        { id: 'line-13', name: 'Line 13' },
                        { id: 'line-14', name: 'Line 14' },
                        { id: 'line-15', name: 'Line 15' },
                        { id: 'line-16', name: 'Line 16' },
                        { id: 'line-17', name: 'Line 17' },
                        { id: 'line-18', name: 'Line 18' },
                        { id: 'line-19', name: 'Line 19' },
                        { id: 'line-20', name: 'Line 20' },
                    ]
                }
            ];
        
            const MOCK_TASKS = [
                {
                    id: 'task-101',
                    lineId: 'line-1',
                    orderId: 'PO-4567',
                    style: 'T-Shirt (Red)',
                    quantity: 5000,
                    start: '2026-01-04T09:00:00',
                    end: '2026-01-11T13:30:00',
                    total_days: 8,
                    total_working_days: 6,
                    completed_days: 3,
                    completed_quantity: 1500,
                },
                {
                    id: 'task-102',
                    lineId: 'line-2',
                    orderId: 'PO-4568',
                    style: 'Polo (Blue)',
                    quantity: 3000,
                    start: '2026-01-15T14:00:00',
                    end: '2026-01-30T17:00:00',
                    total_days:16,
                    total_working_days:12,
                    completed_days:5,
                    completed_quantity:1500,
                }
            ];
            let unplannedTasks = $state([
                {
                    id: 'task-103',
                    lineId: 'line-3',
                    orderId: 'PO-4569',
                    style: 'T-Shirt (Blue)',
                    quantity: 2000,
                    start: ' ',
                    end: ' ',
                    total_days: 0,
                    total_working_days: 0,
                    completed_days: 0,
                    completed_quantity: 0,
                },
                {
                    id: 'task-104',
                    lineId: 'line-4',
                    orderId: 'PO-4570',
                    style: 'Polo (Green)',
                    quantity: 2000,
                    start: ' ',
                    end: ' ',
                    total_days: 0,
                    total_working_days: 0,
                    completed_days: 0,
                    completed_quantity: 0,
                },
            ]);
        
            const MOCK_HOLIDAYS = [
                '2025-12-16', 
                '2025-12-25', 
                '2026-01-01', 
            ];
        
            let holidays = [...MOCK_HOLIDAYS];
            // Start view from Jan 1, 2026 to see the tasks
            let today = $state(new Date('2026-01-01T00:00:00'));
        
    const ROW_HEIGHT = 36;
        
            // === 5. EVENT HANDLERS ===
            
            function handleDateChange(newDateStr) {
                // Ensure modal exists before trying to show it
                const modal = document.getElementById('loading-modal');
                if (modal) modal.style.display = 'flex';
                
                requestAnimationFrame(() => {
                    const newDate = new Date(newDateStr + 'T00:00:00'); // Use local time
                    let t = newDate;
                    t.setHours(0, 0, 0, 0);
                    today = t; // Update state
                    
                    setTimeout(() => {
                        if (modal) modal.style.display = 'none';
                    }, 50); // Simulate load time or wait for render
                });
            }
        
            function handleResetDate() {
                const modal = document.getElementById('loading-modal');
                if (modal) modal.style.display = 'flex';
                
                requestAnimationFrame(() => {
                    const newToday = new Date();
                    newToday.setHours(0, 0, 0, 0);
                    today = newToday;
                    
                    setTimeout(() => {
                        if (modal) modal.style.display = 'none';
                    }, 50);
                });
            }
        
            // Helper for mock data (duplicated simplified version or just inline logic)
            function formatDate(date, format) {
                 // Minimal implementation needed for alignMockDataToToday
                 const year = date.getFullYear();
                 const month = (date.getMonth() + 1).toString().padStart(2, '0');
                 const day = date.getDate().toString().padStart(2, '0');
                 return `${year}-${month}-${day}`;
            }
        
            function alignMockDataToToday() {
                 // DISABLED: Keeping user predefined dates
            }

            function addToBoard(task) {
                // Remove from unplanned
                unplannedTasks = unplannedTasks.filter(t => t.id !== task.id);
                
                // Set start date to current 'today' view date at 09:00
                const startDate = new Date(today);
                startDate.setHours(9, 0, 0, 0);
                task.start = startDate.toISOString().replace('Z', '');
                
                // Add to main tasks
                tasks.push(task);
            }
                
            onMount(() => {
                // Init state: Flatten Floors into a single list of rows for Calendar
                let flatRows = [];
                for (const floor of MOCK_FLOORS_LINES) {
                    // Do NOT add floor header row to flatRows, only lines
                    for (const line of floor.lines) {
                         flatRows.push({
                            id: line.id,
                            name: line.name,
                            type: 'line',
                            parentId: floor.id
                        });
                    }
                }

                lines = flatRows;
                tasks = [...MOCK_TASKS];
        
                // Initial setup
                /*setTimeout(() => {
                    alignMockDataToToday();
                }, 500);*/
        
            });
        </script>

    <div id="app" class="flex h-screen w-full overflow-hidden">
        <!-- === Left Sticky Sidebar (Line Names) === -->
        <Sidebar 
            bind:this={sidebar}
            floors={MOCK_FLOORS_LINES}
            {lines} 
            rowHeight={ROW_HEIGHT} 
            onDateChange={handleDateChange} 
            onResetDate={handleResetDate} 
        />

        <!-- === Main Content (Scrollable Calendar) === -->
        <Calendar 
            bind:tasks 
            {lines} 
            {today} 
            {holidays} 
            onScroll={(scrollTop) => {
                if (sidebar) sidebar.setScrollTop(scrollTop);
            }} 
        />
    </div>

    <!-- Floating Button at Bottom Center (offset for sidebar) -->
    <button 
        class="fixed bottom-12 z-50 flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg hover:bg-blue-700 transition-all font-medium"
        style="left: calc(50% + 8rem); transform: translateX(-50%);"
        onclick={() => showUnplanned = !showUnplanned}
    >
        Unplanned Orders
    </button>

    <!-- Floating Panel (above the button, offset for sidebar) -->
    {#if showUnplanned}
        <div class="fixed bottom-28 z-50 mx-4" style="left: calc(50% + 8rem); transform: translateX(-50%);" transition:slide>
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-[600px] max-w-[90vw] border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[60vh]">
                <!-- Header -->
                <div class="bg-gray-100 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h3 class="font-bold text-gray-800 dark:text-gray-100">Unplanned strip</h3>
                    <button 
                        class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        onclick={() => showUnplanned = false}
                    >
                        ✕
                    </button>
                </div>
                
                <!-- Table Content -->
                <div class="overflow-y-auto p-0">
                    <table class="w-full text-sm text-left">
                        <thead class="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400 sticky top-0">
                            <tr>
                                <th class="px-4 py-2">Order</th>
                                <th class="px-4 py-2">Style</th>
                                <th class="px-4 py-2 text-right">Qty</th>
                                <th class="px-4 py-2 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each unplannedTasks as task}
                                <tr class="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                    <td class="px-4 py-2 font-medium text-gray-900 dark:text-white">{task.orderId}</td>
                                    <td class="px-4 py-2 text-gray-600 dark:text-gray-300">{task.style}</td>
                                    <td class="px-4 py-2 text-right font-mono">{task.quantity}</td>
                                    <td class="px-4 py-2 text-center">
                                        <button 
                                            class="p-1 rounded-full hover:bg-blue-100 text-blue-600 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
                                            title="Add to Board"
                                            onclick={() => addToBoard(task)}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                            </svg>
                                        </button>
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                    {#if unplannedTasks.length === 0}
                        <div class="p-4 text-center text-gray-500">No unplanned tasks</div>
                    {/if}
                </div>
            </div>
        </div>
    {/if}

    <!-- Loading Modal -->
    <div id="loading-modal" class="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50" style="display: none;">
        <div class="bg-white p-6 rounded-lg shadow-xl">
            <div class="text-lg font-semibold">Loading Planner...</div>
        </div>
    </div>

    <!-- Task Tooltip -->
    <Tooltip />
