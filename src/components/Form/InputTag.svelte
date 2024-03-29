<script lang="ts">
	import Icon from '../Icon/Icon.svelte';
	import Tag from '../Tag/Tag.svelte';
	import type { TOption } from './types';

	export let tags: TOption[] = [];
	export let selected: TOption[] = [];
	export let onSelect: ((options: TOption[]) => void) | undefined = undefined;

	let isDropdown = false;
	const classNameItem = 'p-2 border-b cursor-pointer hover:bg-slate-50 relative';
	const classNameSelectedItem = classNameItem + ' text-gray-600';

	function handleBlur(e: any) {
		setTimeout(() => {
			isDropdown = false;
			onSelect && onSelect(selected);
		}, 200);
	}

	function handleFocus() {
		isDropdown = true;
	}

	function handleSelect(option: TOption) {
		isDropdown = false;
		const isExists = selected.filter((tag) => tag.id === option.id);
		if (isExists.length) {
			selected = selected.filter((tag) => tag.id !== option.id);
		} else {
			selected = [...selected, option];
		}
	}

	$: {
		const selectedMap: Map<number | string, TOption> = new Map();
		selected.forEach((item) => {
			selectedMap.set(item.id, item);
		});
		tags = tags.map((item) => {
			if (selectedMap.get(item.id)) {
				item.isSelected = true;
			} else {
				item.isSelected = false;
			}
			return item;
		});
	}
</script>

<div class="flex flex-row relative z-0 border-slate-300 border rounded-lg w-full bg-white p-1">
	{#each selected as item}
		<Tag color={item.color}>{item.name}</Tag>
	{/each}
	<span
		contenteditable="true"
		class="inline-block w-full border-0 outline-0 px-2"
		on:blur={handleBlur}
		on:focus={handleFocus}
	/>

	{#if isDropdown}
		<div
			class="bg-white border-slate-200 border rounded-md absolute w-full shadow-md left-0 top-full"
		>
			{#each tags as item}
				<div
					class={item.isSelected ? classNameSelectedItem : classNameItem}
					on:click|stopPropagation={() => handleSelect(item)}
					on:keydown|stopPropagation={() => handleSelect(item)}
				>
					{item.name}
					{#if item.isSelected}
						<span class="absolute right-2 top-3"><Icon name="check" size={16} /></span>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
