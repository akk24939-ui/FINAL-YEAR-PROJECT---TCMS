import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  glass?: boolean
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  border?: boolean
  as?: React.ElementType
}

const paddingMap = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      className = '',
      glass = false,
      hover = false,
      padding = 'md',
      border = true,
      as: Tag = 'div',
    },
    ref
  ) => {
    return (
      <Tag
        ref={ref}
        className={[
          'rounded-card',
          glass
            ? 'bg-white/5 backdrop-blur-xl border border-white/10 dark:bg-dark-card/60 dark:border-white/8'
            : 'bg-white dark:bg-dark-card',
          border && !glass ? 'border border-gray-200 dark:border-dark-border' : '',
          hover ? 'card-hover cursor-pointer' : '',
          paddingMap[padding],
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {children}
      </Tag>
    )
  }
)

Card.displayName = 'Card'

export const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className={`mb-4 ${className}`}>
    {children}
  </div>
)

export const CardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <h3 className={`text-lg font-bold text-gray-900 dark:text-dark-text ${className}`}>
    {children}
  </h3>
)

export const CardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className={className}>
    {children}
  </div>
)

export default Card
