import { GitBranch } from 'lucide-react';

import { PlaceholderPanel } from '../../components/panels/PlaceholderPanel';

export function ObjcPage() {
  return (
    <PlaceholderPanel
      title="Objective-C Runtime"
      description="Explore Objective-C classes, methods, and runtime information."
      icon={<GitBranch size={48} strokeWidth={1} />}
    />
  );
}
