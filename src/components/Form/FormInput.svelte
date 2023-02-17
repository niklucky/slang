<script lang="ts">
	import Label from './Label.svelte';

	export let label: string | undefined = undefined;
</script>

<div class="pt-1 pb-2">
	<Label {label} />
	<slot />
</div>
