import { Coffee } from 'lucide-react';

import { PlaceholderPanel } from '../../components/panels/PlaceholderPanel';

export function JavaPage() {
  return (
    <PlaceholderPanel
      title="Java/Android Runtime"
      description="Browse Java classes, hook methods, and trace execution."
      icon={<Coffee size={48} strokeWidth={1} />}
    />
  );
}
