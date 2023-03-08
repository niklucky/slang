<script>
	import Title from '../components/Title.svelte';
	import { t } from '../stores/i18n';

	$: title = $t('h_dashboard');
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>
<Title>{title}</Title>
