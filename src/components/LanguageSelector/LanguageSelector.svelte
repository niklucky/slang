<script lang="ts">
	import { systemLocales, type SystemLocale } from '../../data/locales';
	import { locale } from '../../stores/i18n';
	const keys = Object.keys(systemLocales) as SystemLocale[];

	function changeLocale(locale: SystemLocale) {
		$locale = locale;
	}
</script>

<div class="relative group cursor-pointer">
	<div class="p-2">{systemLocales[$locale].flag}</div>
	<div class="absolute right-0 bg-cyan-50">
		<div class="bg-white shadow-lg rounded-md overflow-hidden group-hover:block hidden">
			<ul class="divide-y text-sm">
				{#each keys as key}
					<li
						class="py-1 px-4 hover:bg-sky-500 hover:text-white cursor-pointer whitespace-nowrap"
						on:click={() => changeLocale(key)}
						on:keypress
					>
						{systemLocales[key].flag}
						{systemLocales[key].title}
					</li>
				{/each}
			</ul>
		</div>
	</div>
</div>
