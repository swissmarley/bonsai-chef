import { useId, useState } from 'react';
import { MONTH_INITIALS, MONTHS, formatMonthRange, monthsInRange } from '../../shared/model';

/** 12-month strip highlighting the best period (wraps around the year end); today's month is outlined. */
export function MonthBar({
  start,
  end,
  onPick,
}: {
  start: number | null;
  end: number | null;
  onPick?: (month: number) => void;
}) {
  const active = new Set(monthsInRange(start, end));
  const now = new Date().getMonth();
  const range = formatMonthRange(start, end);
  return (
    <div className="month-bar" role={onPick ? 'group' : 'img'} aria-label={onPick ? 'Scegli i mesi' : `Periodo migliore: ${range || 'non impostato'}`}>
      {MONTH_INITIALS.map((initial, i) => {
        const className = `month-cell${active.has(i) ? ' is-active' : ''}${i === now ? ' is-now' : ''}`;
        return onPick ? (
          <button key={i} type="button" className={className} onClick={() => onPick(i)} aria-label={MONTHS[i]} aria-pressed={active.has(i)}>
            {initial}
          </button>
        ) : (
          <span key={i} className={className} title={MONTHS[i]} aria-hidden="true">
            {initial}
          </span>
        );
      })}
    </div>
  );
}

/** "Inizio Mese" / "Fine Mese" pickers of the iOS form, plus a tappable month strip. */
export function MonthRangeInput({
  start,
  end,
  onChange,
}: {
  start: number | null;
  end: number | null;
  onChange: (start: number | null, end: number | null) => void;
}) {
  const id = useId();
  const [awaitingEnd, setAwaitingEnd] = useState(false);
  const parse = (v: string) => (v === '' ? null : Number(v));

  function pick(month: number) {
    if (awaitingEnd && start != null) {
      onChange(start, month);
      setAwaitingEnd(false);
    } else {
      onChange(month, month);
      setAwaitingEnd(true);
    }
  }

  const select = (label: string, value: number | null, set: (v: number | null) => void, suffix: string) => (
    <div className="field">
      <label className="field-label" htmlFor={`${id}-${suffix}`}>
        {label}
      </label>
      <select id={`${id}-${suffix}`} value={value ?? ''} onChange={(e) => set(parse(e.target.value))}>
        <option value="">—</option>
        {MONTHS.map((m, i) => (
          <option key={m} value={i}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="month-range">
      <div className="field-pair">
        {select('Inizio Mese', start, (v) => onChange(v, end), 'start')}
        {select('Fine Mese', end, (v) => onChange(start, v), 'end')}
      </div>
      <MonthBar start={start} end={end} onPick={pick} />
      <p className="month-range-summary">
        Periodo Migliore: <strong>{formatMonthRange(start, end) || '—'}</strong>
        {awaitingEnd && <span className="hint"> · tocca il mese finale</span>}
      </p>
    </div>
  );
}
