import type { ComponentProps } from 'react';

import { NativePanel } from '../../components/panels/NativePanel';

type NativePageProps = ComponentProps<typeof NativePanel>;

export function NativePage(props: NativePageProps) {
  return <NativePanel {...props} />;
}
