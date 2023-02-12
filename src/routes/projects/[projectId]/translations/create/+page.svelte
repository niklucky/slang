<script>
	import { page } from '$app/stores';
	import Title from '../../../../../components/Title.svelte';
	import TranslationForm from '../../../../../components/Translations/TranslationForm.svelte';
	const projectId = parseInt($page.params.projectId);
</script>

<Title>Create translation</Title>

<TranslationForm {projectId} />
