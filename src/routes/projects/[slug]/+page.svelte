<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import ProjectForm from '../../../components/Projects/ProjectForm.svelte';
	import Title from '../../../components/Title.svelte';
	import { fetchProject } from '../../../stores/projects';
	import type { Project } from '../../../types';

	let project: Project | undefined = undefined;

	onMount(() => {
		async function load() {
			const response = await fetchProject(+$page.params.slug);
			project = response.data;
		}
		load();
	});
</script>

{#if project}
	<Title>{project.name}</Title>

	<ProjectForm {project} />
{/if}
