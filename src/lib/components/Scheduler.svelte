<script>
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { formatDate } from '$lib/utils.js';

	// === 1. PROPS (Data In) ===
	export let lines = [];
	export let tasks = [];
	export let calendarDays = [];
	export let START_HOUR = 8;

	// === 2. EVENTS (Actions Out) ===
	const dispatch = createEventDispatcher();

	// === 3. CONSTANTS ===
	const DAY_COLUMN_WIDTH = 100;
	const ROW_HEIGHT = 60;

	// === 4. INTERNAL STATE ===
	let calendarGridEl;
	let tooltipEl;

	// Drag State
	let draggedTaskId = null;
	let originalLineId = null;
	let taskOffsetLeft = 0;
	let ghostTask = null; // This object will hold the ghost's style and state

	// === 5. LIFECYCLE ===
	onMount(() => {
		// Add global listener for drag end, as it can happen outside the component
		document.addEventListener('dragend', handleDragEnd);
		// Cleanup listener
		return () => {
			document.removeEventListener('dragend', handleDragEnd);
		};
	});

	// === 6. UI/VIEW LOGIC ===

	/**
	 * [REACTIVE HELPER]
	 * Calculates the style for a task element.
	 */
	function calculateTaskStyle(task) {
		const lineIndex = lines.findIndex((l) => l.id === task.lineId);
		if (lineIndex === -1) return 'display: none;';

		const top = lineIndex * ROW_HEIGHT + 10; // 10px padding
		const startPixel = getPixelOffsetForDate(new Date(task.start));
		const endPixel = getPixelOffsetForDate(new Date(task.end));

		if (startPixel === null || endPixel === null) {
			return 'display: none;'; // Task is off-calendar
		}

		const width = Math.max(1, endPixel - startPixel); // Ensure min 1px width
		return `top: ${top}px; left: ${startPixel}px; width: ${width}px;`;
	}

	/**
	 * [REACTIVE HELPER]
	 * Generates tooltip content.
	 */
	function getTooltipContent(task) {
		const start = new Date(task.start);
		const end = new Date(task.end);
		return `
            <strong>${task.name}</strong><br>
            Start: ${formatDate(start, 'YYYY-MM-DD HH:mm')}<br>
            End: ${formatDate(end, 'YYYY-MM-DD HH:mm')}
        `;
	}

	// === 7. DRAG & DROP HANDLERS (Ported from original) ===

	function handleDragStart(e, task) {
		draggedTaskId = task.id;
		originalLineId = task.lineId;
		const taskRect = e.target.getBoundingClientRect();
		taskOffsetLeft = e.clientX - taskRect.left;

		// === DURATION CALCULATION (Copied from original) ===
		let draggedTaskDuration = 0;
		const taskStart = new Date(task.start);
		const taskEnd = new Date(task.end);
		let tempDate = new Date(taskStart);
		tempDate.setHours(0, 0, 0, 0);

		while (tempDate < taskEnd) {
			const dateStr = formatDate(tempDate, 'YYYY-MM-DD');
			const day = calendarDays.find((d) => formatDate(d.date, 'YYYY-MM-DD') === dateStr);

			if (day && !day.isBlocked && day.workHours > 0) {
				const dayWorkStart = new Date(day.date);
				dayWorkStart.setHours(START_HOUR, 0, 0, 0);
				const dayWorkEnd = new Date(dayWorkStart.getTime() + day.workHours * 60 * 60000);
				const segmentStart = new Date(Math.max(taskStart.getTime(), dayWorkStart.getTime()));
				const segmentEnd = new Date(Math.min(taskEnd.getTime(), dayWorkEnd.getTime()));
				if (segmentEnd > segmentStart) {
					draggedTaskDuration += (segmentEnd.getTime() - segmentStart.getTime()) / (1000 * 60);
				}
			}
			tempDate.setDate(tempDate.getDate() + 1);
		}
		// === END DURATION CALCULATION ===

		e.dataTransfer.effectAllowed = 'move';
		e.dataTransfer.setData(
			'text/plain',
			JSON.stringify({
				id: draggedTaskId,
				durationMinutes: draggedTaskDuration,
				taskOffsetLeft: taskOffsetLeft
			})
		);

		setTimeout(() => {
			e.target.classList.add('dragging');
		}, 0);

		const taskEl = e.target;
		ghostTask = {
			top: taskEl.style.top,
			left: taskEl.style.left,
			width: taskEl.style.width,
			height: taskEl.style.height,
			valid: true
		};
	}

	function handleDragOver(e) {
		e.preventDefault();
		const targetCell = e.target.closest('.grid-cell');
		if (!targetCell || !ghostTask) return;

		const prevCells = calendarGridEl.querySelectorAll('.drag-over');
		prevCells.forEach((c) => c.classList.remove('drag-over'));
		targetCell.classList.add('drag-over');

		const newLineId = targetCell.dataset.lineId;
		const dateStr = targetCell.dataset.date;
		const isBlocked = targetCell.dataset.isBlocked === 'true';

		const data = e.dataTransfer.getData('text/plain');
		if (!data) return;

		const { id: droppedTaskId, durationMinutes: workDurationMinutes, taskOffsetLeft } = JSON.parse(data);
		const day = calendarDays.find((d) => formatDate(d.date, 'YYYY-MM-DD') === dateStr);

		if (isBlocked || !day || day.workHours === 0) {
			ghostTask.valid = false;
			e.dataTransfer.dropEffect = 'none';
			return;
		}

		const totalWorkMinutes = day.workHours * 60;
		const cellRect = targetCell.getBoundingClientRect();
		const ghostStartX = e.clientX - taskOffsetLeft;
		const dropX = ghostStartX - cellRect.left;
		const percentOffset = Math.max(0, Math.min(1, dropX / DAY_COLUMN_WIDTH));
		let newStartOffsetMinutes = Math.floor(percentOffset * totalWorkMinutes);

		const newStartDate = new Date(`${dateStr}T00:00:00`);
		newStartDate.setHours(START_HOUR);
		newStartDate.setMinutes(newStartDate.getMinutes() + newStartOffsetMinutes);
		const newEndDate = calculateNewEndDate(newStartDate, workDurationMinutes);
		const hasOverlap = isOverlapping(droppedTaskId, newLineId, newStartDate, newEndDate);

		const startPixel = getPixelOffsetForDate(newStartDate);
		const endPixel = getPixelOffsetForDate(newEndDate);

		if (startPixel === null || endPixel === null) {
			ghostTask.valid = false;
			e.dataTransfer.dropEffect = 'none';
			return;
		}

		const newWidth = endPixel - startPixel;
		const lineIndex = lines.findIndex((l) => l.id === newLineId);
		const newTop = lineIndex * ROW_HEIGHT + 10;

		ghostTask.left = `${startPixel}px`;
		ghostTask.width = `${newWidth}px`;
		ghostTask.top = `${newTop}px`;
		ghostTask.valid = !hasOverlap;
		e.dataTransfer.dropEffect = hasOverlap ? 'none' : 'move';
	}

	function handleDragLeave(e) {
		const targetCell = e.target.closest('.grid-cell');
		if (targetCell) {
			targetCell.classList.remove('drag-over');
		}
	}

	function handleDrop(e) {
		e.preventDefault();
		if (ghostTask) ghostTask.valid = true;

		const targetCell = e.target.closest('.grid-cell');
		if (!targetCell) return;
		targetCell.classList.remove('drag-over');

		const newLineId = targetCell.dataset.lineId;
		const dateStr = targetCell.dataset.date;
		const isBlocked = targetCell.dataset.isBlocked === 'true';
		const { id: droppedTaskId, durationMinutes: workDurationMinutes, taskOffsetLeft } = JSON.parse(
			e.dataTransfer.getData('text/plain')
		);
		const day = calendarDays.find((d) => formatDate(d.date, 'YYYY-MM-DD') === dateStr);

		if (isBlocked || !day || day.workHours === 0) {
			console.warn('Cannot drop on a blocked or non-working day!');
			return;
		}

		const totalWorkMinutes = day.workHours * 60;
		const cellRect = targetCell.getBoundingClientRect();
		const ghostStartX = e.clientX - taskOffsetLeft;
		const dropX = ghostStartX - cellRect.left;
		const percentOffset = Math.max(0, Math.min(1, dropX / DAY_COLUMN_WIDTH));
		let newStartOffsetMinutes = Math.floor(percentOffset * totalWorkMinutes);
		const newStartDate = new Date(`${dateStr}T00:00:00`);
		newStartDate.setHours(START_HOUR);
		newStartDate.setMinutes(newStartDate.getMinutes() + newStartOffsetMinutes);
		const newEndDate = calculateNewEndDate(newStartDate, workDurationMinutes);

		if (isOverlapping(droppedTaskId, newLineId, newStartDate, newEndDate)) {
			console.warn('DROP REJECTED: Task would overlap with another task.');
			return;
		}

		// *** THIS IS THE KEY CHANGE ***
		// Instead of modifying state, we dispatch an event to the parent.
		if (newLineId && droppedTaskId) {
			dispatch('updateTask', {
				id: droppedTaskId,
				lineId: newLineId,
				start: newStartDate.toISOString(),
				end: newEndDate.toISOString()
			});
			console.log(`Task ${droppedTaskId} dispatched update to ${newLineId}`);
		}
	}

	function handleDragEnd(e) {
		ghostTask = null; // Remove ghost from DOM
		if (draggedTaskId) {
			const taskEl = document.getElementById(`${draggedTaskId}-task`);
			if (taskEl) {
				taskEl.classList.remove('dragging');
			}
		}
		draggedTaskId = null;
		originalLineId = null;
	}

	// === 8. TOOLTIP HANDLERS (Ported from original) ===

	function showTooltip(e, content) {
		if (content && tooltipEl) {
			tooltipEl.innerHTML = content;
			tooltipEl.style.display = 'block';
			moveTooltip(e);
		}
	}

	function hideTooltip(e) {
		if (tooltipEl) {
			tooltipEl.style.display = 'none';
		}
	}

	function moveTooltip(e) {
		if (tooltipEl) {
			tooltipEl.style.left = `${e.pageX + 10}px`;
			tooltipEl.style.top = `${e.pageY + 10}px`;
		}
	}

	// === 9. HELPER FUNCTIONS (Ported from original) ===

	/**
	 * Overlap Detection
	 */
	function isOverlapping(taskIdToIgnore, lineId, newStart, newEnd) {
		// Use the 'tasks' prop to check for overlaps
		const tasksOnLine = tasks.filter((t) => t.lineId === lineId && t.id !== taskIdToIgnore);
		for (const task of tasksOnLine) {
			const existingStart = new Date(task.start);
			const existingEnd = new Date(task.end);
			if (newStart < existingEnd && newEnd > existingStart) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Re-usable End Date Calculator
	 */
	function calculateNewEndDate(newStartDate, workDurationMinutes) {
		let minutesToDistribute = workDurationMinutes;
		let newEndDate = new Date(newStartDate);
		let dateStr = formatDate(newStartDate, 'YYYY-MM-DD');
		// Use the 'calendarDays' prop
		let currentDayIndex = calendarDays.findIndex((d) => formatDate(d.date, 'YYYY-MM-DD') === dateStr);

		if (currentDayIndex === -1) {
			console.error('Could not find start day in calendar');
			return newStartDate;
		}

		while (minutesToDistribute > 0 && currentDayIndex < calendarDays.length) {
			const currentDay = calendarDays[currentDayIndex];
			if (!currentDay.isBlocked && currentDay.workHours > 0) {
				const dayWorkStart = new Date(currentDay.date);
				dayWorkStart.setHours(START_HOUR, 0, 0, 0);
				const dayWorkEnd = new Date(dayWorkStart.getTime() + currentDay.workHours * 60 * 60000);
				const calcStart = new Date(Math.max(newEndDate.getTime(), dayWorkStart.getTime()));
				let minutesAvailable = (dayWorkEnd.getTime() - calcStart.getTime()) / (1000 * 60);

				if (minutesAvailable <= 0) {
					currentDayIndex++;
					if (currentDayIndex < calendarDays.length) {
						newEndDate = new Date(calendarDays[currentDayIndex].date);
						newEndDate.setHours(START_HOUR, 0, 0, 0);
					}
					continue;
				}

				if (minutesToDistribute <= minutesAvailable) {
					newEndDate = new Date(calcStart.getTime() + minutesToDistribute * 60000);
					minutesToDistribute = 0;
				} else {
					minutesToDistribute -= minutesAvailable;
					newEndDate = new Date(dayWorkEnd);
					currentDayIndex++;
				}
			} else {
				currentDayIndex++;
				if (currentDayIndex < calendarDays.length) {
					newEndDate = new Date(calendarDays[currentDayIndex].date);
					newEndDate.setHours(START_HOUR, 0, 0, 0);
				}
			}
		}
		return newEndDate;
	}

	/**
	 * Calculates the absolute pixel offset for a given date/time.
	 */
	function getPixelOffsetForDate(date) {
		const dateObj = new Date(date);
		const dateStr = formatDate(dateObj, 'YYYY-MM-DD');
		// Use the 'calendarDays' prop
		const dayIndex = calendarDays.findIndex((d) => formatDate(d.date, 'YYYY-MM-DD') === dateStr);

		if (dayIndex === -1) return null;
		const day = calendarDays[dayIndex];
		if (day.isBlocked || day.workHours === 0) {
			return dayIndex * DAY_COLUMN_WIDTH;
		}

		const totalWorkMinutes = day.workHours * 60;
		const dayWorkStart = new Date(day.date);
		dayWorkStart.setHours(START_HOUR, 0, 0, 0);
		const dayWorkEnd = new Date(dayWorkStart.getTime() + day.workHours * 60 * 60000);
		const effectiveTime = new Date(
			Math.max(dayWorkStart.getTime(), Math.min(dayWorkEnd.getTime(), dateObj.getTime()))
		);
		let taskOffsetMinutes = (effectiveTime.getTime() - dayWorkStart.getTime()) / (1000 * 60);
		const leftPercent = taskOffsetMinutes / totalWorkMinutes;
		const leftPixelOffset = leftPercent * DAY_COLUMN_WIDTH;
		return dayIndex * DAY_COLUMN_WIDTH + leftPixelOffset;
	}
</script>

<style>
	:root {
		--day-width: 100px;
		--row-height: 60px;
		--header-height: 50px;
		--line-list-width: 150px;
		--border-color: #ddd;
		--task-bg: #3498db;
		--task-bg-valid: #2ecc71;
		--task-bg-invalid: #e74c3c;
		--weekend-bg: #f9f9f9;
	}

	#calendar-container {
		display: flex;
		margin: 20px;
		border: 1px solid var(--border-color);
		background: #fff;
	}
	#line-list {
		width: var(--line-list-width);
		border-right: 1px solid var(--border-color);
		flex-shrink: 0;
	}
	.line-list-header {
		height: var(--header-height);
		border-bottom: 1px solid var(--border-color);
		display: flex;
		align-items: center;
		padding-left: 10px;
		font-weight: bold;
		box-sizing: border-box;
	}
	.line-cell {
		height: var(--row-height);
		border-bottom: 1px solid var(--border-color);
		padding-left: 10px;
		display: flex;
		align-items: center;
		box-sizing: border-box;
		font-size: 14px;
	}
	.line-cell:last-child {
		border-bottom: none;
	}
	#calendar-body {
		flex-grow: 1;
		overflow-x: auto;
	}
	#calendar-header {
		display: flex;
		height: var(--header-height);
		border-bottom: 2px solid var(--border-color);
		position: sticky;
		top: 0;
		background: #fff;
		z-index: 10;
	}
	.header-cell {
		min-width: var(--day-width);
		width: var(--day-width);
		border-right: 1px solid var(--border-color);
		box-sizing: border-box;
		padding: 4px;
		text-align: center;
		font-size: 12px;
	}
	.header-cell.weekend {
		background: var(--weekend-bg);
	}
	.header-cell .day-name {
		font-weight: bold;
		font-size: 14px;
	}
	#calendar-grid {
		position: relative;
	}
	.grid-row {
		display: flex;
		height: var(--row-height);
		border-bottom: 1px solid var(--border-color);
	}
	.grid-row:last-child {
		border-bottom: none;
	}
	.grid-cell {
		min-width: var(--day-width);
		width: var(--day-width);
		border-right: 1px solid var(--border-color);
		box-sizing: border-box;
	}
	.grid-cell.blocked {
		background: var(--weekend-bg);
		pointer-events: none;
	}
	.grid-cell.drag-over {
		outline: 2px solid #007bff;
		outline-offset: -2px;
	}
	.task {
		position: absolute;
		height: calc(var(--row-height) - 20px);
		background: var(--task-bg);
		color: white;
		border-radius: 4px;
		box-sizing: border-box;
		padding: 5px 8px;
		font-size: 13px;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		cursor: move;
		z-index: 1;
		user-select: none;
	}
	.task.dragging {
		opacity: 0;
		pointer-events: none;
	}
	#ghost-task {
		position: absolute;
		height: calc(var(--row-height) - 20px);
		border-radius: 4px;
		z-index: 20;
		pointer-events: none;
	}
	#ghost-task.valid {
		background: var(--task-bg-valid);
		opacity: 0.7;
		border: 1px dashed #fff;
	}
	#ghost-task.invalid {
		background: var(--task-bg-invalid);
		opacity: 0.7;
		border: 1px dashed #fff;
	}
	#tooltip {
		position: absolute;
		display: none;
		background: #333;
		color: white;
		padding: 8px 12px;
		border-radius: 4px;
		font-size: 12px;
		z-index: 100;
		pointer-events: none;
		line-height: 1.5;
	}
