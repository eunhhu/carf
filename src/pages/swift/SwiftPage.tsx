import { Apple } from 'lucide-react';

import { PlaceholderPanel } from '../../components/panels/PlaceholderPanel';

export function SwiftPage() {
  return (
    <PlaceholderPanel
      title="Swift Runtime"
      description="Inspect Swift types, protocols, and metadata."
      icon={<Apple size={48} strokeWidth={1} />}
    />
  );
}
