'use client';

import React, { useState } from 'react';

export interface TabItem {
  id: string;
  label: string;
  badge?: string | number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="border-b border-border-line flex gap-24 overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`py-12 px-4 font-display font-medium text-subtitle border-b-2 transition-all duration-micro shrink-0 flex items-center gap-8 ${
              isActive
                ? 'border-brand-andaman text-brand-andaman'
                : 'border-transparent text-text-stone hover:text-text-ink'
            }`}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`text-small px-6 py-2 rounded-full ${
                  isActive
                    ? 'bg-brand-andaman text-on-dark-text'
                    : 'bg-surface-ivory text-text-stone border border-border-line'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export interface AccordionItem {
  id: string;
  title: string;
  content: React.ReactNode;
}

export interface AccordionProps {
  items: AccordionItem[];
  allowMultiple?: boolean;
}

export function Accordion({ items, allowMultiple = false }: AccordionProps) {
  const [openIds, setOpenIds] = useState<string[]>([]);

  const toggle = (id: string) => {
    if (allowMultiple) {
      setOpenIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
    } else {
      setOpenIds((prev) => (prev.includes(id) ? [] : [id]));
    }
  };

  return (
    <div className="flex flex-col divide-y divide-border-line border border-border-line rounded-lg overflow-hidden bg-surface-paper">
      {items.map((item) => {
        const isOpen = openIds.includes(item.id);
        return (
          <div key={item.id} className="transition-colors">
            <button
              type="button"
              onClick={() => toggle(item.id)}
              className="w-full p-16 sm:p-20 text-left font-display font-semibold text-subtitle text-text-ink flex items-center justify-between gap-16 hover:bg-surface-ivory/50 transition-colors"
            >
              <span>{item.title}</span>
              <span className={`transform transition-transform duration-structural ${isOpen ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>
            {isOpen && <div className="p-16 sm:p-20 pt-0 text-body text-text-stone">{item.content}</div>}
          </div>
        );
      })}
    </div>
  );
}
