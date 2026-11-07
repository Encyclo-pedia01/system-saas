'use client';

import { useSyncExternalStore } from 'react';

type Preference = 'system' | 'light' | 'dark';

const options: { value: Preference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const lightQuery = '(prefers-color-scheme: light)';
const listeners = new Set<() => void>();

function readPreference(): Preference {
  const match = document.cookie.match(/(?:^|; )theme=(light|dark)/);
  return match ? (match[1] as Preference) : 'system';
}

function resolveTheme(preference: Preference): 'light' | 'dark' {
  if (preference !== 'system') return preference;
  return window.matchMedia(lightQuery).matches ? 'light' : 'dark';
}

function writePreference(next: Preference) {
  if (next === 'system') {
    document.cookie = 'theme=; path=/; max-age=0; samesite=lax';
  } else {
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
  }
  document.documentElement.dataset.theme = resolveTheme(next);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia(lightQuery);
  const onSystemChange = () => {
    if (readPreference() === 'system') {
      document.documentElement.dataset.theme = resolveTheme('system');
    }
  };
  media.addEventListener('change', onSystemChange);
  return () => {
    listeners.delete(listener);
    media.removeEventListener('change', onSystemChange);
  };
}

export function ThemeToggle() {
  const preference = useSyncExternalStore(subscribe, readPreference, () => 'system' as Preference);

  return (
    <div role="group" aria-label="Colour theme" className="inline-flex rounded-full border border-[var(--border)] bg-[var(--ghost-bg)] p-0.5">
      {options.map((option) => {
        const active = preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => writePreference(option.value)}
            className={`min-h-8 rounded-full px-3 text-xs font-semibold transition-colors ${
              active ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
