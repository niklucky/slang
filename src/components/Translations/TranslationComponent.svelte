<script lang="ts">
	import type { Channel, Key, Translation } from '@prisma/client';
	import type { Field } from '../Table/types';

	export let value: Translation[];
	export let row: Key & { translations: Translation[] };
	export let field: Field<Channel[]>;

	let translations: (Translation & { channel?: Channel })[] = [];
	if (row && row.translations) {
		translations = row.translations.map((item) => {
			const channel = item.channelId
				? field.data?.find((ch) => ch.id === item.channelId)
				: undefined;
			return {
				...item,
				channel
			};
		});
	}
</script>

{#each translations as translation}
	{#if translation.localeId === field.key}
		<div class="mb-2">
			<span class="bg-gray-100 rounded-md text-sm px-2 py-1">
				{translation.channel?.name}
			</span>
			{translation.value}
		</div>
	{/if}
{/each}
