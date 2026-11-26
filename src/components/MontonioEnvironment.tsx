import { useServerFn } from '@tanstack/react-start';
import { useQuery } from '@tanstack/react-query';
import { getMontonioEnvironment } from '@/lib/montonio-settings.functions';
import { Badge } from '@/components/ui/badge';

export function MontonioEnvironment() {
  const getEnvironment = useServerFn(getMontonioEnvironment);
  const { data, isError } = useQuery({
    queryKey: ['montonio-environment'],
    queryFn: () => getEnvironment(),
    staleTime: 0,
    retry: false,
  });
  return (
    <div className="flex flex-wrap items-center gap-2" role="status">
      <span>Mokėjimai: Montonio ·</span>
      {data ? (
        <Badge className={data.environment === 'production'
          ? 'border-transparent bg-success/15 text-success'
          : 'border-transparent bg-warning/15 text-warning'}>
          {data.environment === 'production' ? 'Gamybinė aplinka (Live)' : 'Testinė aplinka (Sandbox)'}
        </Badge>
      ) : <span className={isError ? 'text-destructive' : 'text-muted-foreground'}>
        {isError ? 'Nepavyko nustatyti aplinkos' : 'Tikrinama aplinka…'}
      </span>}
    </div>
  );
}
