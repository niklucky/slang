<script lang="ts">
	import { onMount } from 'svelte';
	import { navigate } from '../../library/navigate';
	import { fetchProjectTranslations } from '../../stores/projects';

	import type { Project, Translation } from '../../types';
	import Table from '../Table/Table.svelte';

	export let project: Project | undefined = undefined;

	let translations: Translation[] = [];

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
		navigate(`/projects/${project?.id}/translations/${translation.id}`);
	}

	onMount(() => {
		async function load() {
			const response = await fetchProjectTranslations(project!.id);
			translations = response.data;
		}
		load();
	});
</script>

<Table onRowClick={handleRowClick} data={translations} {fields} />
