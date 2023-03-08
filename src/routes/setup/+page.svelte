<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy } from 'svelte';
	import Button from '../../components/Button/Button.svelte';
	import Content from '../../components/Content.svelte';
	import FormInput from '../../components/Form/FormInput.svelte';
	import Input from '../../components/Form/Input.svelte';
	import Toolbar from '../../components/Form/Toolbar.svelte';
	import H from '../../components/Text/H.svelte';
	import { t } from '../../library/i18n';
	import { navigate } from '../../library/navigate';
	import { authStore } from '../../stores/auth';

	const unUser = authStore.subscribe((v) => {
		if (browser && v) {
			navigate('/dashboard');
		}
	});
	onDestroy(unUser);

	let username = '';
	let password = '';
	let name = '';

	$: title = $t('h_setup');

	function handleSetup() {
		authStore.setup(name, username, password);
	}
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>
<Content>
	<H size={1}>{title}</H>
	<form>
		<FormInput label={'name'}>
			<Input bind:value={name} />
		</FormInput>
		<FormInput label={'username'}>
			<Input bind:value={username} />
		</FormInput>
		<FormInput label={'password'}>
			<Input type="password" bind:value={password} />
		</FormInput>
		<Toolbar>
			<Button onClick={handleSetup}>Setup account</Button>
		</Toolbar>
	</form>
</Content>
