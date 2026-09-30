import { useId, useState } from 'react';
import { FREQUENCY_UNIT_LABELS, FREQUENCY_UNITS, type CareFrequency, type CareKey, type FrequencyUnit } from '../../shared/model';

/** Sensible unit for each task when the user types a number first. */
const DEFAULT_UNIT: Record<CareKey, FrequencyUnit> = {
  repotting: 'anni',
  pruning: 'mesi',
  shootCutting: 'settimane',
  wiring: 'mesi',
  defoliation: 'anni',
  fertilizing: 'settimane',
};

/** "Frequenza: ogni [3] [settimane]" + automatic reminder; an empty number means no frequency. */
export function FrequencyInput({
  careKey,
  value,
  onChange,
}: {
  careKey: CareKey;
  value: CareFrequency | undefined;
  onChange: (value: CareFrequency | undefined) => void;
}) {
  const id = useId();
  const [every, setEvery] = useState(value ? String(value.every) : '');
  const [unit, setUnit] = useState<FrequencyUnit>(value?.unit ?? DEFAULT_UNIT[careKey]);
  const autoReminder = value?.autoReminder ?? false;

  function update(nextEvery: string, nextUnit: FrequencyUnit, nextAuto = autoReminder) {
    const n = Number(nextEvery);
    onChange(nextEvery.trim() && Number.isInteger(n) && n >= 1 && n <= 365 ? { every: n, unit: nextUnit, autoReminder: nextAuto } : undefined);
  }

  return (
    <div className="field">
      <label className="field-label" htmlFor={`${id}-every`}>
        Frequenza
      </label>
      <div className="frequency-row">
        <span aria-hidden="true">Ogni</span>
        <input
          id={`${id}-every`}
          type="number"
          inputMode="numeric"
          min={1}
          max={365}
          placeholder="—"
          value={every}
          onChange={(e) => {
            setEvery(e.target.value);
            update(e.target.value, unit);
          }}
        />
        <select
          aria-label="Unità di tempo"
          value={unit}
          onChange={(e) => {
            const next = e.target.value as FrequencyUnit;
            setUnit(next);
            update(every, next);
          }}
        >
          {FREQUENCY_UNITS.map((u) => (
            <option key={u} value={u}>
              {FREQUENCY_UNIT_LABELS[u][Number(every) === 1 ? 0 : 1]}
            </option>
          ))}
        </select>
      </div>
      {value && (
        <label className="check-row">
          <input type="checkbox" checked={autoReminder} onChange={(e) => update(every, unit, e.target.checked)} />
          <span>Promemoria automatico: quando registri l’intervento, ti ricordo il prossimo</span>
        </label>
      )}
    </div>
  );
}
