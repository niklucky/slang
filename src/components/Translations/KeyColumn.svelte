<script lang="ts">
	export let value: string;
</script>

{#if value}
	<span class="bg-gray-100 rounded-md px-2 py-1">{value}</span>
{/if}
