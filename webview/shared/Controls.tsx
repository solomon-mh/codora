/**
 * Form primitives shared by the settings, onboarding and challenge panels.
 *
 * Each one wraps a real `<input>` (restyled with `appearance: none`) rather
 * than faking the control with divs, so keyboard focus, space/arrow keys and
 * screen-reader semantics keep working for free.
 */

import type { ReactNode } from 'react';
import { IconCheck } from './Icons';

/** A labelled toggle for a boolean setting. Use for "on/off", never for a choice between options. */
export function SwitchRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}): JSX.Element {
  return (
    <label className="c-switch-row">
      <span className="c-option-text">
        <span style={{ display: 'block' }}>{label}</span>
        {description && (
          <span className="c-muted" style={{ display: 'block', fontSize: 11.5, marginTop: 2 }}>
            {description}
          </span>
        )}
      </span>
      <input
        type="checkbox"
        className="c-switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

/** A pill-shaped multi-select item. The dot doubles as the selected indicator. */
export function Chip({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}): JSX.Element {
  return (
    <label className="c-chip" style={{ position: 'relative', textTransform: 'capitalize' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="c-chip-dot" />
      {label}
    </label>
  );
}

/** A single-choice row styled as a selectable card. `trailing` holds an inline sub-control. */
export function RadioOption({
  name,
  label,
  description,
  checked,
  onChange,
  trailing,
  capitalize,
}: {
  name: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
  trailing?: ReactNode;
  /** For bare lowercase tokens ("easy"). Leave off for prose labels — it would
   *  title-case every word ("10 Minutes"). */
  capitalize?: boolean;
}): JSX.Element {
  return (
    <label className="c-option">
      <input type="radio" className="c-radio" name={name} checked={checked} onChange={onChange} />
      <span className="c-option-text">
        <span style={{ display: 'block', textTransform: capitalize ? 'capitalize' : undefined }}>{label}</span>
        {description && (
          <span className="c-muted" style={{ display: 'block', fontSize: 11.5, marginTop: 2 }}>
            {description}
          </span>
        )}
      </span>
      {trailing}
    </label>
  );
}

/** A compact horizontal single-choice control, for short option sets. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}): JSX.Element {
  return (
    <div className="c-segmented" role="radiogroup">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          className={`c-segmented-item${value === opt.value ? ' is-active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {value === opt.value && <IconCheck size={12} strokeWidth={2.2} />}
          {opt.label}
        </button>
      ))}
    </div>
  );
}
