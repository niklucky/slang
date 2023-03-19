<script lang="ts">
	import DataTable from '../DataTable/DataTable.svelte';

	import { onMount } from 'svelte';
	import { fetchProjects } from '../../data/api/projects';
	import { navigate } from '../../library/navigate';
	import { t } from '../../stores/i18n';
	import type { Project } from '../../types';
	import ChannelsColumn from './ChannelsColumn.svelte';
	import LocalesColumn from './LocalesColumn.svelte';
	import NamespacesColumn from './NamespacesColumn.svelte';

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
			key: 'locales',
			title: $t('locales'),
			component: LocalesColumn
		},
		{
			key: 'channels',
			title: $t('channels'),
			component: ChannelsColumn
		},
		{
			key: 'namespaces',
			title: $t('namespaces'),
			component: NamespacesColumn
		},
		{
			key: '_count',
			title: $t('keys_count'),
			render: (value: any) => {
				return value.words;
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

<DataTable onRowClick={handleRowClick} data={projects} {fields} />
