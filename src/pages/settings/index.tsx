import { Settings, Info, Palette, Sliders, Terminal } from "lucide-react";
import {
  PageContainer,
  PageHeader,
  PageTitle,
  PageContent,
  Flex,
  Text,
  Card,
  Section,
  SectionTitle,
  Divider,
  Badge,
} from "../../components/ui/Layout";
import { Select, FormGroup, Label } from "../../components/ui/Input";
import { Tabs, TabPanel, useTabs } from "../../components/ui/Tabs";
import { Button } from "../../components/ui/Button";
import {
  useSettingsStore,
  type ThemeMode,
  type FontSize,
} from "../../stores/settingsStore";
import { useTheme } from "../../contexts/ThemeContext";

// ============================================================================
// Types
// ============================================================================

export interface SettingsPageProps {
  fridaVersion: string;
}

// ============================================================================
// Component
// ============================================================================

export function SettingsPage({ fridaVersion }: SettingsPageProps) {
  const tabs = useTabs("general");

  // Settings store
  const {
    theme: themeSetting,
    fontSize,
    rpcTimeout,
    autoRefreshInterval,
    maxLogEntries,
    showTimestamps,
    defaultReadSize,
    hexColumns,
    debugMode,
    setTheme,
    setFontSize,
    setRpcTimeout,
    setAutoRefreshInterval,
    setMaxLogEntries,
    setShowTimestamps,
    setDefaultReadSize,
    setHexColumns,
    setDebugMode,
    resetSettings,
  } = useSettingsStore();

  // Theme context for toggling
  const { theme: effectiveTheme } = useTheme();

  const tabItems = [
    { id: "general", label: "General", icon: Sliders },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "console", label: "Console", icon: Terminal },
    { id: "about", label: "About", icon: Info },
  ];

  return (
    <PageContainer>
      <PageHeader>
        <Flex $align="center" $gap="12px">
          <Settings size={18} />
          <PageTitle>Settings</PageTitle>
        </Flex>
      </PageHeader>

      <PageContent>
        {/* Horizontal tabs at top */}
        <Tabs
          items={tabItems}
          value={tabs.value}
          onChange={tabs.onChange}
          size="md"
          variant="default"
        />

        {/* Content */}
        <Flex $direction="column" $gap="24px" style={{ flex: 1, maxWidth: 600, marginTop: 16, overflow: 'auto' }}>
            <TabPanel value="general" activeTab={tabs.value}>
              <Section $gap="16px">
                <SectionTitle>General Settings</SectionTitle>

                <Card $padding="16px">
                  <FormGroup>
                    <Label>RPC Timeout (ms)</Label>
                    <Select
                      inputSize="sm"
                      value={rpcTimeout.toString()}
                      onChange={(e) => setRpcTimeout(parseInt(e.target.value))}
                    >
                      <option value="5000">5000</option>
                      <option value="10000">10000</option>
                      <option value="30000">30000</option>
                      <option value="60000">60000</option>
                    </Select>
                  </FormGroup>
                </Card>

                <Card $padding="16px">
                  <FormGroup>
                    <Label>Auto-refresh interval (ms)</Label>
                    <Select
                      inputSize="sm"
                      value={autoRefreshInterval.toString()}
                      onChange={(e) => setAutoRefreshInterval(parseInt(e.target.value))}
                    >
                      <option value="0">Disabled</option>
                      <option value="1000">1000</option>
                      <option value="5000">5000</option>
                      <option value="10000">10000</option>
                    </Select>
                  </FormGroup>
                </Card>

                <Card $padding="16px">
                  <FormGroup>
                    <Label>Default Memory Read Size</Label>
                    <Select
                      inputSize="sm"
                      value={defaultReadSize.toString()}
                      onChange={(e) => setDefaultReadSize(parseInt(e.target.value))}
                    >
                      <option value="64">64 bytes</option>
                      <option value="128">128 bytes</option>
                      <option value="256">256 bytes</option>
                      <option value="512">512 bytes</option>
                      <option value="1024">1024 bytes</option>
                    </Select>
                  </FormGroup>
                </Card>

                <Card $padding="16px">
                  <FormGroup>
                    <Label>Hex View Columns</Label>
                    <Select
                      inputSize="sm"
                      value={hexColumns.toString()}
                      onChange={(e) => setHexColumns(parseInt(e.target.value) as 16 | 32)}
                    >
                      <option value="16">16 columns</option>
                      <option value="32">32 columns</option>
                    </Select>
                  </FormGroup>
                </Card>

                <Card $padding="16px">
                  <FormGroup>
                    <Label>Debug Mode</Label>
                    <Select
                      inputSize="sm"
                      value={debugMode ? "true" : "false"}
                      onChange={(e) => setDebugMode(e.target.value === "true")}
                    >
                      <option value="false">Disabled</option>
                      <option value="true">Enabled</option>
                    </Select>
                  </FormGroup>
                </Card>
              </Section>
            </TabPanel>

            <TabPanel value="appearance" activeTab={tabs.value}>
              <Section $gap="16px">
                <SectionTitle>Appearance</SectionTitle>

                <Card $padding="16px">
                  <FormGroup>
                    <Label>Theme</Label>
                    <Select
                      inputSize="sm"
                      value={themeSetting}
                      onChange={(e) => setTheme(e.target.value as ThemeMode)}
                    >
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                      <option value="system">System</option>
                    </Select>
                    <Text $color="muted" $size="xs" style={{ marginTop: 4 }}>
                      Current: {effectiveTheme}
                    </Text>
                  </FormGroup>
                </Card>

                <Card $padding="16px">
                  <FormGroup>
                    <Label>Font Size</Label>
                    <Select
                      inputSize="sm"
                      value={fontSize.toString()}
                      onChange={(e) => setFontSize(parseInt(e.target.value) as FontSize)}
                    >
                      <option value="11">Small (11px)</option>
                      <option value="12">Medium (12px)</option>
                      <option value="13">Large (13px)</option>
                      <option value="14">Extra Large (14px)</option>
                    </Select>
                  </FormGroup>
                </Card>
              </Section>
            </TabPanel>

            <TabPanel value="console" activeTab={tabs.value}>
              <Section $gap="16px">
                <SectionTitle>Console Settings</SectionTitle>

                <Card $padding="16px">
                  <FormGroup>
                    <Label>Max Log Entries</Label>
                    <Select
                      inputSize="sm"
                      value={maxLogEntries.toString()}
                      onChange={(e) => setMaxLogEntries(parseInt(e.target.value))}
                    >
                      <option value="500">500</option>
                      <option value="1000">1000</option>
                      <option value="2000">2000</option>
                      <option value="5000">5000</option>
                      <option value="10000">10000</option>
                    </Select>
                  </FormGroup>
                </Card>

                <Card $padding="16px">
                  <FormGroup>
                    <Label>Show Timestamps</Label>
                    <Select
                      inputSize="sm"
                      value={showTimestamps ? "true" : "false"}
                      onChange={(e) => setShowTimestamps(e.target.value === "true")}
                    >
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </Select>
                  </FormGroup>
                </Card>
              </Section>
            </TabPanel>

            <TabPanel value="about" activeTab={tabs.value}>
              <Section $gap="16px">
                <SectionTitle>About CARF</SectionTitle>

                <Card $padding="16px">
                  <Flex $direction="column" $gap="12px">
                    <Flex $justify="between" $align="center">
                      <Text $color="muted">Application</Text>
                      <Text $weight="semibold">CARF</Text>
                    </Flex>
                    <Divider $margin="0" />
                    <Flex $justify="between" $align="center">
                      <Text $color="muted">Version</Text>
                      <Badge>0.1.0</Badge>
                    </Flex>
                    <Divider $margin="0" />
                    <Flex $justify="between" $align="center">
                      <Text $color="muted">Frida Version</Text>
                      <Badge $variant="primary">{fridaVersion || "Unknown"}</Badge>
                    </Flex>
                    <Divider $margin="0" />
                    <Flex $justify="between" $align="center">
                      <Text $color="muted">Platform</Text>
                      <Text>{navigator.platform}</Text>
                    </Flex>
                    <Divider $margin="0" />
                    <Flex $justify="between" $align="center">
                      <Text $color="muted">Theme</Text>
                      <Text>{effectiveTheme}</Text>
                    </Flex>
                  </Flex>
                </Card>

                <Card $padding="16px">
                  <Text $color="muted" $size="sm">
                    CARF (Cross-platform Application Runtime Framework) is a dynamic debugging GUI
                    built on Frida. It provides a modern interface for reverse engineering and
                    security research.
                  </Text>
                </Card>

                <Card $padding="16px">
                  <Flex $direction="column" $gap="12px">
                    <Text $weight="medium">Reset Settings</Text>
                    <Text $color="muted" $size="sm">
                      Reset all settings to their default values. This action cannot be undone.
                    </Text>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={resetSettings}
                      style={{ alignSelf: "flex-start" }}
                    >
                      Reset to Defaults
                    </Button>
                  </Flex>
                </Card>
              </Section>
            </TabPanel>
        </Flex>
      </PageContent>
    </PageContainer>
  );
}
