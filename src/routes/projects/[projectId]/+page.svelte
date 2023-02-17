<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import Button from '../../../components/Button/Button.svelte';
	import Modal from '../../../components/Modal/Modal.svelte';
	import NamespacesFilter from '../../../components/Namespaces/NamespacesFilter.svelte';
	import ProjectForm from '../../../components/Projects/ProjectForm.svelte';
	import Title from '../../../components/Title.svelte';
	import TranslationsTable from '../../../components/Translations/TranslationsTable.svelte';
	import { fetchProject, type ProjectExtended } from '../../../stores/projects';

	let title = 'Project loading...';

	const projectId = parseInt($page.params.projectId);

	let project: ProjectExtended;

	let isEditModal = false;
	let isAddKey = false;

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
	function handleCloseAddTranslationModal() {
		isAddKey = false;
	}

	$: toolbar = [
		{
			component: NamespacesFilter,
			props: {
				namespaces: project?.namespaces
			}
		},
		{
			component: Button,
			props: {
				icon: 'layers',
				onClick: () => {
					isEditModal = true;
				}
			}
		},
		{
			component: Button,
			props: {
				icon: 'lang',
				title: 'a_add_translation',
				onClick: () => {
					isAddKey = true;
				}
			}
		}
	];
	function handleEdit() {
		isEditModal = true;
	}
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
	<Title {toolbar} isEditable={true} onClick={handleEdit}>
		{title}
	</Title>

	<TranslationsTable {project} {isAddKey} onCloseAddTranslation={handleCloseAddTranslationModal} />
{:else}
	<p>Loading...</p>
{/if}
