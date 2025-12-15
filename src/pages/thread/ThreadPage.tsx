import type { ComponentProps } from 'react';

import { ThreadPanel } from '../../components/panels/ThreadPanel';

type ThreadPageProps = ComponentProps<typeof ThreadPanel>;

export function ThreadPage(props: ThreadPageProps) {
  return <ThreadPanel {...props} />;
}
