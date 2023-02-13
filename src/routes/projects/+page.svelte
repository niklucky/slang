<script>
	import Button from '../../components/Button/Button.svelte';
	import Modal from '../../components/Modal/Modal.svelte';
	import ProjectForm from '../../components/Projects/ProjectForm.svelte';
	import ProjectList from '../../components/Projects/ProjectList.svelte';
	import Title from '../../components/Title.svelte';

	const title = 'Projects';

	let isCreateModal = false;

	const toolbar = [
		{
			component: Button,
			props: {
				title: 'Create project',
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
