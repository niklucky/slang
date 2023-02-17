<script lang="ts">
	import Icon from './Icon/Icon.svelte';

	export let toolbar: any[] = [];
	export let isEditable: boolean = false;
	export let onClick: (() => void) | undefined = undefined;

	let className = 'relative group-hover:inline';
	if (isEditable) {
		className += ' cursor-pointer hover:underline';
	}
</script>

<div class="lg:flex lg:items-center lg:justify-between">
	<div class="min-w-0 flex-1 group">
		<h2
			class="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight"
		>
			<span class={className} on:click={onClick} on:keydown={onClick}>
				<slot />
				{#if isEditable}
					<span class="absolute hidden group-hover:inline -right-6 top-3"
						><Icon name="edit2" size={16} /></span
					>
				{/if}
			</span>
		</h2>
		<!-- <div class="mt-1 flex flex-col sm:mt-0 sm:flex-row sm:flex-wrap sm:space-x-6">
			<div class="mt-2 flex items-center text-sm text-gray-500">
				<svg
					class="mr-1.5 h-5 w-5 flex-shrink-0 text-gray-400"
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 20 20"
					fill="currentColor"
					aria-hidden="true"
				>
					<path
						fill-rule="evenodd"
						d="M6 3.75A2.75 2.75 0 018.75 1h2.5A2.75 2.75 0 0114 3.75v.443c.572.055 1.14.122 1.706.2C17.053 4.582 18 5.75 18 7.07v3.469c0 1.126-.694 2.191-1.83 2.54-1.952.599-4.024.921-6.17.921s-4.219-.322-6.17-.921C2.694 12.73 2 11.665 2 10.539V7.07c0-1.321.947-2.489 2.294-2.676A41.047 41.047 0 016 4.193V3.75zm6.5 0v.325a41.622 41.622 0 00-5 0V3.75c0-.69.56-1.25 1.25-1.25h2.5c.69 0 1.25.56 1.25 1.25zM10 10a1 1 0 00-1 1v.01a1 1 0 001 1h.01a1 1 0 001-1V11a1 1 0 00-1-1H10z"
						clip-rule="evenodd"
					/>
					<path
						d="M3 15.055v-.684c.126.053.255.1.39.142 2.092.642 4.313.987 6.61.987 2.297 0 4.518-.345 6.61-.987.135-.041.264-.089.39-.142v.684c0 1.347-.985 2.53-2.363 2.686a41.454 41.454 0 01-9.274 0C3.985 17.585 3 16.402 3 15.055z"
					/>
				</svg>
				Full-time
			</div>
			<div class="mt-2 flex items-center text-sm text-gray-500">
				<svg
					class="mr-1.5 h-5 w-5 flex-shrink-0 text-gray-400"
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 20 20"
					fill="currentColor"
					aria-hidden="true"
				>
					<path
						fill-rule="evenodd"
						d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z"
						clip-rule="evenodd"
					/>
				</svg>
				Remote
			</div>

			<div class="mt-2 flex items-center text-sm text-gray-500">
				<svg
					class="mr-1.5 h-5 w-5 flex-shrink-0 text-gray-400"
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 20 20"
					fill="currentColor"
					aria-hidden="true"
				>
					<path
						fill-rule="evenodd"
						d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z"
						clip-rule="evenodd"
					/>
				</svg>
				Updated on January 9, 2020
			</div>
		</div> -->
	</div>
	<div class="mt-5 flex lg:mt-0 lg:ml-4 lg:items-center ">
		{#each toolbar as item}
			<span class="hidden sm:block ml-4">
				<svelte:component this={item.component} {...item.props} />
			</span>
		{/each}

		<!-- Dropdown -->
		<div class="relative ml-3 sm:hidden">
			<button
				type="button"
				class="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
				id="mobile-menu-button"
				aria-expanded="false"
				aria-haspopup="true"
			>
				More
				<!-- Heroicon name: mini/chevron-down -->
				<svg
					class="-mr-1 ml-2 h-5 w-5 text-gray-500"
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 20 20"
					fill="currentColor"
					aria-hidden="true"
				>
					<path
						fill-rule="evenodd"
						d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
						clip-rule="evenodd"
					/>
				</svg>
			</button>

			<!--
        Dropdown menu, show/hide based on menu state.

        Entering: "transition ease-out duration-200"
          From: "transform opacity-0 scale-95"
          To: "transform opacity-100 scale-100"
        Leaving: "transition ease-in duration-75"
          From: "transform opacity-100 scale-100"
          To: "transform opacity-0 scale-95"
      -->
			<div
				class="absolute right-0 z-10 mt-2 -mr-1 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
				role="menu"
				aria-orientation="vertical"
				aria-labelledby="mobile-menu-button"
				tabindex="-1"
			>
				<!-- Active: "bg-gray-100", Not Active: "" -->
				<a
					href="/"
					class="block px-4 py-2 text-sm text-gray-700"
					role="menuitem"
					tabindex="-1"
					id="mobile-menu-item-0">Edit</a
				>
				<a
					href="/"
					class="block px-4 py-2 text-sm text-gray-700"
					role="menuitem"
					tabindex="-1"
					id="mobile-menu-item-1">View</a
				>
			</div>
		</div>
	</div>
</div>
