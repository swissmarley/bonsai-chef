import { Check } from 'lucide-react';
import { TOOL_TYPE_LABELS, type CareEventTool, type ToolType } from '../../shared/model';
import { useToolList } from '../lib/queries';

/** Pick Strumenti items of one type (e.g. the substrati of a mix); items deleted from the catalog stay listed by name. */
export function ToolPicker({
  type,
  label,
  value,
  onChange,
}: {
  type: ToolType;
  label: string;
  value: CareEventTool[];
  onChange: (tools: CareEventTool[]) => void;
}) {
  const tools = (useToolList().data ?? []).filter((t) => t.type === type);
  const selected = new Set(value.map((t) => t.toolId).filter(Boolean));
  const removed = value.filter((t) => !t.toolId);

  const toggle = (id: string, name: string) =>
    onChange(selected.has(id) ? value.filter((t) => t.toolId !== id) : [...value, { toolId: id, name }]);

  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {tools.length || removed.length ? (
        <div className="chips is-wrapping" role="group" aria-label={label}>
          {tools.map((t) => (
            <button key={t.id} type="button" className={`chip-button${selected.has(t.id) ? ' is-active' : ''}`} aria-pressed={selected.has(t.id)} onClick={() => toggle(t.id, t.name)}>
              {selected.has(t.id) && <Check size={14} aria-hidden="true" />} {t.name}
            </button>
          ))}
          {removed.map((t) => (
            <button
              key={`removed-${t.name}`}
              type="button"
              className="chip-button is-active"
              aria-pressed="true"
              title="Non è più nel catalogo"
              onClick={() => onChange(value.filter((v) => v !== t))}
            >
              <Check size={14} aria-hidden="true" /> {t.name}
            </button>
          ))}
        </div>
      ) : (
        <p className="field-hint">Aggiungi i tuoi {TOOL_TYPE_LABELS[type].toLowerCase()} in Strumenti per poterli scegliere qui.</p>
      )}
    </div>
  );
}
