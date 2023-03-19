<script lang="ts">
	import Table from '../Table/Table.svelte';

	import { onMount } from 'svelte';
	import { fetchUsers, type UserWithProjects } from '../../data/api/users';
	import { t } from '../../stores/i18n';
	import type { Project } from '../../types';
	import Cell from '../Table/Cell.svelte';
	import HeadCell from '../Table/HeadCell.svelte';
	import Row from '../Table/Row.svelte';
	import UserProjects from './UserProjects.svelte';

	let users: UserWithProjects[] = [];

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

<Table>
	<svelte:fragment slot="head">
		<HeadCell>#</HeadCell>
		<HeadCell>{$t('name')}</HeadCell>
		<HeadCell>{$t('projects')}</HeadCell>
	</svelte:fragment>
	<Row slot="body">
		{#each users as user, index}
			<Cell>{index + 1}</Cell>
			<Cell>{user.name}</Cell>
			<Cell>
				<UserProjects {user} />
			</Cell>
		{/each}
	</Row>
</Table>
