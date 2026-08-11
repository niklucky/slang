import { localeFlag } from '../../lib/locale-flag.js';

export interface LocaleFlagProps {
  code: string;
  name: string;
  countryCode: string;
  /** Where the popover appears; use "bottom" where content above is clipped (e.g. table headers). */
  placement?: 'top' | 'bottom';
}

/** Flag emoji with a hover popover showing "code — name". */
export function LocaleFlag({ code, name, countryCode, placement = 'top' }: LocaleFlagProps) {
  return (
    <span className="group/locale-flag relative inline-flex items-center" tabIndex={0}>
      <span aria-hidden className="text-2xl leading-none">
        {localeFlag(countryCode)}
      </span>
      <span className="sr-only">{`${code} — ${name}`}</span>
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-1 text-xs normal-case tracking-normal text-ink opacity-0 shadow-lg transition-opacity group-hover/locale-flag:opacity-100 group-focus-within/locale-flag:opacity-100 ${
          placement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
        }`}
      >
        {code} — {name}
      </span>
    </span>
  );
}
