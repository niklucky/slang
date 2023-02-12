<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchProjectTranslations } from '../../stores/projects';

	import type { Project, Translation } from '../../types';
	import Drawer from '../Drawer/Drawer.svelte';
	import Table from '../Table/Table.svelte';
	import TranslationForm from './TranslationForm.svelte';

	export let project: Project;

	const projectId = project.id;

	let translations: Translation[] = [];
	let selectedTranslation: Translation | undefined = undefined;

	const fields = [
		{
			key: 'id'
		},
		{
			key: 'key'
		},
		{
			key: 'value'
		},
		{
			key: 'namespace'
		},
		{
			key: 'localeId'
		}
	];

	function handleRowClick(translation: Translation) {
		console.log(translation);
		selectedTranslation = translation;
	}

	function handleCloseEditTranslation() {
		selectedTranslation = undefined;
	}

	onMount(() => {
		async function load() {
			const response = await fetchProjectTranslations(project!.id);
			translations = response.data;
		}
		load();
	});
</script>

{#if selectedTranslation}
	<Drawer
		title={selectedTranslation.value || selectedTranslation.key}
		isOpened={true}
		onClose={handleCloseEditTranslation}
	>
		<TranslationForm {projectId} translation={selectedTranslation} />
	</Drawer>
{/if}
<Table onRowClick={handleRowClick} data={translations} {fields} />
