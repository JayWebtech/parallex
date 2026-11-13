import { CircleCheck, Clock, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/** Status carried by icon and label, never by color alone. */
export function StatusBadge({ status }: { status: 'active' | 'pending' | 'removed' }) {
  if (status === 'active') {
    return (
      <Badge variant="outline">
        <CircleCheck data-icon="inline-start" className="text-success" />
        Active
      </Badge>
    );
  }
  if (status === 'pending') {
    return (
      <Badge variant="outline" className="bg-warning-surface">
        <Clock data-icon="inline-start" className="text-warning" />
        Awaiting approval
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      <Trash2 data-icon="inline-start" />
      Removed
    </Badge>
  );
}
