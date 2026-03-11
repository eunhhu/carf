import { createStore } from "solid-js/store";
import { restoreStore, snapshotStore } from "~/lib/store-snapshot";
import { invoke } from "~/lib/tauri";
import type { ApiResolveResult, ResolvedSymbolInfo } from "~/lib/types";

interface ResolverState {
	results: ApiResolveResult[];
	loading: boolean;
	lastQuery: string;
}

const DEFAULT_STATE: ResolverState = {
	results: [],
	loading: false,
	lastQuery: "",
};

const [resolverState, setResolverState] = createStore<ResolverState>({
	...DEFAULT_STATE,
});

async function resolveApi(
	sessionId: string,
	query: string,
	type: "module" | "objc" | "swift" = "module",
): Promise<void> {
	setResolverState({ loading: true, lastQuery: query });
	try {
		const result = await invoke<ApiResolveResult[]>("rpc_call", {
			sessionId,
			method: "resolveApi",
			params: { query, type },
		});
		setResolverState({ results: result, loading: false });
	} catch (e) {
		setResolverState({ loading: false });
		throw e;
	}
}

async function resolveSymbol(
	sessionId: string,
	address: string,
): Promise<ResolvedSymbolInfo> {
	const result = await invoke<ResolvedSymbolInfo>("rpc_call", {
		sessionId,
		method: "resolveSymbol",
		params: { address },
	});
	return result;
}

async function findSymbol(
	sessionId: string,
	name: string,
): Promise<ApiResolveResult[]> {
	const result = await invoke<ApiResolveResult[]>("rpc_call", {
		sessionId,
		method: "findSymbolByName",
		params: { name },
	});
	return result;
}

function clearResults(): void {
	setResolverState({ results: [], lastQuery: "" });
}

function snapshotResolverState(): ResolverState {
	return snapshotStore(resolverState);
}

function restoreResolverState(snapshot?: ResolverState): void {
	setResolverState(restoreStore(snapshot ?? DEFAULT_STATE));
}

export {
	resolverState,
	resolveApi,
	resolveSymbol,
	findSymbol,
	clearResults,
	snapshotResolverState,
	restoreResolverState,
};
