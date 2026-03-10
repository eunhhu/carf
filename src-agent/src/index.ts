import { createRpcExports } from "./rpc/router";

// Import all modules to trigger side-effectful handler registration
import "./modules/process";
import "./modules/module";
import "./modules/thread";
import "./modules/memory";
import "./modules/java";
import "./modules/objc";
import "./modules/native";
import "./modules/stalker";
import "./modules/network";
import "./modules/filesystem";
import "./modules/console";

// Expose all registered handlers via Frida's rpc.exports
rpc.exports = createRpcExports();
