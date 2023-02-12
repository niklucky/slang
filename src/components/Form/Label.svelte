<script lang="ts">
	export let label: string | undefined = undefined;
</script>

{#if label}
	<div class="pb-2 text-gray-400"><label for="first_name">{label}</label></div>
{/if}
