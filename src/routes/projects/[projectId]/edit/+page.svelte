<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import ProjectForm from '../../../../components/Projects/ProjectForm.svelte';
	import Title from '../../../../components/Title.svelte';
	import { fetchProject } from '../../../../stores/projects';
	import type { Project } from '../../../../types';

	const projectId = parseInt($page.params.projectId);

	let title = 'Project loading...';

	let project: Project | undefined = undefined;

	onMount(() => {
		async function load() {
			const response = await fetchProject(projectId);
			project = response.data;
			title = project.name;
		}
		load();
	});
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

{#if project}
	<Title>{title}</Title>

	<ProjectForm {project} />
{/if}
