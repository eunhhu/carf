import { For, Show, onMount } from "solid-js";
import {
  moduleState,
  filteredModules,
  moduleSearchQuery,
  setModuleSearchQuery,
  selectModule,
  selectedModuleInfo,
  fetchModules,
  fetchModuleExports,
} from "./module.store";
import { activeSession } from "~/features/session/session.store";
import { cn } from "~/lib/cn";
import { formatAddress, formatSize } from "~/lib/format";

function ModulesTab() {
  onMount(() => {
    const session = activeSession();
    if (session) {
      void fetchModules(session.id);
    }
  });

  function handleSelectModule(name: string): void {
    selectModule(name);
    const session = activeSession();
    if (session) {
      void fetchModuleExports(session.id, name);
    }
  }

  return (
    <div class="flex h-full flex-col">
      {/* Header */}
      <div class="flex items-center justify-between border-b px-4 py-2">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold">Modules</span>
          <span class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {moduleState.modules.length}
          </span>
        </div>
        <input
          type="text"
          class="rounded border bg-background px-2 py-1 text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
          placeholder="Search modules..."
          value={moduleSearchQuery()}
          onInput={(e) => setModuleSearchQuery(e.currentTarget.value)}
        />
      </div>

      {/* Split view: Module list (40%) + Detail (60%) */}
      <div class="flex flex-1 overflow-hidden">
        {/* Module list */}
        <div class="w-[40%] overflow-auto border-r">
          <Show
            when={!moduleState.loading}
            fallback={
              <div class="flex h-32 items-center justify-center text-xs text-muted-foreground">
                Loading modules...
              </div>
            }
          >
            <For each={filteredModules()}>
              {(mod) => {
                const isSelected = () =>
                  moduleState.selectedModule === mod.name;
                return (
                  <button
                    class={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-surface-hover",
                      isSelected() && "bg-muted",
                    )}
                    onClick={() => handleSelectModule(mod.name)}
                  >
                    <span class="shrink-0 font-mono text-muted-foreground">
                      {formatAddress(mod.base)}
                    </span>
                    <span class="flex-1 truncate">{mod.name}</span>
                    <span class="shrink-0 text-muted-foreground">
                      {formatSize(mod.size)}
                    </span>
                  </button>
                );
              }}
            </For>
          </Show>
        </div>

        {/* Module detail */}
        <div class="w-[60%] overflow-auto">
          <Show
            when={selectedModuleInfo()}
            fallback={
              <div class="flex h-full items-center justify-center text-xs text-muted-foreground">
                Select a module to view details
              </div>
            }
          >
            {(mod) => (
              <div class="p-4">
                <h3 class="mb-2 text-sm font-semibold">{mod().name}</h3>
                <div class="mb-4 space-y-1 text-xs">
                  <div class="flex gap-2">
                    <span class="w-14 text-muted-foreground">Base:</span>
                    <span class="font-mono">{formatAddress(mod().base)}</span>
                  </div>
                  <div class="flex gap-2">
                    <span class="w-14 text-muted-foreground">Size:</span>
                    <span>{formatSize(mod().size)}</span>
                  </div>
                  <div class="flex gap-2">
                    <span class="w-14 text-muted-foreground">Path:</span>
                    <span class="break-all">{mod().path}</span>
                  </div>
                </div>

                {/* Sub-tabs: Exports, Imports, Symbols, Sections */}
                <div class="border-t pt-3">
                  <div class="flex gap-2 text-xs text-muted-foreground">
                    <button class="rounded bg-muted px-2 py-0.5 text-foreground">
                      Exports
                    </button>
                    <button class="rounded px-2 py-0.5 hover:text-foreground">
                      Imports
                    </button>
                    <button class="rounded px-2 py-0.5 hover:text-foreground">
                      Symbols
                    </button>
                    <button class="rounded px-2 py-0.5 hover:text-foreground">
                      Sections
                    </button>
                  </div>

                  {/* Exports list */}
                  <div class="mt-2">
                    <Show
                      when={!moduleState.exportsLoading}
                      fallback={
                        <div class="py-4 text-center text-xs text-muted-foreground">
                          Loading exports...
                        </div>
                      }
                    >
                      <For each={moduleState.exports}>
                        {(exp) => (
                          <div class="flex items-center gap-2 px-1 py-0.5 text-xs hover:bg-surface-hover">
                            <span class="shrink-0 font-mono text-muted-foreground">
                              {formatAddress(exp.address)}
                            </span>
                            <span
                              class={cn(
                                "shrink-0 rounded px-1 py-0.5 text-[10px]",
                                exp.type === "function"
                                  ? "bg-primary/10 text-primary"
                                  : "bg-warning/10 text-warning",
                              )}
                            >
                              {exp.type === "function" ? "fn" : "var"}
                            </span>
                            <span class="truncate font-mono">{exp.name}</span>
                          </div>
                        )}
                      </For>
                      <Show when={moduleState.exports.length === 0}>
                        <div class="py-4 text-center text-xs text-muted-foreground">
                          No exports loaded
                        </div>
                      </Show>
                    </Show>
                  </div>
                </div>
              </div>
            )}
          </Show>
        </div>
      </div>
    </div>
  );
}

export default ModulesTab;
