<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchProjectTranslations } from '../../stores/projects';

	import type { Project, Translation } from '../../types';
	import Drawer from '../Drawer/Drawer.svelte';
	import Table from '../Table/Table.svelte';
	import KeyColumn from './KeyColumn.svelte';
	import LocaleColumn from './LocaleColumn.svelte';
	import TranslationForm from './TranslationForm.svelte';
	import TranslationNamespace from './TranslationNamespace.svelte';

	export let project: Project;
	export let isAddTranslation = false;

	const projectId = project.id;

	let translations: Translation[] = [];
	let selectedTranslation: Translation | undefined = undefined;

	const fields = [
		{
			key: 'id'
		},
		{
			key: 'key',
			component: KeyColumn
		},
		{
			key: 'value'
		},
		{
			key: 'namespace',
			component: TranslationNamespace
		},
		{
			key: 'locale',
			component: LocaleColumn
		}
	];

	function handleRowClick(translation: Translation) {
		console.log(translation);
		selectedTranslation = translation;
	}

	function handleCloseEditTranslation() {
		selectedTranslation = undefined;
		isAddTranslation = false;
	}

	function handleCreate(translation: Translation) {
		handleCloseEditTranslation();
	}
	function handleUpdate(translation: Translation) {
		handleCloseEditTranslation();
		load();
	}

	async function load() {
		const response = await fetchProjectTranslations(project!.id);
		console.log('response.data', response.data);
		translations = response.data;
	}
	onMount(() => {
		load();
	});
</script>

{#if selectedTranslation || isAddTranslation}
	<Drawer
		title={selectedTranslation ? selectedTranslation.value || selectedTranslation.key : 'Add'}
		isOpened={true}
		onClose={handleCloseEditTranslation}
	>
		<TranslationForm
			{projectId}
			translation={selectedTranslation}
			onCreate={handleCreate}
			onUpdate={handleUpdate}
		/>
	</Drawer>
{/if}
<Table onRowClick={handleRowClick} data={translations} {fields} />
