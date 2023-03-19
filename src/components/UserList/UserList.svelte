<script lang="ts">
	import Table from '../Table/Table.svelte';

	import type { User } from '@prisma/client';
	import { format, parseISO } from 'date-fns';
	import { onMount } from 'svelte';
	import { fetchUsers } from '../../data/api/users';
	import { t } from '../../stores/i18n';
	import type { Project } from '../../types';

	let users: User[] = [];

	$: fields = [
		{
			key: 'id',
			title: $t('id')
		},
		{
			key: 'name',
			title: $t('name')
		},
		{
			key: 'projects',
			title: $t('projects'),
			render: (v: any) => {
				return v
					.map((item: any) => {
						return `${item.project.name} — ${format(
							parseISO(item.assignedAt),
							'HH:mm, dd.MM.yyyy'
						)}`;
					})
					.join(', ');
			}
		}
	];

	function handleRowClick(project: Project) {
		// navigate(`/projects/${project.id}`);
	}

	onMount(() => {
		async function load() {
			const response = await fetchUsers();
			users = response.data;
			console.log('users', users);
		}
		load();
	});
</script>

<Table onRowClick={handleRowClick} data={users} {fields} />
