<script lang="ts">
	import type { TOption } from './types';

	export let options: TOption[] = [];
	export let value: TOption | undefined = undefined;
	export let placeholder: string | undefined = undefined;
	export let onChange: (option: TOption) => void;

	let selected: number | string | undefined = value ? value.id : undefined;

	function handleChange(selected: number | string | undefined) {
		const option = options.filter((option) => option.id === selected)[0];
		onChange(option);
	}
</script>

<select
	bind:value={selected}
	on:change={() => handleChange(selected)}
	class="w-full bg-gray-50 border mr-4  border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
>
	{#if placeholder}
		<option disabled selected>{placeholder}</option>
	{/if}
	{#each options as option}
		<option disabled={option.isDisabled} selected={option.id === value?.id} value={option.id}
			>{option.name}</option
		>
	{/each}
</select>
