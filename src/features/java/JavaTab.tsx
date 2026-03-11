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
import { hooksState, deleteHook } from "~/features/hooks/hooks.store";
import { cn } from "~/lib/cn";
import { activeSession } from "~/features/session/session.store";
import { SplitPane } from "~/components/SplitPane";
import { CopyButton } from "~/components/CopyButton";
import { InlineActions } from "~/components/InlineActions";
import {
  ActionPopover,
  buildClassActions,
} from "~/components/ActionPopover";
import { navigateTo } from "~/lib/navigation";
import type { JavaMethodInfo } from "~/lib/types";

function JavaTab() {
  createEffect(() => {
    const sessionId = activeSession()?.id;
    if (!sessionId) return;

    void (async () => {
      const available = await checkJavaAvailable(sessionId);
      if (available && activeSession()?.id === sessionId) {
        await fetchJavaClasses(sessionId);
      }
    })();
  });

  function getMethodSignature(method: JavaMethodInfo): string {
    return `${method.returnType} ${method.name}(${method.argumentTypes.join(", ")})`;
  }

  function findHookForMethod(className: string, methodName: string) {
    const target = `${className}.${methodName}`;
    return hooksState.hooks.find(
      (h) => h.type === "java" && h.target === target,
    );
  }

  function handleUnhook(className: string, methodName: string) {
    const session = activeSession();
    if (!session) return;
    const hook = findHookForMethod(className, methodName);
    if (hook) {
      deleteHook(session.id, hook);
    }
  }

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

      {/* Split: Class list + Detail */}
      <SplitPane
        id="java"
        minLeft={200}
        maxLeft={400}
        defaultLeft={280}
        left={
          <div class="h-full overflow-auto">
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
                  const isSelected = () =>
                    javaState.selectedClass === className;
                  return (
                    <button
                      class={cn(
                        "group/row flex w-full cursor-pointer items-center gap-1 px-3 py-1 text-left font-mono text-xs transition-colors hover:bg-surface-hover",
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
                      <ActionPopover
                        type="class"
                        value={className}
                        actions={buildClassActions(className, "java")}
                        class="truncate"
                      >
                        <span class="truncate" title={className}>
                          {className}
                        </span>
                      </ActionPopover>
                      <CopyButton
                        value={className}
                        class="ml-auto opacity-0 group-hover/row:opacity-100"
                      />
                    </button>
                  );
                }}
              </For>
            </Show>
          </div>
        }
        right={
          <div class="h-full overflow-auto">
            <Show
              when={javaState.selectedClass}
              fallback={
                <div class="flex h-full items-center justify-center text-xs text-muted-foreground">
                  Select a class to view details
                </div>
              }
            >
              <div class="p-4">
                <div class="mb-3 flex items-center gap-2">
                  <h3
                    class="truncate font-mono text-sm font-semibold"
                    title={javaState.selectedClass!}
                  >
                    {javaState.selectedClass}
                  </h3>
                  <CopyButton value={javaState.selectedClass!} />
                </div>

                {/* Sub-tabs */}
                <div class="flex gap-2 border-b pb-2 text-xs">
                  <For each={["methods", "fields", "instances"] as const}>
                    {(tab) => (
                      <button
                        class={cn(
                          "cursor-pointer rounded px-2 py-0.5 capitalize",
                          javaSubTab() === tab
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                        onClick={() => setJavaSubTab(tab)}
                      >
                        {tab}
                        <Show when={tab === "instances"}>
                          <span class="ml-1 text-[10px] text-primary">
                            (heap)
                          </span>
                        </Show>
                      </button>
                    )}
                  </For>
                </div>

                {/* Methods */}
                <Show when={javaSubTab() === "methods"}>
                  <div class="mt-2">
                    <For each={javaState.methods}>
                      {(method) => {
                        const sig = () => getMethodSignature(method);
                        const hooked = () => method.hooked;
                        return (
                          <div
                            class="group/row flex items-center gap-2 py-0.5 text-xs"
                            title={sig()}
                          >
                            <Show when={hooked()}>
                              <span class="rounded bg-primary/10 px-1 text-[10px] text-primary">
                                H
                              </span>
                            </Show>
                            <span class="text-muted-foreground">
                              {method.returnType}
                            </span>
                            <span class="font-mono font-medium">
                              {method.name}
                            </span>
                            <span class="text-muted-foreground">
                              ({method.argumentTypes.join(", ")})
                            </span>
                            <CopyButton
                              value={sig()}
                              class="opacity-0 group-hover/row:opacity-100"
                            />
                            <div class="ml-auto">
                              <InlineActions
                                primary={[
                                  hooked()
                                    ? {
                                        label: "Unhook",
                                        variant: "danger",
                                        onClick: (e: MouseEvent) => {
                                          e.stopPropagation();
                                          if (javaState.selectedClass) {
                                            handleUnhook(
                                              javaState.selectedClass,
                                              method.name,
                                            );
                                          }
                                        },
                                      }
                                    : {
                                        label: "Hook",
                                        variant: "primary",
                                        onClick: (e: MouseEvent) => {
                                          e.stopPropagation();
                                          const session = activeSession();
                                          if (
                                            session &&
                                            javaState.selectedClass
                                          ) {
                                            hookJavaMethod(
                                              session.id,
                                              javaState.selectedClass,
                                              method.name,
                                            );
                                          }
                                        },
                                      },
                                ]}
                                overflow={[
                                  {
                                    label: "Copy Method Signature",
                                    onClick: () => {
                                      navigator.clipboard.writeText(sig());
                                    },
                                  },
                                  {
                                    label: "View Hook Events",
                                    onClick: () => {
                                      navigateTo({ tab: "console" });
                                    },
                                  },
                                ]}
                              />
                            </div>
                          </div>
                        );
                      }}
                    </For>
                    <Show
                      when={
                        javaState.methods.length === 0 &&
                        !javaState.detailLoading
                      }
                    >
                      <div class="py-4 text-center text-xs text-muted-foreground">
                        No methods loaded
                      </div>
                    </Show>
                  </div>
                </Show>

                {/* Fields */}
                <Show when={javaSubTab() === "fields"}>
                  <div class="mt-2">
                    <For each={javaState.fields}>
                      {(field) => (
                        <div class="group/row flex items-center gap-2 py-0.5 text-xs">
                          <span class="text-muted-foreground">
                            {field.type}
                          </span>
                          <span class="font-mono font-medium">
                            {field.name}
                          </span>
                          <CopyButton
                            value={`${field.type} ${field.name}`}
                            class="opacity-0 group-hover/row:opacity-100"
                          />
                          <Show when={field.value !== undefined}>
                            <span class="ml-auto font-mono text-primary">
                              = {String(field.value)}
                            </span>
                          </Show>
                        </div>
                      )}
                    </For>
                    <Show
                      when={
                        javaState.fields.length === 0 &&
                        !javaState.detailLoading
                      }
                    >
                      <div class="py-4 text-center text-xs text-muted-foreground">
                        No fields loaded
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
                        class="cursor-pointer rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90"
                        onClick={() => {
                          const session = activeSession();
                          if (session && javaState.selectedClass) {
                            fetchJavaInstances(
                              session.id,
                              javaState.selectedClass,
                            );
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
        }
      />
    </div>
  );
}

export default JavaTab;
