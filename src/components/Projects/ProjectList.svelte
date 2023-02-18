<script lang="ts">
	import Table from '../Table/Table.svelte';

	import { onMount } from 'svelte';
	import { t } from '../../library/i18n';
	import { navigate } from '../../library/navigate';
	import { fetchProjects } from '../../stores/projects';
	import type { Project } from '../../types';

	let projects: Project[] = [];

	$: fields = [
		{
			key: 'name',
			title: $t('name')
		},
		{
			key: 'url',
			title: $t('url')
		},
		{
			key: '_count',
			title: $t('keys_count'),
			render: (value: any) => {
				return value.keys;
			}
		}
	];

	function handleRowClick(project: Project) {
		navigate(`/projects/${project.id}`);
	}

	onMount(() => {
		async function load() {
			const response = await fetchProjects();
			projects = response.data;
		}
		load();
	});
</script>

<Table onRowClick={handleRowClick} data={projects} {fields} />
