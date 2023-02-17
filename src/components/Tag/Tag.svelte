<script lang="ts">
	export let color: string = 'bg-gray-100';

	const classNames = ['rounded-md text-gray-800 px-2 py-1 mr-1 text-sm', color];
</script>

<span class={classNames.join(' ')}><slot /></span>
