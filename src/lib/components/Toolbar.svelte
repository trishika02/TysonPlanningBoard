<script>
	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

	let datePickerValue = ''; // Internal state for the input

	function onGoToToday() {
		datePickerValue = ''; // Clear picker on "Today" click
		dispatch('goToToday');
	}

	function onGoToDate() {
		if (datePickerValue) {
			dispatch('goToDate', datePickerValue);
		}
	}
</script>

<style>
	.toolbar {
		padding: 10px;
		background: #fff;
		border-bottom: 1px solid #ddd;
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.toolbar input,
	.toolbar button {
		padding: 8px 12px;
		border-radius: 4px;
		border: 1px solid #ccc;
		font-size: 14px;
	}
	.toolbar button {
		background: #007bff;
		color: white;
		cursor: pointer;
	}
	.toolbar button:hover {
		background: #0056b3;
	}
</style>

<div class="toolbar">
	<button id="go-to-today-btn" on:click={onGoToToday}>Today</button>
	<input type="date" id="date-picker" bind:value={datePickerValue} />
	<button id="go-to-date-btn" on:click={onGoToDate}>Go</button>
</div>