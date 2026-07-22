import type { ButtonHTMLAttributes, HTMLAttributes, PropsWithChildren, ReactNode } from 'react';

type CardProps = PropsWithChildren<
  HTMLAttributes<HTMLElement> & {
    title?: string;
    action?: ReactNode;
  }
>;

export function Card({ title, action, children, className = '', ...props }: CardProps) {
  return (
    <section className={`ui-card ${className}`.trim()} {...props}>
      {(title || action) && (
        <header className="ui-card__header">
          {title && <h2>{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'primary' | 'secondary' | 'ghost';
};

export function Button({ tone = 'primary', className = '', ...props }: ButtonProps) {
  return <button className={`ui-button ui-button--${tone} ${className}`.trim()} {...props} />;
}

export function Badge({ children, tone = 'neutral' }: PropsWithChildren<{ tone?: string }>) {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="ui-empty">
      <span aria-hidden="true">◇</span>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}
