import React from 'react';
import Link from 'next/link';
import { WorkspaceContextLink } from '@/components/WorkspaceNavigation';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
  preserveWorkspace?: boolean;
}

export function Breadcrumb({ items, className = '', preserveWorkspace = false }: BreadcrumbProps) {
  const ItemLink = preserveWorkspace ? WorkspaceContextLink : Link;
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-8 text-small text-text-secondary py-12 px-24 bg-surface-ivory border-b border-border-line ${className}`}
    >
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span className="text-text-secondary">/</span>}
          {item.href && !item.current ? (
            <ItemLink
              href={item.href}
              className="text-brand-andaman hover:underline transition-colors"
            >
              {item.label}
            </ItemLink>
          ) : (
            <span className={item.current ? 'text-text-ink font-medium' : 'text-text-secondary'}>
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
