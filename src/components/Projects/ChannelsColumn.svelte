<script lang="ts">
	import type { Channel } from '@prisma/client';
	import Tag from '../Tag/Tag.svelte';

	export let value: Channel[] = [];

	export let row;
	export let field;
</script>

{#if value.length}
	{#each value as channel}
		<Tag>{channel.name}</Tag>
	{/each}
{/if}
