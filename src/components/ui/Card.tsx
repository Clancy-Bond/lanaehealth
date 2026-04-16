'use client';

import React from 'react';

interface CardProps {
  variant?: 'default' | 'elevated' | 'interactive' | 'accent-sage' | 'accent-blush';
  padding?: 'sm' | 'md' | 'lg';
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

const paddingMap = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export default function Card({
  variant = 'default',
  padding = 'md',
  className = '',
  children,
  onClick,
}: CardProps) {
  const padClass = paddingMap[padding];

  const variantClasses: Record<string, string> = {
    default: 'card',
    elevated: 'card-elevated',
    interactive: 'card card-interactive cursor-pointer',
    'accent-sage': 'card card-accent-sage',
    'accent-blush': 'card card-accent-blush',
  };

  const classes = `${variantClasses[variant]} ${padClass} ${className}`.trim();

  return (
    <div
      className={classes}
      onClick={variant === 'interactive' ? onClick : undefined}
      role={variant === 'interactive' ? 'button' : undefined}
      tabIndex={variant === 'interactive' ? 0 : undefined}
      onKeyDown={
        variant === 'interactive'
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
