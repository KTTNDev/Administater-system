"use client";

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { BUDGET_TAXONOMY_REFERENCE, type TaxonomyOptionGroup } from '@/lib/budget-taxonomy';
import styles from './budget-taxonomy-field.module.css';

interface BudgetTaxonomyFieldProps {
  id?: string;
  name?: string;
  label: string;
  value: string;
  groups: TaxonomyOptionGroup[];
  placeholder?: string;
  className?: string;
  variant?: 'procurement' | 'budget';
  hint?: string;
  onChange: (value: string) => void;
  onSelect?: (value: string) => void;
}

export function BudgetTaxonomyField({
  id,
  name,
  label,
  value,
  groups,
  placeholder,
  className,
  variant = 'procurement',
  hint = `${BUDGET_TAXONOMY_REFERENCE} · เลือกจากรายการหรือพิมพ์เองได้`,
  onChange,
  onSelect,
}: BudgetTaxonomyFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const listId = `${inputId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setFiltering(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const query = filtering ? value.trim().toLowerCase() : '';
  const visibleGroups = useMemo(() => {
    if (!query) return groups;
    return groups
      .map(group => ({
        group: group.group,
        options: group.options.filter(
          option =>
            option.toLowerCase().includes(query) ||
            group.group.toLowerCase().includes(query),
        ),
      }))
      .filter(group => group.options.length > 0);
  }, [groups, query]);

  const flatOptions = useMemo(
    () => visibleGroups.flatMap(group => group.options),
    [visibleGroups],
  );

  function choose(option: string) {
    if (onSelect) onSelect(option);
    else onChange(option);
    setOpen(false);
    setFiltering(false);
    setActiveIndex(-1);
  }

  let optionCursor = 0;

  return (
    <div className={`${styles.field} ${variant === 'budget' ? styles.budgetField : ''} ${className ?? ''}`.trim()}>
      <label className={styles.fieldLabel} htmlFor={inputId}>{label}</label>
      <div className={styles.wrap} ref={rootRef}>
        <input
          ref={inputRef}
          id={inputId}
          name={name}
          className={styles.input}
          type="text"
          role="combobox"
          aria-label={label}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onFocus={() => {
            setOpen(true);
            setFiltering(false);
          }}
          onClick={() => {
            setOpen(true);
            setFiltering(false);
          }}
          onChange={event => {
            onChange(event.target.value);
            setOpen(true);
            setFiltering(true);
            setActiveIndex(0);
          }}
          onKeyDown={event => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              if (!open) {
                setOpen(true);
                setFiltering(false);
                setActiveIndex(0);
              } else if (flatOptions.length) {
                setActiveIndex(prev => (prev + 1) % flatOptions.length);
              }
            } else if (event.key === 'ArrowUp' && open && flatOptions.length) {
              event.preventDefault();
              setActiveIndex(prev => (prev <= 0 ? flatOptions.length - 1 : prev - 1));
            } else if (event.key === 'Enter' && open && activeIndex >= 0 && flatOptions[activeIndex]) {
              event.preventDefault();
              choose(flatOptions[activeIndex]);
            } else if (event.key === 'Escape' && open) {
              event.preventDefault();
              setOpen(false);
              setFiltering(false);
            }
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          className={styles.toggle}
          aria-label={`เปิดรายการ${label}`}
          onMouseDown={event => event.preventDefault()}
          onClick={() => {
            setOpen(prev => {
              const next = !prev;
              if (next) {
                setFiltering(false);
                setActiveIndex(-1);
                inputRef.current?.focus();
              }
              return next;
            });
          }}
        >
          <ChevronDown size={15} className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} />
        </button>
        {open && (
          <div id={listId} role="listbox" aria-label={`รายการ${label}`} className={styles.menu}>
            <div className={styles.menuHeader}>{hint}</div>
            {visibleGroups.length === 0 ? (
              <div className={styles.empty}>
                ไม่พบในรายการมาตรฐาน — สามารถใช้ข้อความที่พิมพ์เองได้ทันที
              </div>
            ) : (
              visibleGroups.map(group => (
                <div key={group.group} role="group" aria-label={group.group}>
                  <div className={styles.groupLabel}>{group.group}</div>
                  {group.options.map(option => {
                    const currentIndex = optionCursor++;
                    const selected = value.trim() === option;
                    const active = currentIndex === activeIndex;
                    return (
                      <button
                        key={`${group.group}::${option}`}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={`${styles.option} ${active ? styles.optionActive : ''} ${selected ? styles.optionSelected : ''}`}
                        onMouseDown={event => event.preventDefault()}
                        onMouseEnter={() => setActiveIndex(currentIndex)}
                        onClick={() => choose(option)}
                      >
                        <span>{option}</span>
                        {selected && <Check size={14} className={styles.check} />}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
