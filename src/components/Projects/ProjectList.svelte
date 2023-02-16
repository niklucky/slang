<script lang="ts">
	import Table from '../Table/Table.svelte';

	import { onMount } from 'svelte';
	import { navigate } from '../../library/navigate';
	import { fetchProjects } from '../../stores/projects';
	import type { Project } from '../../types';

	let projects: Project[] = [];

	const fields = [
		{
			key: 'name'
		},
		{
			key: 'url'
		},
		{
			key: '_count',
			title: 'keys_count',
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
