<script lang="ts">
	export let size: number = 7;

	const className = [`text-slate-600`];
	if (size === 1) {
		className.push('text-4xl');
		className.push('mt-4');
	}
	if (size === 2) {
		className.push('text-3xl');
		className.push('mt-3');
	}
	if (size === 3) {
		className.push('text-2xl mt-3 mb-1');
	}
	if (size === 4) {
		className.push('text-xl mt-2 mb-1');
	}
</script>

<div class={className.join(' ')}><slot /></div>
