<script>
	import Button from '../../components/Button/Button.svelte';
	import Modal from '../../components/Modal/Modal.svelte';
	import ProjectForm from '../../components/Projects/ProjectForm.svelte';
	import ProjectList from '../../components/Projects/ProjectList.svelte';
	import Title from '../../components/Title.svelte';
	import { t } from '../../library/i18n';

	$: title = $t('h_projects');

	let isCreateModal = false;

	const toolbar = [
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

	function handleCloseCreateModal() {
		isCreateModal = false;
	}
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

{#if isCreateModal}
	<Modal {title} isOpened={isCreateModal} onClose={handleCloseCreateModal}><ProjectForm /></Modal>
{/if}

<Title {toolbar}>{title}</Title>
<ProjectList />
