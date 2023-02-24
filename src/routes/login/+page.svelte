<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy } from 'svelte';
	import Button from '../../components/Button/Button.svelte';
	import H from '../../components/Text/H.svelte';
	import type { Auth } from '../../data/api/auth';
	import { navigate } from '../../library/navigate';
	import { authStore } from '../../stores/auth';

	let user: Auth['user'] | null;
	const unUser = authStore.subscribe((v) => (user = v));
	onDestroy(unUser);

	$: if (browser) {
		if (!!user) {
			navigate('/dashboard');
		}
	}

	function handleLogin() {
		console.log('login');
		// userStore.login();
	}
</script>

<H size={1}>Login</H>
<Button onClick={handleLogin} title="Login" />
