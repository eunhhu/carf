import type { ComponentProps } from 'react';

import { AttachPanel } from '../../components/panels/AttachPanel';

type AttachPageProps = ComponentProps<typeof AttachPanel>;

export function AttachPage(props: AttachPageProps) {
  return <AttachPanel {...props} />;
}
