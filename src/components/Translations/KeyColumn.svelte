<script lang="ts">
	export let key: string;
</script>

{#if key}
	<span class="bg-gray-100 rounded-md px-2 py-1">{key}</span>
{/if}
