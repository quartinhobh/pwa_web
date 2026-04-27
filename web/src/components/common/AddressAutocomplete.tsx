import React, { useEffect, useId, useRef, useState } from 'react';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export interface AddressAutocompleteProps {
  id?: string;
  ariaLabel?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  countryCodes?: string;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const DEBOUNCE_MS = 450;
const MIN_QUERY_LEN = 3;

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  id,
  ariaLabel,
  value,
  onChange,
  placeholder,
  className,
  countryCodes = 'br',
}) => {
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const skipNextFetch = useRef(false);
  const uid = useId();
  const listboxId = `address-listbox-${uid}`;

  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < MIN_QUERY_LEN) {
      setResults([]);
      setOpen(false);
      return;
    }
    const ctrl = new AbortController();
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=0&countrycodes=${countryCodes}&accept-language=pt-BR`;
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`nominatim ${res.status}`);
        const data = (await res.json()) as NominatimResult[];
        setResults(data);
        setOpen(true);
        setActiveIndex(-1);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setResults([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(handle);
      ctrl.abort();
    };
  }, [value, countryCodes]);

  const handlePick = (display: string) => {
    skipNextFetch.current = true;
    onChange(display);
    setResults([]);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      const chosen = results[activeIndex];
      if (chosen) handlePick(chosen.display_name);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const activeOptionId = activeIndex >= 0 ? `address-option-${uid}-${activeIndex}` : undefined;

  return (
    <div className="relative">
      <input
        id={id}
        aria-label={ariaLabel}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeOptionId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />
      {open && (loading || results.length > 0) && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-10 max-h-60 overflow-auto border-2 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark shadow-md"
        >
          {loading && (
            <li className="font-body text-xs text-zine-burntOrange/70 px-3 py-2">buscando…</li>
          )}
          {!loading &&
            results.map((r, i) => (
              <li
                key={r.place_id}
                id={`address-option-${uid}-${i}`}
                role="option"
                aria-selected={i === activeIndex}
              >
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onTouchStart={(e) => e.preventDefault()}
                  onClick={() => handlePick(r.display_name)}
                  className={[
                    'w-full text-left px-3 py-2 font-body text-sm text-zine-burntOrange focus:outline-none',
                    i === activeIndex
                      ? 'bg-zine-burntYellow/50'
                      : 'hover:bg-zine-burntYellow/30 focus-visible:bg-zine-burntYellow/30',
                  ].join(' ')}
                >
                  {r.display_name}
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
};

export default AddressAutocomplete;
