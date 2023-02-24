<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy } from 'svelte';
	import '../app.css';
	import type { Auth } from '../data/api/auth';
	import { navigate } from '../library/navigate';
	import { authStore } from '../stores/auth';
	import Content from './Content.svelte';
	import Header from './Header/Header.svelte';

	let user: Auth['user'] | null = null;
	let isLoading = !authStore.isInitialized();
	const unsubsribeUser = authStore.subscribe((v) => (user = v));

	onDestroy(unsubsribeUser);

	$: {
		isLoading = !authStore.isInitialized();
		if (browser && !isLoading) {
			if (!user) {
				navigate('/login');
			}
		}
	}
</script>

{#if !isLoading}
	<Header />
	<Content>
		<slot />
	</Content>
{/if}
