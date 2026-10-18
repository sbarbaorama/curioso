export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  multi = false,
}: {
  options: { id: T; label: string }[];
  value: T[];
  onChange: (v: T[]) => void;
  multi?: boolean;
}) {
  return (
    <div className="chips">
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <button
            type="button"
            key={String(o.id)}
            className={on ? "chip on" : "chip"}
            aria-pressed={on}
            onClick={() => onChange(multi ? (on ? value.filter((v) => v !== o.id) : [...value, o.id]) : [o.id])}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
