'use client';

interface SkeletonProps {
  variant?: 'text' | 'circle' | 'rect' | 'card';
  width?: string | number;
  height?: string | number;
  className?: string;
}

export default function Skeleton({
  variant = 'text',
  width,
  height,
  className = '',
}: SkeletonProps) {
  const baseStyle: React.CSSProperties = {
    background: 'var(--bg-elevated)',
    animation: 'skeleton-pulse 1.5s ease-in-out infinite',
  };

  if (variant === 'text') {
    return (
      <div
        className={`rounded-lg ${className}`}
        style={{
          ...baseStyle,
          width: width ?? '100%',
          height: height ?? 16,
        }}
      />
    );
  }

  if (variant === 'circle') {
    return (
      <div
        className={className}
        style={{
          ...baseStyle,
          width: width ?? 40,
          height: height ?? 40,
          borderRadius: '50%',
        }}
      />
    );
  }

  if (variant === 'rect') {
    return (
      <div
        className={`rounded-xl ${className}`}
        style={{
          ...baseStyle,
          width: width ?? '100%',
          height: height ?? 120,
        }}
      />
    );
  }

  // card
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{
        ...baseStyle,
        width: width ?? '100%',
        height: height ?? 160,
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)',
      }}
    />
  );
}
