import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { restoreStore, snapshotStore } from "~/lib/store-snapshot";
import { invoke } from "~/lib/tauri";

interface ScriptTemplate {
	name: string;
	description: string;
	code: string;
}

interface ScriptState {
	code: string;
	loaded: boolean;
	loading: boolean;
	error: string | null;
	scriptPath: string | null;
	templates: ScriptTemplate[];
}

const DEFAULT_TEMPLATES: ScriptTemplate[] = [
	{
		name: "SSL Pinning Bypass",
		description: "Bypass SSL certificate pinning",
		code: `// SSL Pinning Bypass
Java.perform(function() {
  var TrustManager = Java.registerClass({
    name: "carf.TrustManager",
    implements: [Java.use("javax.net.ssl.X509TrustManager")],
    methods: {
      checkClientTrusted: function(chain, authType) {},
      checkServerTrusted: function(chain, authType) {},
      getAcceptedIssuers: function() { return []; }
    }
  });
  var SSLContext = Java.use("javax.net.ssl.SSLContext");
  var ctx = SSLContext.getInstance("TLS");
  ctx.init(null, [TrustManager.$new()], null);
  SSLContext.setDefault(ctx);
  send({ type: "log", data: "SSL Pinning bypassed" });
});`,
	},
	{
		name: "Root Detection Bypass",
		description: "Bypass common root detection checks",
		code: `// Root Detection Bypass
Java.perform(function() {
  var RootBeer = Java.use("com.scottyab.rootbeer.RootBeer");
  RootBeer.isRooted.implementation = function() {
    send({ type: "log", data: "Root detection bypassed" });
    return false;
  };
});`,
	},
	{
		name: "Method Trace",
		description: "Trace all method calls in a class",
		code: `// Method Trace
var className = "com.example.TargetClass";
Java.perform(function() {
  var clazz = Java.use(className);
  var methods = clazz.class.getDeclaredMethods();
  methods.forEach(function(method) {
    var name = method.getName();
    try {
      clazz[name].overloads.forEach(function(overload) {
        overload.implementation = function() {
          send({ type: "hook:enter", data: { target: className + "." + name, args: Array.from(arguments) }});
          return this[name].apply(this, arguments);
        };
      });
    } catch(e) {}
  });
});`,
	},
];

const DEFAULT_STATE: ScriptState = {
	code: "",
	loaded: false,
	loading: false,
	error: null,
	scriptPath: null,
	templates: DEFAULT_TEMPLATES,
};

const [state, setState] = createStore<ScriptState>({
	...DEFAULT_STATE,
});

const [editorDirty, setEditorDirty] = createSignal(false);

function setCode(code: string): void {
	setState("code", code);
	setEditorDirty(true);
}

function setLoaded(loaded: boolean): void {
	setState({ loaded, loading: false, error: null });
	setEditorDirty(false);
}

function setLoading(loading: boolean): void {
	setState("loading", loading);
}

function setError(error: string | null): void {
	setState({ error, loading: false });
}

function setScriptPath(path: string | null): void {
	setState("scriptPath", path);
}

function loadTemplate(index: number): void {
	const template = state.templates[index];
	if (template) {
		setState("code", template.code);
		setEditorDirty(true);
	}
}

// ─── RPC Functions ───

async function loadScript(sessionId: string, code: string): Promise<void> {
	setLoading(true);
	try {
		await invoke("rpc_call", {
			sessionId,
			method: "loadScript",
			params: { code },
		});
		setLoaded(true);
	} catch (e) {
		const error = e instanceof Error ? e.message : String(e);
		setError(error);
		throw e;
	}
}

async function unloadScript(sessionId: string): Promise<void> {
	try {
		await invoke("rpc_call", {
			sessionId,
			method: "unloadScript",
			params: {},
		});
		setLoaded(false);
	} catch (e) {
		console.error("unloadScript failed:", e);
		throw e;
	}
}

async function reloadScript(sessionId: string): Promise<void> {
	await unloadScript(sessionId);
	await loadScript(sessionId, state.code);
}

function resetScriptState(): void {
	setState(restoreStore(DEFAULT_STATE));
	setEditorDirty(false);
}

function snapshotScriptState(): {
	state: ScriptState;
	editorDirty: boolean;
} {
	return {
		state: snapshotStore(state),
		editorDirty: editorDirty(),
	};
}

function restoreScriptState(snapshot?: {
	state: ScriptState;
	editorDirty: boolean;
}): void {
	if (!snapshot) {
		resetScriptState();
		return;
	}

	setState(
		restoreStore({
			...snapshot.state,
			templates: DEFAULT_TEMPLATES,
		}),
	);
	setEditorDirty(snapshot.editorDirty);
}

export {
	state as scriptState,
	editorDirty,
	setCode,
	setLoaded,
	setLoading as setScriptLoading,
	setError as setScriptError,
	setScriptPath,
	loadTemplate,
	loadScript,
	unloadScript,
	reloadScript,
	resetScriptState,
	snapshotScriptState,
	restoreScriptState,
};
