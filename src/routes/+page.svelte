<script>
    import PlanningBoard from '$lib/components/PlanningBoard.svelte';
    import { formatDate } from '$lib/utils/dateUtils.js';

    // Mock data - in real app, fetch from API
    const MOCK_LINES = [
        { id: 'line-1', name: 'Line 01' },
        { id: 'line-2', name: 'Line 02' },
        { id: 'line-3', name: 'Line 03' },
        { id: 'line-4', name: 'Line 04 (Sewing)' },
        { id: 'line-5', name: 'Line 05' },
        { id: 'line-6', name: 'Line 06 (Finishing)' },
    ];

    // Align mock tasks to today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatDate(today, 'YYYY-MM-DD');

    const MOCK_TASKS = [
        {
            id: 'task-101',
            lineId: 'line-1',
            orderId: 'PO-4567',
            style: 'T-Shirt (Red)',
            quantity: 500,
            start: `${todayStr}T09:00:00`,
            end: `${todayStr}T13:30:00`
        },
        {
            id: 'task-102',
            lineId: 'line-1',
            orderId: 'PO-4568',
            style: 'Polo (Blue)',
            quantity: 300,
            start: `${todayStr}T14:00:00`,
            end: `${todayStr}T17:00:00`
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
</script>

<svelte:head>
    <title>Garments Production Planning Board</title>
    <script src="https://cdn.tailwindcss.com"></script>
</svelte:head>

<PlanningBoard 
    initialLines={MOCK_LINES}
    initialTasks={MOCK_TASKS}
    initialHolidays={MOCK_HOLIDAYS}
/>