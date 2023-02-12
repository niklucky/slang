<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import Button from '../../../components/Button/Button.svelte';
	import Modal from '../../../components/Modal/Modal.svelte';
	import ProjectForm from '../../../components/Projects/ProjectForm.svelte';
	import Title from '../../../components/Title.svelte';
	import TranslationsTable from '../../../components/Translations/TranslationsTable.svelte';
	import { navigate } from '../../../library/navigate';
	import { fetchProject } from '../../../stores/projects';
	import type { Project } from '../../../types';

	let title = 'Project loading...';

	const projectId = parseInt($page.params.projectId);

	let project: Project | undefined = undefined;

	let isEditModal = false;

	onMount(() => {
		async function load() {
			const response = await fetchProject(projectId);
			project = response.data;
			title = project.name;
		}
		load();
	});

	function handleCloseEditModal() {
		isEditModal = false;
	}

	const toolbar = [
		{
			component: Button,
			props: {
				title: 'Edit project',
				onClick: () => {
					//navigate(`/projects/${project?.id}/edit`);
					isEditModal = true;
				}
			}
		},
		{
			component: Button,
			props: {
				title: 'Create translation',
				onClick: () => {
					navigate(`/projects/${project?.id}/translations/create`);
				}
			}
		}
	];
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

{#if isEditModal}
	<Modal {title} isOpened={isEditModal} onClose={handleCloseEditModal}
		><ProjectForm {project} /></Modal
	>
{/if}
{#if project != undefined}
	<Title {toolbar}>{title}</Title>

	<TranslationsTable {project} />
{:else}
	<p>empty</p>
{/if}
