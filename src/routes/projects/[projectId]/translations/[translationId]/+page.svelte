<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import Title from '../../../../../components/Title.svelte';
	import TranslationForm from '../../../../../components/Translations/TranslationForm.svelte';
	import { fetchProjectTranslation } from '../../../../../stores/projects';

	import type { Translation } from '../../../../../types';

	let title = 'Project loading...';

	let translation: Translation | undefined = undefined;

	const projectId = parseInt($page.params.projectId);

	onMount(() => {
		async function load() {
			const response = await fetchProjectTranslation(projectId, +$page.params.translationId);
			translation = response.data;
			title = translation.value || translation.key;
		}
		load();
	});
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

{#if translation}
	<Title>{title}</Title>

	<TranslationForm {projectId} {translation} />
{/if}
