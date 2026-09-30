import { Fragment, useId, type ComponentProps, type ReactNode } from 'react';
import { linkify } from '../lib/format';

export function TextField({ label, ...props }: { label: string } & ComponentProps<'input'>) {
  const id = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input id={id} {...props} />
    </div>
  );
}

export function TextArea({ label, hideLabel = false, ...props }: { label: string; hideLabel?: boolean } & ComponentProps<'textarea'>) {
  const id = useId();
  return (
    <div className="field">
      <label className={hideLabel ? 'visually-hidden' : 'field-label'} htmlFor={id}>
        {label}
      </label>
      <textarea id={id} rows={3} {...props} />
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            className={o.value === value ? 'is-active' : ''}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Card with an uppercase section header, like an inset-grouped iOS list section. */
export function Section({ title, children, footer }: { title?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="section">
      {title && <h2 className="section-title">{title}</h2>}
      <div className="card">{children}</div>
      {footer && <p className="section-footer">{footer}</p>}
    </section>
  );
}

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <span className="info-value">{value || <span className="muted">—</span>}</span>
    </div>
  );
}

/** Free text with line breaks kept and web addresses turned into links. */
export function Linkified({ text }: { text: string }) {
  return (
    <p className="prewrap">
      {linkify(text).map((part, i) =>
        part.type === 'link' ? (
          <a key={i} href={part.href} target="_blank" rel="noopener noreferrer">
            {part.value}
          </a>
        ) : (
          <Fragment key={i}>{part.value}</Fragment>
        ),
      )}
    </p>
  );
}
