import type { ComponentProps } from 'react';

import { SettingsPanel } from '../../components/panels/SettingsPanel';

type SettingsPageProps = ComponentProps<typeof SettingsPanel>;

export function SettingsPage(props: SettingsPageProps) {
  return <SettingsPanel {...props} />;
}
