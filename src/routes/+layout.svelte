<script>
	import '../app.css';
	import Content from '../components/Content.svelte';
	import Header from '../components/Header/Header.svelte';
</script>

<Header />
<Content>
	<slot />
</Content>
