<script lang="ts">
	import type { Namespace } from '@prisma/client';
	export let row;
	export let field;

	export let value: Namespace[];
</script>

{#if value}
	{#each value as item}
		<span class="bg-gray-100 rounded-md px-2 py-1">{item.name}</span>
	{/each}
{/if}
