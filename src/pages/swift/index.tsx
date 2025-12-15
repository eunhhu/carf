import { Bird } from "lucide-react";
import {
  PageContainer,
  Text,
} from "../../components/ui/Layout";
import { EmptyState } from "../../components/ui/Table";

// ============================================================================
// Types
// ============================================================================

export interface SwiftPageProps {
  hasSession?: boolean;
  onRpcCall?: (method: string, params?: unknown) => Promise<unknown>;
}

// ============================================================================
// Component
// ============================================================================

export function SwiftPage({ hasSession = false }: SwiftPageProps) {
  return (
    <PageContainer>
      <EmptyState style={{ height: "100%" }}>
        <Bird size={48} />
        <Text $size="lg" $color="muted">Swift Runtime</Text>
        <Text $color="muted">
          {hasSession
            ? "Swift runtime inspection coming soon"
            : "Attach to an iOS/macOS process to use Swift features"}
        </Text>
      </EmptyState>
    </PageContainer>
  );
}
