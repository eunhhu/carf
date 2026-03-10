// RPC request/response protocol types
interface RpcRequest {
  method: string;
  params?: unknown;
}

interface RpcResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Agent event protocol - sent via send()
interface AgentEvent {
  type: string;      // event type identifier
  timestamp: number; // Date.now()
  data: unknown;     // event-specific payload
}

// Handler function type
type RpcHandler = (params: unknown) => unknown | Promise<unknown>;

export { RpcRequest, RpcResponse, AgentEvent, RpcHandler };
