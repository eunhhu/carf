import type { ComponentProps } from 'react';

import { MethodsPanel } from '../../components/panels/MethodsPanel';

type MethodsPageProps = ComponentProps<typeof MethodsPanel>;

export function MethodsPage(props: MethodsPageProps) {
  return <MethodsPanel {...props} />;
}
