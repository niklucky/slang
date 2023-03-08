<script>
	import PrivateLayout from '../../components/PrivateLayout.svelte';
	import Title from '../../components/Title.svelte';
	import { t } from '../../stores/i18n';

	$: title = $t('h_dashboard');
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>
<PrivateLayout>
	<Title>{title}</Title>
</PrivateLayout>
