/**
 * Test script to verify task calculator functions
 * Run this in the browser console or as a Node.js script
 */

import {
    calculateDailyCapacity,
    calculateTaskDuration,
    transformStripToTask,
    transformStripsToTasks
} from './taskCalculator.js';

// Sample strip data from the API
const sampleStrip = {
    id: 'STRIP-08-02-2026-Puma-02890',
    sales_order: 'Puma-00445',
    lineId: '',
    style: 'PBF24-11440',
    quantity: 1500.0,
    customer: 'Puma',
    smv: 10.0,
    totalManpower: 16.0,
    operatorQty: 6.0,
    helperQty: 6.0,
    ironmanQty: 4.0,
    workingHour: 8.0,
    status: 'Pending',
    color: 'Black',
    learningCurveTable: [
        { day: 1, efficiency: 30.0, capacity: 0.0, smv: 10.0 },
        { day: 2, efficiency: 40.0, capacity: 0.0, smv: 10.0 },
        { day: 3, efficiency: 50.0, capacity: 0.0, smv: 10.0 },
        { day: 4, efficiency: 60.0, capacity: 0.0, smv: 10.0 },
        { day: 5, efficiency: 60.0, capacity: 0.0, smv: 10.0 },
        { day: 6, efficiency: 60.0, capacity: 0.0, smv: 10.0 }
    ]
};

console.log('=== Task Calculator Test ===\n');

// Test 1: Daily Capacity Calculation
console.log('Test 1: Daily Capacity Calculation');
const capacity30 = calculateDailyCapacity(16, 8, 30, 10);
const capacity60 = calculateDailyCapacity(16, 8, 60, 10);
console.log(`  Day 1 (30% efficiency): ${capacity30.toFixed(2)} units/day`);
console.log(`  Day 4+ (60% efficiency): ${capacity60.toFixed(2)} units/day`);
console.log(`  Expected Day 1: ${((16 * 8 * 60 * 0.30) / 10).toFixed(2)}`);
console.log(`  Expected Day 4+: ${((16 * 8 * 60 * 0.60) / 10).toFixed(2)}\n`);

// Test 2: Task Duration Calculation
console.log('Test 2: Task Duration Calculation');
const startDate = new Date('2026-02-10T00:00:00');
const holidays = ['2026-02-14']; // Valentine's Day as holiday

const result = calculateTaskDuration({
    quantity: 1500,
    smv: 10,
    manpower: 16,
    workingHours: 8,
    learningCurve: sampleStrip.learningCurveTable,
    startDate,
    holidays
});

console.log(`  Total Quantity: 1500 units`);
console.log(`  Working Days: ${result.workingDays}`);
console.log(`  Total Days (including weekends): ${result.duration}`);
console.log(`  Start Date: ${startDate.toISOString().split('T')[0]}`);
console.log(`  End Date: ${result.endDate.toISOString().split('T')[0]}`);
console.log(`  Total Produced: ${result.totalProduced}`);
console.log('\n  Daily Breakdown:');
result.dailyBreakdown.forEach((day) => {
    console.log(
        `    Day ${day.day}: ${day.date.toISOString().split('T')[0]} - ` +
        `Efficiency: ${day.efficiency}%, Capacity: ${day.capacity.toFixed(2)}, ` +
        `Produced: ${day.produced.toFixed(2)}, Remaining: ${day.remaining.toFixed(2)}`
    );
});

// Test 3: Strip to Task Transformation
console.log('\n\nTest 3: Strip to Task Transformation');
const task = transformStripToTask(sampleStrip, holidays, startDate);
console.log('  Transformed Task:');
console.log(`    ID: ${task.id}`);
console.log(`    Order: ${task.orderId}`);
console.log(`    Style: ${task.style}`);
console.log(`    Quantity: ${task.quantity}`);
console.log(`    Line ID: "${task.lineId}" (empty = unplanned)`);
console.log(`    Start: ${task.start.split('T')[0]}`);
console.log(`    End: ${task.end.split('T')[0]}`);
console.log(`    Total Days: ${task.total_days}`);
console.log(`    Working Days: ${task.total_working_days}`);

// Test 4: Multiple Strips Transformation
console.log('\n\nTest 4: Multiple Strips Transformation');
const sampleStrip2 = {
    ...sampleStrip,
    id: 'STRIP-08-02-2026-Puma-02891',
    lineId: 'Line 1', // This one has a line assigned
    color: 'Red',
    quantity: 1500.0
};

const { planned, unplanned, all } = transformStripsToTasks(
    [sampleStrip, sampleStrip2],
    holidays,
    startDate
);

console.log(`  Total Tasks: ${all.length}`);
console.log(`  Planned Tasks (with lineId): ${planned.length}`);
console.log(`  Unplanned Tasks (no lineId): ${unplanned.length}`);
console.log('\n  Planned Tasks:');
planned.forEach((t) => {
    console.log(`    - ${t.orderId} (${t.style}) on ${t.lineId}`);
});
console.log('\n  Unplanned Tasks:');
unplanned.forEach((t) => {
    console.log(`    - ${t.orderId} (${t.style})`);
});

console.log('\n=== All Tests Complete ===');
