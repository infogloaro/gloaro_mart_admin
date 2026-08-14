interface FilterTabsProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}

/** Segmented control — the selected pill slides visually via a shared track. */
export function FilterTabs<T extends string>({ options, value, onChange }: FilterTabsProps<T>) {
  return (
    <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-[0_1px_2px_rgba(23,43,34,0.04)]">
      {options.map((option) => {
        const selected = option === value;
        return (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200 ${
              selected
                ? 'bg-emerald text-white'
                : 'text-slate-500 hover:bg-mint-mist hover:text-emerald-deep'
            }`}
          >
            {/* Status values arrive snake_cased: 'out_for_delivery' reads as a
                label, not a column name. */}
            {(option.charAt(0).toUpperCase() + option.slice(1)).replace(/_/g, ' ')}
          </button>
        );
      })}
    </div>
  );
}
