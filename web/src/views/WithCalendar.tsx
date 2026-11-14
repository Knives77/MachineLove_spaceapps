import type { ReactNode } from 'react';
import { ErrorBox, Skeleton } from '../components/ui';
import { useApp } from '../state';
import type { CalendarResponse } from '../types';

/** Esqueleto mientras carga; mensaje según `error.code` si la API falla. */
export function WithCalendar({
  children,
  skeleton,
}: {
  children: (data: CalendarResponse) => ReactNode;
  skeleton?: ReactNode;
}) {
  const { calendar, reload, t } = useApp();
  if (calendar.state === 'loading')
    return (
      <div role="status" aria-live="polite" className="h-full">
        <span className="sr-only">{t('loading')}</span>
        {skeleton ?? <Skeleton className="h-full min-h-40 w-full" />}
      </div>
    );
  if (calendar.state === 'error') return <ErrorBox code={calendar.code} onRetry={reload} />;
  return <>{children(calendar.data)}</>;
}
