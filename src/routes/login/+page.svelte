<script>
	import { login, getPlanningBoards } from '$lib/api-call.js';
	import { auth } from '$lib/stores/auth.svelte.js';
	import { goto } from '$app/navigation';

	let usr = $state('');
	let pwd = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleLogin(e) {
		e.preventDefault();
		error = '';
		loading = true;
		try {
			await login(usr, pwd);
			auth.user = usr;
			auth.boards = await getPlanningBoards();
			auth.selectedBoard = null;
			auth.isLoading = false;
			goto('/local');
		} catch (err) {
			error = err.message || 'Login failed';
		} finally {
			loading = false;
		}
	}
</script>

<div class="min-h-screen bg-gray-50 flex items-center justify-center">
	<div class="w-full max-w-sm">
		<!-- Logo / Brand -->
		<div class="text-center mb-8">
			<h1 class="text-2xl font-bold text-gray-900 tracking-tight">ALTERSENSE</h1>
			<p class="text-sm text-gray-500 mt-1">Planning Board</p>
		</div>

		<!-- Card -->
		<div class="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
			<h2 class="text-lg font-semibold text-gray-800 mb-6">Sign in to your account</h2>

			<form onsubmit={handleLogin} class="space-y-4">
				<div>
					<label for="usr" class="block text-sm font-medium text-gray-700 mb-1">Username</label>
					<input
						id="usr"
						type="text"
						bind:value={usr}
						required
						autocomplete="username"
						placeholder="Enter your username"
						class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
					/>
				</div>

				<div>
					<label for="pwd" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
					<input
						id="pwd"
						type="password"
						bind:value={pwd}
						required
						autocomplete="current-password"
						placeholder="Enter your password"
						class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
					/>
				</div>

				{#if error}
					<p class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
				{/if}

				<button
					type="submit"
					disabled={loading}
					class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors shadow-sm mt-2"
				>
					{loading ? 'Signing in...' : 'Sign In'}
				</button>
			</form>
		</div>
	</div>
</div>
