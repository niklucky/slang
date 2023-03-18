<script>
	import LanguageSelector from '../../components/LanguageSelector/LanguageSelector.svelte';
	import Logo from '../../components/Logo/Logo.svelte';
	import PublicLayout from '../../components/PublicLayout.svelte';
	import Title from '../../components/Title.svelte';
</script>

<PublicLayout>
	<div class="flex flex-row justify-between items-center">
		<a href="/"><Logo width={150} height={75} /></a>
		<LanguageSelector />
	</div>
	<Title>Help</Title>
	Coming soon...
</PublicLayout>
