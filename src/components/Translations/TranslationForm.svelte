<script lang="ts">
	import type { Key } from '@prisma/client';
	import { createKey, updateKey } from '../../stores/projects';
	import Button from '../Button/Button.svelte';
	import Input from '../Form/Input.svelte';

	export let projectId;
	export let onCreate: ((key: Key) => void) | undefined = undefined;
	export let onUpdate: ((key: Key) => void) | undefined = undefined;

	export let key: Partial<Key> = {
		name: '',
		projectId
	};

	const submitTitle = key.id ? 'Update' : 'Create';

	async function handleSubmit() {
		if (!key.id) {
			const result = await createKey(key);
			if (result.data && result.data.id) {
				onCreate && onCreate(result.data);
			}
		} else {
			const result = await updateKey(key.id, key as Key);
			onUpdate && onUpdate(result.data);
		}
	}
</script>

<form>
	<!-- <select
		bind:value={translation.localeId}
		class="bg-gray-50 border mr-4  border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
	>
		<option value={1}>English</option>
		<option value={2}>Русский</option>
	</select> -->

	<Input label={'key'} bind:value={key.name} />

	<!-- <select
		bind:value={translation.namespaceId}
		class="bg-gray-50 border mr-4  border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
	>
		<option value="1">English</option>
		<option value="2">Русский</option>
	</select>
	<select
		bind:value={translation.channelId}
		class="bg-gray-50 border mr-4  border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
	>
		<option value="1">English</option>
		<option value="2">Русский</option>
	</select> -->
	<Button onClick={handleSubmit} title={submitTitle} />
</form>
