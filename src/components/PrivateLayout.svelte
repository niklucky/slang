<script>
	import '../app.css';
	import Content from './Content.svelte';
	import Header from './Header/Header.svelte';
</script>

<Header />
<Content>
	<slot />
</Content>
