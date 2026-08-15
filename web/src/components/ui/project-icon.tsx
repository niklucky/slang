import { useEffect, useState } from "react";

import { cx } from "../../lib/cx.js";
import { initialsOf } from "./avatar.js";

const palettes = [
  "bg-accent-soft text-accent",
  "bg-success-soft text-success",
  "bg-info-soft text-info",
  "bg-warning-soft text-warning",
];

const sizes = {
  xs: "h-4 w-4 text-[8px]",
  sm: "h-5 w-5 text-[9px]",
  md: "h-6 w-6 text-[10px]",
  lg: "h-8 w-8 text-xs",
};

function hash(value: string): number {
  let result = 0;
  for (const char of value) result = (result * 31 + char.charCodeAt(0)) >>> 0;
  return result;
}

/**
 * Project favicon fetched from the project's URL, with a colored-initials
 * fallback when no icon was found (or the image fails to load).
 */
export function ProjectIcon({
  projectId,
  name,
  hasIcon,
  size = "sm",
  className,
}: {
  projectId: number;
  name: string;
  /** `project.iconMimeType != null` — whether the server has a stored icon. */
  hasIcon: boolean;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  // Retry the image when a refresh flips `hasIcon` back on.
  useEffect(() => setFailed(false), [projectId, hasIcon]);
  const box = cx(
    "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-md",
    sizes[size],
    className,
  );

  if (!hasIcon || failed) {
    return (
      <span
        className={cx(
          box,
          "font-semibold",
          palettes[hash(name) % palettes.length] ?? "bg-fill text-ink-2",
        )}
      >
        {initialsOf(name)}
      </span>
    );
  }

  return (
    <img
      className={box}
      src={`/api/projects/${projectId}/icon`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
