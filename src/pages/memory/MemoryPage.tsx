import type { ComponentProps } from 'react';

import { MemoryPanel } from '../../components/panels/MemoryPanel';

type MemoryPageProps = ComponentProps<typeof MemoryPanel>;

export function MemoryPage(props: MemoryPageProps) {
  return <MemoryPanel {...props} />;
}
