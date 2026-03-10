import { For, Show, createEffect } from "solid-js";
import {
  javaState,
  filteredJavaClasses,
  javaSearchQuery,
  setJavaSearchQuery,
  selectJavaClass,
  javaSubTab,
  setJavaSubTab,
  checkJavaAvailable,
  fetchJavaClasses,
  fetchJavaMethods,
  fetchJavaFields,
  fetchJavaInstances,
  hookJavaMethod,
} from "./java.store";
import { cn } from "~/lib/cn";
import { activeSession } from "~/features/session/session.store";

function JavaTab() {
  createEffect(() => {
    const session = activeSession();
    if (session) {
      checkJavaAvailable(session.id).then(() => {
        if (javaState.available) {
          fetchJavaClasses(session.id);
        }
      });
    }
  });

  return (
    <div class="flex h-full flex-col">
      {/* Header */}
      <div class="flex items-center justify-between border-b px-4 py-2">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold">Java</span>
          <Show when={javaState.available === false}>
            <span class="rounded bg-warning/10 px-1.5 py-0.5 text-xs text-warning">
              Not Available
            </span>
          </Show>
          <Show when={javaState.available === true}>
            <span class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {javaState.classes.length} classes
            </span>
          </Show>
        </div>
        <input
          type="text"
          class="rounded border bg-background px-2 py-1 text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
          placeholder="Search classes..."
          value={javaSearchQuery()}
          onInput={(e) => setJavaSearchQuery(e.currentTarget.value)}
        />
      </div>

      {/* Split: Class tree (40%) + Detail (60%) */}
      <div class="flex flex-1 overflow-hidden">
        {/* Class list */}
        <div class="w-[40%] overflow-auto border-r">
          <Show
            when={!javaState.classesLoading}
            fallback={
              <div class="flex h-32 items-center justify-center text-xs text-muted-foreground">
                Loading classes...
              </div>
            }
          >
            <For each={filteredJavaClasses()}>
              {(className) => {
                const isSelected = () => javaState.selectedClass === className;
                return (
                  <button
                    class={cn(
                      "flex w-full items-center px-3 py-1 text-left font-mono text-xs transition-colors hover:bg-surface-hover",
                      isSelected() && "bg-muted",
                    )}
                    onClick={() => {
                      selectJavaClass(className);
                      const session = activeSession();
                      if (session) {
                        fetchJavaMethods(session.id, className);
                        fetchJavaFields(session.id, className);
                      }
                    }}
                  >
                    <span class="truncate">{className}</span>
                  </button>
                );
              }}
            </For>
          </Show>
        </div>

        {/* Class detail */}
        <div class="w-[60%] overflow-auto">
          <Show
            when={javaState.selectedClass}
            fallback={
              <div class="flex h-full items-center justify-center text-xs text-muted-foreground">
                Select a class to view details
              </div>
            }
          >
            <div class="p-4">
              <h3 class="mb-3 truncate font-mono text-sm font-semibold">
                {javaState.selectedClass}
              </h3>

              {/* Sub-tabs */}
              <div class="flex gap-2 border-b pb-2 text-xs">
                <For each={["methods", "fields", "instances"] as const}>
                  {(tab) => (
                    <button
                      class={cn(
                        "rounded px-2 py-0.5 capitalize",
                        javaSubTab() === tab
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => setJavaSubTab(tab)}
                    >
                      {tab}
                      <Show when={tab === "instances"}>
                        <span class="ml-1 text-[10px] text-primary">(heap)</span>
                      </Show>
                    </button>
                  )}
                </For>
              </div>

              {/* Methods */}
              <Show when={javaSubTab() === "methods"}>
                <div class="mt-2">
                  <For each={javaState.methods}>
                    {(method) => (
                      <div class="flex items-center gap-2 py-0.5 text-xs">
                        <Show when={method.hooked}>
                          <span class="rounded bg-primary/10 px-1 text-[10px] text-primary">
                            H
                          </span>
                        </Show>
                        <span class="text-muted-foreground">
                          {method.returnType}
                        </span>
                        <span class="font-mono font-medium">{method.name}</span>
                        <span class="text-muted-foreground">
                          ({method.argumentTypes.join(", ")})
                        </span>
                        <button
                          class="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] hover:bg-primary/10 hover:text-primary"
                          onClick={() => {
                            const session = activeSession();
                            if (session && javaState.selectedClass) {
                              hookJavaMethod(session.id, javaState.selectedClass, method.name);
                            }
                          }}
                        >
                          Hook
                        </button>
                      </div>
                    )}
                  </For>
                  <Show when={javaState.methods.length === 0 && !javaState.detailLoading}>
                    <div class="py-4 text-center text-xs text-muted-foreground">
                      No methods loaded
                    </div>
                  </Show>
                </div>
              </Show>

              {/* Instances */}
              <Show when={javaSubTab() === "instances"}>
                <div class="mt-2">
                  <div class="mb-2 text-xs text-muted-foreground">
                    Heap instances via Java.choose()
                  </div>
                  <For each={javaState.instances}>
                    {(instance, idx) => (
                      <div class="py-0.5 font-mono text-xs">
                        [{idx()}] {String(instance)}
                      </div>
                    )}
                  </For>
                  <Show when={javaState.instances.length === 0}>
                    <button
                      class="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90"
                      onClick={() => {
                        const session = activeSession();
                        if (session && javaState.selectedClass) {
                          fetchJavaInstances(session.id, javaState.selectedClass);
                        }
                      }}
                    >
                      Enumerate Instances
                    </button>
                  </Show>
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}

export default JavaTab;
