import { useEffect, useState } from 'react';

export interface ProjectFilters {
  search: string;
  missingOnly: boolean;
  showDeleted: boolean;
  // Hidden locale columns; new locales default to visible.
  excludedLocaleIds: number[];
}

const STORAGE_KEY = 'slang_project_filters';

const DEFAULT_FILTERS: ProjectFilters = {
  search: '',
  missingOnly: false,
  showDeleted: false,
  excludedLocaleIds: [],
};

function loadFilters(projectId: number): ProjectFilters {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const stored = raw
      ? (JSON.parse(raw) as Record<string, Partial<ProjectFilters> | undefined>)
      : {};
    const entry = stored[String(projectId)];
    return {
      search: typeof entry?.search === 'string' ? entry.search : '',
      missingOnly: entry?.missingOnly === true,
      showDeleted: entry?.showDeleted === true,
      excludedLocaleIds: Array.isArray(entry?.excludedLocaleIds)
        ? entry.excludedLocaleIds.filter(
            (value): value is number => typeof value === 'number' && Number.isFinite(value),
          )
        : [],
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

/**
 * Project page filters persisted per project in localStorage, so they
 * survive page reloads. The same component instance serves every
 * /projects/:id route, so state is re-read from storage when the project
 * changes.
 */
export function useProjectFilters(projectId: number) {
  const [filters, setFilters] = useState<ProjectFilters>(() => loadFilters(projectId));
  const [loadedProjectId, setLoadedProjectId] = useState(projectId);
  if (loadedProjectId !== projectId) {
    setLoadedProjectId(projectId);
    setFilters(loadFilters(projectId));
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const all = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      all[String(projectId)] = filters;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {
      // Storage unavailable (e.g. private browsing); filters then simply
      // don't persist.
    }
  }, [projectId, filters]);

  return [filters, setFilters] as const;
}
