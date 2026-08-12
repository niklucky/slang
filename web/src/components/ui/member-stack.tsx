import { cx } from '../../lib/cx.js';
import { Avatar } from './avatar.js';

const MAX_VISIBLE = 3;

/** Overflow chip must match the avatar dimensions for its size. */
const chipSizes = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-6 w-6 text-[10px]',
} as const;

/** Overlapping member initials: first few avatars, then a +N overflow chip. */
export function MemberStack({
  names,
  size = 'sm',
  className,
}: {
  names: string[];
  size?: keyof typeof chipSizes;
  className?: string;
}) {
  const visible = names.slice(0, MAX_VISIBLE);
  const overflow = names.length - visible.length;
  if (names.length === 0) return null;
  return (
    <div
      className={cx('flex shrink-0 items-center -space-x-1.5', className)}
      title={names.join(', ')}
    >
      {visible.map((name, index) => (
        <Avatar key={`${name}-${index}`} name={name} size={size} />
      ))}
      {overflow > 0 && (
        <span
          className={cx(
            'flex items-center justify-center rounded-full bg-fill font-semibold text-ink-2',
            chipSizes[size],
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
