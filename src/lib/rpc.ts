interface RpcSuccess<T> {
	success: true;
	data: T;
}

interface RpcFailure {
	success: false;
	error: string;
}

type RpcEnvelope<T> = RpcSuccess<T> | RpcFailure;

function isRpcEnvelope(value: unknown): value is RpcEnvelope<unknown> {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	return (
		"success" in value &&
		typeof (value as { success: unknown }).success === "boolean"
	);
}

export function unwrapRpcResult<T>(value: T | RpcEnvelope<T>): T {
	if (!isRpcEnvelope(value)) {
		return value as T;
	}

	if (!value.success) {
		throw new Error(value.error);
	}

	return value.data;
}
