<script>
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import { auth } from '$lib/stores/auth.svelte.js';
	import { getLoggedUser, getPlanningBoards, logout } from '$lib/api-call.js';
	import { toast } from '$lib/stores/toast.svelte.js';
	import Toast from '$lib/components/Toast.svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount, setContext } from 'svelte';

	let { children } = $props();

	// Save function context
	let onSave = $state(() => {});

	function handleSave() { onSave(); }
	function registerSave(fn) { onSave = fn; }

	setContext('registerSave', registerSave);
	setContext('getSelectedBoard', () => auth.selectedBoard);

	const isLoginPage = $derived(page.url.pathname === '/login');

	// Board selector state
	let showBoardSelector = $state(false);

	function selectBoard(board) {
		const prev = auth.selectedBoard?.name;
		auth.selectedBoard = board;
		sessionStorage.setItem('selectedBoard', JSON.stringify(board));
		showBoardSelector = false;
		if (prev && prev !== board.name) {
			toast.info(`Switched to ${board.name}`);
		} else if (!prev) {
			toast.success(`Board loaded: ${board.name}`);
		}
	}

	async function handleLogout() {
		await logout();
		auth.user = null;
		auth.selectedBoard = null;
		auth.boards = [];
		sessionStorage.removeItem('selectedBoard');
		goto('/login');
	}

	onMount(async () => {
		if (page.url.pathname === '/login') {
			auth.isLoading = false;
			return;
		}

		const user = await getLoggedUser();
		if (!user || user === 'Guest') {
			goto('/login');
			return;
		}

		auth.user = user;

		// Restore board from session storage
		const stored = sessionStorage.getItem('selectedBoard');
		if (stored) {
			try { auth.selectedBoard = JSON.parse(stored); } catch (_) {}
		}

		auth.boards = await getPlanningBoards();
		auth.isLoading = false;

		// Default route
		if (page.url.pathname === '/') {
			goto('/local');
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if isLoginPage}
	{@render children()}
{:else if auth.isLoading}
	<!-- Full-screen loading while checking session -->
	<div class="min-h-screen bg-gray-50 flex items-center justify-center">
		<div class="text-center">
			<div class="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
			<p class="text-sm text-gray-500">Loading...</p>
		</div>
	</div>
{:else if auth.user}
	<div class="min-h-screen bg-gray-50 flex flex-col items-center">

		<!-- Top Navigation Bar -->
		<nav class="w-[90%] bg-white shadow-sm rounded-b-lg px-6 py-4 mb-6 flex justify-between items-center border border-gray-100">
			<div class="flex items-center space-x-8">
				<h1 class="text-xl font-bold text-gray-800 tracking-tight">ALTERSENSE</h1>
				<div class="flex space-x-2">
					<button class="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors px-3 py-1.5 rounded-md hover:bg-blue-50">Planning</button>
					<button class="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors px-3 py-1.5 rounded-md hover:bg-blue-50">Reports</button>
				</div>
			</div>
			<div class="flex items-center space-x-3">
				<!-- Board selector button -->
				{#if auth.selectedBoard}
					<button
						onclick={() => showBoardSelector = true}
						class="flex items-center gap-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
					>
						<span class="text-xs text-gray-400">Board:</span>
						<span>{auth.selectedBoard.name}</span>
						<svg class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
						</svg>
					</button>
				{/if}

				<div class="w-px h-6 bg-gray-200"></div>
				<button class="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 px-4 rounded-lg transition-colors shadow-sm">Export</button>
				<button
					class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors shadow-md hover:shadow-lg"
					onclick={handleSave}
				>
					Save Changes
				</button>
				<div class="w-px h-6 bg-gray-200 mx-1"></div>
				<!-- User + Logout -->
				<span class="text-sm text-gray-500 max-w-[120px] truncate">{auth.user}</span>
				<button
					onclick={handleLogout}
					class="text-sm font-medium text-gray-500 hover:text-red-600 transition-colors"
				>
					Logout
				</button>
			</div>
		</nav>

		<!-- Main Application Body -->
		<div class="w-[90%] bg-white rounded-xl shadow-lg border border-gray-200 flex-1 flex flex-col overflow-hidden mb-8 h-[80vh]">
			{@render children()}
		</div>

	</div>

	<Toast />

	<!-- Board Selector Modal -->
	{#if !auth.selectedBoard || showBoardSelector}
		<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
			<div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
				<!-- Header -->
				<div class="px-6 py-5 border-b border-gray-100">
					<h2 class="text-lg font-semibold text-gray-900">Select Planning Board</h2>
					<p class="text-sm text-gray-500 mt-0.5">Choose a board to start planning</p>
				</div>

				<!-- Board List -->
				<div class="px-4 py-3 max-h-80 overflow-y-auto">
					{#if auth.boards.length === 0}
						<p class="text-sm text-gray-400 text-center py-8">No planning boards available</p>
					{:else}
						{#each auth.boards as board}
							<button
								onclick={() => selectBoard(board)}
								class="w-full text-left px-4 py-3.5 rounded-xl hover:bg-blue-50 transition-colors group mb-1 border border-transparent hover:border-blue-200"
								class:bg-blue-50={auth.selectedBoard?.name === board.name}
								class:border-blue-200={auth.selectedBoard?.name === board.name}
							>
								<div class="flex items-center justify-between">
									<div>
										<p class="text-sm font-medium text-gray-900 group-hover:text-blue-700">{board.name}</p>
										<p class="text-xs text-gray-400 mt-0.5">{board.company} · {board.operation_type}</p>
									</div>
									{#if auth.selectedBoard?.name === board.name}
										<svg class="w-4 h-4 text-blue-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
											<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
										</svg>
									{/if}
								</div>
							</button>
						{/each}
					{/if}
				</div>

				<!-- Footer -->
				{#if showBoardSelector && auth.selectedBoard}
					<div class="px-6 py-4 border-t border-gray-100 flex justify-end">
						<button
							onclick={() => showBoardSelector = false}
							class="text-sm font-medium text-gray-600 hover:text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
						>
							Cancel
						</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}
{/if}
