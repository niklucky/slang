<script lang="ts">
	import Button from '../../components/Button/Button.svelte';
	import Modal from '../../components/Modal/Modal.svelte';
	import ProjectForm from '../../components/Projects/ProjectForm.svelte';
	import ProjectList from '../../components/Projects/ProjectList.svelte';
	import Title from '../../components/Title.svelte';
	import { t } from '../../library/i18n';

	let title = $t('h_projects');
	let toolbar: any[] = [];

	$: {
		title = $t('h_projects');
		toolbar = [
			{
				component: Button,
				props: {
					title: $t('a_create_project'),
					onClick: () => {
						isCreateModal = true;
					}
				}
			}
		];
	}
	let isCreateModal = false;

	function handleCloseCreateModal() {
		isCreateModal = false;
	}
	function handleUpdate() {
		console.log('Project updated:');
	}
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

{#if isCreateModal}
	<Modal {title} width={800} isOpened={isCreateModal} onClose={handleCloseCreateModal}
		><ProjectForm onUpdate={handleUpdate} /></Modal
	>
{/if}

<Title {toolbar}>{title}</Title>
<ProjectList />
