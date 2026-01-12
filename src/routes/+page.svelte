        
        <script>
            import Calendar from '$lib/components/Calendar.svelte';
            import Sidebar from '$lib/components/Sidebar.svelte';
            import Tooltip from '$lib/components/Tooltip.svelte';
            import { onMount } from 'svelte';
        
            // === 1. TOP LEVEL STATE ===
            let tasks = $state([]);
            let lines = $state([]);
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
                    start: '2025-11-01T09:00:00',
                    end: '2025-11-01T13:30:00'
                },
                {
                    id: 'task-102',
                    lineId: 'line-2',
                    orderId: 'PO-4568',
                    style: 'Polo (Blue)',
                    quantity: 3000,
                    start: '2025-11-01T14:00:00',
                    end: '2025-11-01T17:00:00'
                },
                {
                    id: 'task-103',
                    lineId: 'line-2',
                    orderId: 'PO-4569',
                    style: 'Jeans (Black)',
                    quantity: 1200,
                    start: '2025-11-03T09:00:00',
                    end: '2025-11-06T17:00:00'
                },
                {
                    id: 'task-104',
                    lineId: 'line-3',
                    orderId: 'PO-4570',
                    style: 'Jacket (Denim)',
                    quantity: 250,
                    start: '2025-11-03T11:30:00',
                    end: '2025-11-03T16:00:00'
                },
                {
                    id: 'task-105',
                    lineId: 'line-4',
                    orderId: 'PO-4571',
                    style: 'Shorts (Cargo)',
                    quantity: 800,
                    start: '2025-11-05T10:00:00',
                    end: '2025-11-05T18:00:00'
                }
            ];
        
            const MOCK_HOLIDAYS = [
                '2025-12-16', 
                '2025-12-25', 
                '2026-01-01', 
            ];
        
            let holidays = [...MOCK_HOLIDAYS];
            let today = $state(new Date(new Date().setHours(0, 0, 0, 0)));
        
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
                 const todayStr = formatDate(today, 'YYYY-MM-DD');
                 // 4 days from today
                 const fourDaysFromToday = new Date(today);
                 fourDaysFromToday.setDate(today.getDate() + 4);
                 const fourDaysFromTodayStr = formatDate(fourDaysFromToday, 'YYYY-MM-DD');
                 const sevenDaysFromToday = new Date(today);
                 sevenDaysFromToday.setDate(today.getDate() + 7);
                 const sevenDaysFromTodayStr = formatDate(sevenDaysFromToday, 'YYYY-MM-DD');
                 
                 // Mutate state
                 const task101 = tasks.find(t => t.id === 'task-101');
                 if (task101) {
                     task101.start = `${todayStr}T09:00:00`;
                     task101.end = `${fourDaysFromTodayStr}T13:30:00`;
                 }
                 const task102 = tasks.find(t => t.id === 'task-102');
                 if (task102) {
                     task102.start = `${fourDaysFromTodayStr}T14:00:00`;
                     task102.end = `${sevenDaysFromTodayStr}T17:00:00`;
                 }
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
                setTimeout(() => {
                    alignMockDataToToday();
                }, 500);
        
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

    <!-- Loading Modal -->
    <div id="loading-modal" class="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50" style="display: none;">
        <div class="bg-white p-6 rounded-lg shadow-xl">
            <div class="text-lg font-semibold">Loading Planner...</div>
        </div>
    </div>

    <!-- Task Tooltip -->
    <Tooltip />
