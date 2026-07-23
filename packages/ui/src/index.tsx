import {
  useEffect,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type PropsWithChildren,
  type ReactNode,
} from 'react';

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
  tone?: 'primary' | 'secondary' | 'ghost' | 'danger';
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

export function InlineAlert({
  title,
  tone = 'info',
  children,
}: PropsWithChildren<{ title: string; tone?: 'info' | 'success' | 'warning' | 'danger' }>) {
  return (
    <section className={`ui-alert ui-alert--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <strong>{title}</strong>
      <div>{children}</div>
    </section>
  );
}

export function Dialog({
  open,
  title,
  description,
  children,
  footer,
  onClose,
}: PropsWithChildren<{
  open: boolean;
  title: string;
  description?: string | undefined;
  footer?: ReactNode | undefined;
  onClose(): void;
}>) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;
  return (
    <div className="ui-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-describedby={description ? 'ui-dialog-description' : undefined}
        aria-labelledby="ui-dialog-title"
        aria-modal="true"
        className="ui-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="ui-dialog__header">
          <div>
            <h2 id="ui-dialog-title">{title}</h2>
            {description ? <p id="ui-dialog-description">{description}</p> : null}
          </div>
          <button aria-label="关闭对话框" className="ui-dialog__close" onClick={onClose}>
            关闭
          </button>
        </header>
        <div className="ui-dialog__body">{children}</div>
        {footer ? <footer className="ui-dialog__footer">{footer}</footer> : null}
      </section>
    </div>
  );
}
