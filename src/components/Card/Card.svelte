<script lang="ts">
	import H from '../Text/H.svelte';

	export let title = '';
</script>

<div class="shadow-lg p-6 rounded-lg flex-1">
	<H size={2}>{title}</H>
	<slot />
</div>
