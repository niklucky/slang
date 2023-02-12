<script lang="ts">
	import { navigate } from '../../library/navigate';
	import { createTranslation, updateTranslation } from '../../stores/projects';
	import type { Translation } from '../../types';
	import Button from '../Button/Button.svelte';

	export let projectId;

	export let translation: Partial<Translation> = {
		key: '',
		value: '',
		localeId: 1,
		projectId,
		namespaceId: null,
		channelId: null
	};

	const submitTitle = translation.id ? 'Update' : 'Create';

	async function handleSubmit() {
		if (!translation.id) {
			const result = await createTranslation(translation);
			if (result.data && result.data.id) {
				navigate('/projects/' + result.data.projectId);
			}
			console.log(result);
		} else {
			const result = await updateTranslation(translation.id, translation);
			console.log(result);
		}
	}
</script>

<form>
	<select
		bind:value={translation.localeId}
		class="bg-gray-50 border mr-4  border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
	>
		<option value={1}>English</option>
		<option value={2}>Русский</option>
	</select>

	<input
		type="text"
		id="first_name"
		class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
		placeholder="key"
		required
		bind:value={translation.key}
	/>
	<input
		type="text"
		id="first_name"
		class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
		placeholder="value"
		required
		bind:value={translation.value}
	/>

	<select
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
	</select>
	<Button onClick={handleSubmit} title={submitTitle} />
</form>
