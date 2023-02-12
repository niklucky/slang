<script lang="ts">
	import { navigate } from '../../library/navigate';
	import { createProject, updateProject } from '../../stores/projects';
	import type { Project } from '../../types';
	import Button from '../Button/Button.svelte';

	export let project: Partial<Project> = {
		name: '',
		url: '',
		description: null
	};

	const submitTitle = project.id ? 'Update' : 'Create';

	async function handleSubmit() {
		if (!project.id) {
			const result = await createProject(project);
			if (result.data && result.data.id) {
				navigate('/projects/' + result.data.id);
			}
			console.log(result);
		} else {
			const result = await updateProject(project.id, project);
			navigate('/projects/' + result.data.id);
			console.log(result);
		}
	}
</script>

<form>
	<input
		type="text"
		id="first_name"
		class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
		placeholder="John"
		required
		bind:value={project.name}
	/>
	<input
		type="text"
		id="first_name"
		class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
		placeholder="John"
		required
		bind:value={project.url}
	/>
	<input
		type="text"
		id="first_name"
		class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
		placeholder="John"
		required
		bind:value={project.description}
	/>
	<Button onClick={handleSubmit} title={submitTitle} />
</form>
