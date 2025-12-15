import { useState } from "react";
import { Code, Play, Trash2 } from "lucide-react";
import {
  PageContainer,
  PageHeader,
  PageTitle,
  PageContent,
  Flex,
  Text,
  Card,
  Badge,
  Code as CodeText,
} from "../../components/ui/Layout";
import { Button, IconButton } from "../../components/ui/Button";
import { Input, TextArea, FormGroup, Label } from "../../components/ui/Input";
import { EmptyState } from "../../components/ui/Table";

// ============================================================================
// Types
// ============================================================================

export interface MethodsPageProps {
  hasSession: boolean;
  onRpcCall: (method: string, params?: unknown) => Promise<unknown>;
}

// ============================================================================
// Component
// ============================================================================

export function MethodsPage({ hasSession, onRpcCall }: MethodsPageProps) {
  const [method, setMethod] = useState("");
  const [params, setParams] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ method: string; params: string; result: string }[]>([]);

  const handleCall = async () => {
    if (!method.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let parsedParams: unknown = undefined;
      if (params.trim()) {
        parsedParams = JSON.parse(params);
      }

      const res = await onRpcCall(method, parsedParams);
      const resultStr = JSON.stringify(res, null, 2);
      setResult(resultStr);
      setHistory((prev) => [
        { method, params, result: resultStr },
        ...prev.slice(0, 19),
      ]);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadFromHistory = (item: { method: string; params: string }) => {
    setMethod(item.method);
    setParams(item.params);
  };

  if (!hasSession) {
    return (
      <PageContainer>
        <EmptyState style={{ height: "100%" }}>
          <Code size={48} />
          <Text $size="lg" $color="muted">No active session</Text>
          <Text $color="muted">Attach to a process to make RPC calls</Text>
        </EmptyState>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader>
        <Flex $align="center" $gap="12px">
          <Code size={18} />
          <PageTitle>RPC Methods</PageTitle>
        </Flex>
      </PageHeader>

      <PageContent>
        <Flex $gap="16px" style={{ height: "100%" }}>
          {/* Main panel */}
          <Flex $direction="column" $gap="16px" style={{ flex: 1 }}>
            <Card $padding="16px">
              <FormGroup style={{ marginBottom: 12 }}>
                <Label>Method Name</Label>
                <Input
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  placeholder="enumerate_modules"
                  inputSize="sm"
                />
              </FormGroup>

              <FormGroup style={{ marginBottom: 12 }}>
                <Label>Parameters (JSON)</Label>
                <TextArea
                  value={params}
                  onChange={(e) => setParams(e.target.value)}
                  placeholder='{"moduleName": "libc.so"}'
                  inputSize="sm"
                  style={{ minHeight: 80 }}
                />
              </FormGroup>

              <Button
                variant="primary"
                onClick={handleCall}
                disabled={loading || !method.trim()}
                leftIcon={Play}
              >
                {loading ? "Calling..." : "Call"}
              </Button>
            </Card>

            {/* Result */}
            {(result || error) && (
              <Card $padding="16px" style={{ flex: 1, overflow: "auto" }}>
                <Flex $justify="between" $align="center" style={{ marginBottom: 8 }}>
                  <Text $weight="semibold">Result</Text>
                  {error ? (
                    <Badge $variant="error">Error</Badge>
                  ) : (
                    <Badge $variant="success">Success</Badge>
                  )}
                </Flex>
                <pre
                  style={{
                    margin: 0,
                    padding: 12,
                    background: "var(--bg-primary)",
                    borderRadius: 6,
                    overflow: "auto",
                    fontSize: 12,
                    fontFamily: "'SF Mono', 'Consolas', monospace",
                    color: error ? "var(--status-error)" : "var(--text-primary)",
                  }}
                >
                  {error || result}
                </pre>
              </Card>
            )}
          </Flex>

          {/* History sidebar */}
          <Card $padding="12px" style={{ width: 280, overflow: "auto" }}>
            <Flex $justify="between" $align="center" style={{ marginBottom: 12 }}>
              <Text $weight="semibold" $size="sm">History</Text>
              <IconButton
                icon={Trash2}
                size="xs"
                onClick={() => setHistory([])}
                tooltip="Clear history"
                disabled={history.length === 0}
              />
            </Flex>

            {history.length === 0 ? (
              <Text $color="muted" $size="sm">No history yet</Text>
            ) : (
              <Flex $direction="column" $gap="8px">
                {history.map((item, i) => (
                  <Card
                    key={i}
                    $padding="8px"
                    style={{ cursor: "pointer" }}
                    onClick={() => loadFromHistory(item)}
                  >
                    <CodeText style={{ fontSize: 11 }}>{item.method}</CodeText>
                  </Card>
                ))}
              </Flex>
            )}
          </Card>
        </Flex>
      </PageContent>
    </PageContainer>
  );
}
