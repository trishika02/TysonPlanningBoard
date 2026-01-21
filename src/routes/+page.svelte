        
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
            let showUnplanned2 = $state(false); // State for toggling second unplanned panel
            let sidebar; // Sidebar instance binding
            let calendar; // Calendar instance binding
            
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
                    start: '2025-12-04T09:00:00',
                    end: '2025-12-11T13:30:00',
                    total_days: 8,
                    total_working_days: 6,
                    completed_days: 3,
                    completed_quantity: 4000,
                    completed_segments: [
                        { qty: 2500, color: 'bg-green-500' },
                        { qty: 1500, color: 'bg-yellow-400' }
                    ]
                },
                {
                    id: 'task-102',
                    lineId: 'line-2',
                    orderId: 'PO-4568',
                    style: 'Polo (Blue)',
                    quantity: 3000,
                    start: '2026-01-15T14:00:00',
                    end: '2026-01-30T17:00:00',
                    total_days: 16,
                    total_working_days: 12,
                    completed_days: 5,
                    completed_quantity: 1500,
                    completed_segments: [
                        { qty: 1000, color: 'bg-green-500' },
                        { qty: 500, color: 'bg-blue-400' }
                    ]
                }
            ];
            let unplannedTasks = $state([
                {
                    id: 'task-103',
                    lineId: '',
                    orderId: 'PO-4569',
                    style: 'T-Shirt (Blue)',
                    quantity: 2000,
                    start: '2026-02-20T01:00:00',
                    end: '2026-02-25T05:00:00',
                    total_days: 5,
                    total_working_days: 4,
                    completed_days: 0,
                    completed_quantity: 0,
                    completed_segments: []
                },
                {
                    id: 'task-104',
                    lineId: '',
                    orderId: 'PO-4570',
                    style: 'Polo (Green)',
                    quantity: 2000,
                    start: '2026-01-20T14:00:00',
                    end: '2026-01-30T17:00:00',
                    total_days: 11,
                    total_working_days: 8,
                    completed_days: 0,
                    completed_quantity: 0,
                    completed_segments: []
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

            // === TIMEZONE HELPER for GMT+6 (Bangladesh) ===
            function getLocalDate() {
                // Get current time in GMT+6 (Bangladesh timezone)
                const now = new Date();
                // Create a date using local year, month, day to avoid timezone issues
                const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
                return localDate;
            }
        
            // === 5. EVENT HANDLERS ===
            
            function handleDateChange(newDateStr) {
                // Ensure modal exists before trying to show it
                const modal = document.getElementById('loading-modal');
                if (modal) modal.style.display = 'flex';
                
                requestAnimationFrame(() => {
                    // Parse the date string as local date (YYYY-MM-DD format)
                    const [year, month, day] = newDateStr.split('-').map(Number);
                    const newDate = new Date(year, month - 1, day, 0, 0, 0, 0);
                    today = newDate; // Update state
                    
                    setTimeout(() => {
                        if (modal) modal.style.display = 'none';
                    }, 50); // Simulate load time or wait for render
                });
            }
        
            function handleResetDate() {
                const modal = document.getElementById('loading-modal');
                if (modal) modal.style.display = 'flex';
                
                requestAnimationFrame(() => {
                    // Use local date helper to get correct Bangladesh date
                    today = getLocalDate();
                    
                    // Reset calendar to minimal view (today + 3 days)
                    if (calendar) calendar.resetToToday();
                    
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

            let draggedUnplannedTask = $state(null);

            function handleUnplannedDragStart(e, task) {
                draggedUnplannedTask = task;
                // Set necessary data for drag
                e.dataTransfer.effectAllowed = 'copy';
                // We might need some data but mostly relying on state prop
                e.dataTransfer.setData('application/json', JSON.stringify(task)); 
            }

            function handleUnplannedDragEnd(e) {
                draggedUnplannedTask = null;
            }

            function handleUnplannedDrop(taskId) {
                // Remove from unplanned list
                unplannedTasks = unplannedTasks.filter(t => t.id !== taskId);
                showUnplanned = false; // Optional: close panel? Maybe keep it open if they want to drag more.
                // Keeping it open might be better UX for multiple moves.
            }

            function addToBoard(task, targetLineId = null) {
                // Remove from unplanned
                unplannedTasks = unplannedTasks.filter(t => t.id !== task.id);
                
                // Set the lineId dynamically (from drag-drop or default to first line)
                if (targetLineId) {
                    task.lineId = targetLineId;
                } else if (!task.lineId || task.lineId === '') {
                    // Default to first available line if no target specified
                    task.lineId = lines.length > 0 ? lines[0].id : 'line-1';
                }
                
                // Keep existing start/end dates (they are already defined in unplanned tasks)
                // No need to modify them
                
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
            bind:this={calendar}
            bind:tasks 
            {lines} 
            {today} 
            {holidays}
            {draggedUnplannedTask}
            onUnplannedDrop={handleUnplannedDrop}
            onScroll={(scrollTop) => {
                if (sidebar) sidebar.setScrollTop(scrollTop);
            }} 
        />
    </div>

    <!-- Floating Button at Bottom Center (offset for sidebar) -->
    <!-- Floating Buttons at Bottom Center (offset for sidebar) -->
    <div class="fixed bottom-12 z-50 flex gap-4" style="left: calc(50% + 8rem); transform: translateX(-50%);">
        <button 
            class="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg hover:bg-blue-700 transition-all font-medium"
            onclick={() => showUnplanned = !showUnplanned}
        >
            Unplanned Orders
        </button>

        <button 
            class="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-full shadow-lg hover:bg-indigo-700 transition-all font-medium"
            onclick={() => showUnplanned2 = !showUnplanned2}
        >
            Unplanned Orders
        </button>
    </div>

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
                                <th class="px-4 py-2 w-10"></th> <!-- Drag Handle Column -->
                                <th class="px-4 py-2">Order</th>
                                <th class="px-4 py-2">Style</th>
                                <th class="px-4 py-2 text-right">Qty</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each unplannedTasks as task}
                                <tr class="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 group">
                                    <td class="px-4 py-2 text-center">
                                        <button 
                                            class="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 cursor-move"
                                            title="Drag to Board"
                                            draggable="true"
                                            ondragstart={(e) => handleUnplannedDragStart(e, task)}
                                            ondragend={handleUnplannedDragEnd}
                                        >
                                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                                            </svg>
                                        </button>
                                    </td>
                                    <td class="px-4 py-2 font-medium text-gray-900 dark:text-white select-none">{task.orderId}</td>
                                    <td class="px-4 py-2 text-gray-600 dark:text-gray-300 select-none">{task.style}</td>
                                    <td class="px-4 py-2 text-right font-mono select-none">{task.quantity}</td>
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

    <!-- Floating Panel 2 (above the button, offset for sidebar) -->
    {#if showUnplanned2}
        <div class="fixed bottom-28 z-50 mx-4" style="left: calc(50% + 8rem); transform: translateX(-50%);" transition:slide>
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-[600px] max-w-[90vw] border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[60vh]">
                <!-- Header -->
                <div class="bg-indigo-100 dark:bg-indigo-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h3 class="font-bold text-gray-800 dark:text-gray-100">Unplanned Strip 2</h3>
                    <button 
                        class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        onclick={() => showUnplanned2 = false}
                    >
                        ✕
                    </button>
                </div>
                
                <!-- Table Content -->
                <div class="overflow-y-auto p-0">
                    <table class="w-full text-sm text-left">
                        <thead class="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400 sticky top-0">
                            <tr>
                                <th class="px-4 py-2 w-10"></th> <!-- Drag Handle Column -->
                                <th class="px-4 py-2">Order</th>
                                <th class="px-4 py-2">Style</th>
                                <th class="px-4 py-2 text-right">Qty</th>
                            </tr>
                        </thead>
                        <tbody>
                            <!-- Placeholder Rows -->
                            {#each Array(5) as _, i}
                                <tr class="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                    <td class="px-4 py-2 text-center text-gray-400">-</td>
                                    <td class="px-4 py-2 text-gray-400 italic">Order #{i + 1}</td>
                                    <td class="px-4 py-2 text-gray-400 italic">Style #{i + 1}</td>
                                    <td class="px-4 py-2 text-right text-gray-400">0</td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
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
