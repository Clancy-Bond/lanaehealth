'use client';

import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center py-8 px-4 fade-scale-enter">
      {icon && (
        <div className="text-5xl mb-3" style={{ fontSize: 48 }}>
          {icon}
        </div>
      )}
      <h3
        className="text-lg font-semibold"
        style={{ color: 'var(--text-primary)' }}
      >
        {title}
      </h3>
      {subtitle && (
        <p
          className="text-sm mt-1 max-w-xs"
          style={{ color: 'var(--text-secondary)' }}
        >
          {subtitle}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-5 py-2 rounded-full text-sm font-medium text-white transition-colors"
          style={{ background: 'var(--accent-sage)' }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
