<script lang="ts">
	export let label: string | undefined = undefined;
	export let value: string | number | undefined | null = undefined;
	export let isRequired = false;

	export let onBlur: ((value: string) => void) | undefined = undefined;
	export let onChange: ((value: string) => void) | undefined = undefined;

	function handleBlur(e: any) {
		onBlur && onBlur(e.target.value);
	}
	function handleChange(e: any) {
		onChange && onChange(e.target.value);
	}
</script>

<input
	type="text"
	class="border border-slate-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
	placeholder={label || ''}
	required={isRequired}
	bind:value
	on:blur={handleBlur}
	on:keyup={handleChange}
/>
