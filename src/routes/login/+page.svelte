<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy } from 'svelte';
	import Button from '../../components/Button/Button.svelte';
	import Content from '../../components/Content.svelte';
	import FormInput from '../../components/Form/FormInput.svelte';
	import Input from '../../components/Form/Input.svelte';
	import Toolbar from '../../components/Form/Toolbar.svelte';
	import H from '../../components/Text/H.svelte';
	import type { Auth } from '../../data/api/auth';
	import { t } from '../../library/i18n';
	import { navigate } from '../../library/navigate';
	import { authStore } from '../../stores/auth';

	let user: Auth['user'] | null = null;
	const unUser = authStore.subscribe((v) => {
		user = v;
	});
	onDestroy(unUser);

	let username = '';
	let password = '';
	let title = $t('h_login');

	$: {
		title = $t('h_login');
		if (browser && user) {
			navigate('/dashboard');
		}
	}

	function handleLogin() {
		authStore.login(username, password);
	}
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>
<Content>
	<H size={1}>{title}</H>
	<form>
		<FormInput label={$t('username')}>
			<Input bind:value={username} />
		</FormInput>
		<FormInput label={$t('password')}>
			<Input type="password" bind:value={password} />
		</FormInput>
		<Toolbar>
			<Button onClick={handleLogin}>Login</Button>
		</Toolbar>
	</form>
</Content>
