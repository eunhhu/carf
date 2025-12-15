import type { MethodHandler } from "../rpc/types";
import { ping } from "./ping";
import { getArch } from "./getArch";
import { enumerateModules } from "./enumerateModules";
import { enumerateExports } from "./enumerateExports";
import { enumerateThreads } from "./enumerateThreads";
import { readMemory } from "./readMemory";
import { writeMemory } from "./writeMemory";
import { searchMemory } from "./searchMemory";
import { getBacktrace } from "./getBacktrace";

// Map of host-callable RPC methods.
export const methods: Record<string, MethodHandler> = {
  ping,
  get_arch: getArch,
  enumerate_modules: enumerateModules,
  enumerate_exports: enumerateExports,
  enumerate_threads: enumerateThreads,
  read_memory: readMemory,
  write_memory: writeMemory,
  search_memory: searchMemory,
  get_backtrace: getBacktrace,
};
