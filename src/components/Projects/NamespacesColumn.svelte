<script lang="ts">
	import type { Namespace } from '@prisma/client';
	import Tag from '../Tag/Tag.svelte';

	export let value: Namespace[] = [];

	export let row;
	export let field;
</script>

{#if value.length}
	{#each value as namespace}
		<Tag>{namespace.name}</Tag>
	{/each}
{/if}
