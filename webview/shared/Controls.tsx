/**
 * Form primitives shared by the settings, onboarding and challenge panels.
 *
 * Each one wraps a real `<input>` (restyled, or visually hidden) rather than
 * faking the control with divs, so keyboard focus, space/arrow keys and
 * screen-reader semantics keep working for free.
 */

import type { ReactNode } from 'react';
import { IconCheck } from './Icons';

/** A row with a switch. Use for on/off, never for a choice between options. */
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
    <label className="row">
      <span className="row-text">
        {label}
        {description && <span className="row-hint">{description}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

/** A row for one choice among several; the pen marks the chosen one. */
export function ChoiceRow({
  name,
  label,
  description,
  checked,
  onChange,
  trailing,
}: {
  name: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
  trailing?: ReactNode;
}): JSX.Element {
  return (
    <label className="row">
      <input type="radio" className="sr-input" name={name} checked={checked} onChange={onChange} />
      <span className="pen" aria-hidden="true" />
      <span className="row-text">
        {label}
        {description && <span className="row-hint">{description}</span>}
      </span>
      {trailing}
    </label>
  );
}

/** A multi-select chip. A tick appears when it's on, so state never rests on colour alone. */
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
    <label className="chip">
      <input type="checkbox" className="sr-input" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="chip-tick">
        <IconCheck size={12} strokeWidth={2.6} />
      </span>
      {label}
    </label>
  );
}

/** A tab strip: the selected tab sits on the sheet with a hairline edge. */
export function Tabs<T extends string>({
  items,
  active,
  onChange,
  label,
}: {
  items: { id: T; label: string; count?: number }[];
  active: T;
  onChange: (id: T) => void;
  label: string;
}): JSX.Element {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {items.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === active}
          className="tab"
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.count !== undefined && tab.count > 0 && <span className="tab-count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}
