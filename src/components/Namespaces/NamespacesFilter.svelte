<script lang="ts">
	import type { Namespace } from '@prisma/client';
	import InputTag from '../Form/InputTag.svelte';
	import type { TOption } from '../Form/types';

	export let namespaces: Namespace[] = [];
	export let onSelect: (selected: TOption[]) => void;
	let tags: TOption[] = [];

	$: tags = namespaces.map((ns) => {
		return {
			id: ns.id,
			name: ns.name
		};
	});
</script>

{#if tags.length}
	<div>
		<InputTag {tags} selected={tags} {onSelect} />
	</div>
{/if}
