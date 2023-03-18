<script lang="ts">
	export let href = '#';
</script>

<a {href} class="bg-sky-100 text-sky-600 py-1 px-3 rounded-lg">
	<slot /> &rarr;
</a>