</style>

<div id="calendar-container">
	<div id="line-list">
		<div class="line-list-header">Resources</div>
		{#each lines as line (line.id)}
			<div class="line-cell">{line.name}</div>
		{/each}
	</div>

	<div id="calendar-body">
		<div id="calendar-header">
			{#each calendarDays as day (day.date)}
				<div class="header-cell" class:weekend={day.isBlocked}>
					<div class="day-name">{formatDate(day.date, 'ddd')}</div>
					<div>{day.date.getDate()}</div>
				</div>
			{/each}
		</div>

		<div id="calendar-grid" bind:this={calendarGridEl}>
			{#each lines as line (line.id)}
				<div class="grid-row">
					{#each calendarDays as day (day.date)}
						<div
							class="grid-cell"
							class:blocked={day.isBlocked}
							data-line-id={line.id}
							data-date={formatDate(day.date, 'YYYY-MM-DD')}
							data-is-blocked={day.isBlocked}
							on:dragover={handleDragOver}
							on:dragleave={handleDragLeave}
							on:drop={handleDrop}
						/>
					{/each}
				</div>
			{/each}

			{#each tasks as task (task.id)}
				{@const style = calculateTaskStyle(task)}
				{@const tooltipContent = getTooltipContent(task)}
				<div
					id="{task.id}-task"
					class="task"
					{style}
					draggable="true"
					on:dragstart={(e) => handleDragStart(e, task)}
					on:mouseenter={(e) => showTooltip(e, tooltipContent)}
					on:mouseleave={hideTooltip}
					on:mousemove={moveTooltip}
				>
					{task.name}
				</div>
			{/each}

			{#if ghostTask}
				<div
					id="ghost-task"
					style:top={ghostTask.top}
					style:left={ghostTask.left}
					style:width={ghostTask.width}
					style:height={ghostTask.height}
					class:valid={ghostTask.valid}
					class:invalid={!ghostTask.valid}
				/>
			{/if}
		</div>
	</div>
</div>

<div id="tooltip" bind:this={tooltipEl} />