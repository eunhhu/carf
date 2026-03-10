import { registerHandler } from "../rpc/router";
import { findExportByName } from "../runtime/frida-compat";
import { emitLog } from "../rpc/protocol";

// --- Cloak API abstraction ---

interface CloakApi {
  addThread(id: number): void;
  removeThread(id: number): void;
  hasThread(id: number): boolean;
  addRange(range: { base: NativePointer; size: number }): void;
  removeRange(range: { base: NativePointer; size: number }): void;
  hasRangeContaining(address: NativePointer): boolean;
}

function getCloakApi(): CloakApi | null {
  if (typeof Thread !== "undefined" && "Cloak" in Thread) {
    return (Thread as unknown as { Cloak: CloakApi }).Cloak;
  }
  const g = globalThis as unknown as Record<string, unknown>;
  if (typeof g.Cloak !== "undefined") {
    return g.Cloak as CloakApi;
  }
  return null;
}

// Track cloaked items for status reporting
const cloakedThreads = new Set<number>();
const cloakedRanges: Array<{ base: string; size: number }> = [];

registerHandler("cloakThread", (params: unknown) => {
  const { threadId } = params as { threadId: number };
  const cloak = getCloakApi();
  if (!cloak) {
    throw new Error("Cloak API is not available in this Frida version");
  }

  cloak.addThread(threadId);
  cloakedThreads.add(threadId);
  emitLog("info", `Cloaked thread ${threadId}`);
  return { threadId, cloaked: true };
});

registerHandler("uncloakThread", (params: unknown) => {
  const { threadId } = params as { threadId: number };
  const cloak = getCloakApi();
  if (!cloak) {
    throw new Error("Cloak API is not available in this Frida version");
  }

  cloak.removeThread(threadId);
  cloakedThreads.delete(threadId);
  emitLog("info", `Uncloaked thread ${threadId}`);
  return { threadId, cloaked: false };
});

registerHandler("cloakRange", (params: unknown) => {
  const { base, size } = params as { base: string; size: number };
  const cloak = getCloakApi();
  if (!cloak) {
    throw new Error("Cloak API is not available in this Frida version");
  }

  cloak.addRange({ base: ptr(base), size });
  cloakedRanges.push({ base, size });
  emitLog("info", `Cloaked range ${base} (${size} bytes)`);
  return { base, size, cloaked: true };
});

registerHandler("uncloakRange", (params: unknown) => {
  const { base, size } = params as { base: string; size: number };
  const cloak = getCloakApi();
  if (!cloak) {
    throw new Error("Cloak API is not available in this Frida version");
  }

  cloak.removeRange({ base: ptr(base), size });
  const idx = cloakedRanges.findIndex(
    (r) => r.base === base && r.size === size,
  );
  if (idx !== -1) {
    cloakedRanges.splice(idx, 1);
  }
  emitLog("info", `Uncloaked range ${base} (${size} bytes)`);
  return { base, size, cloaked: false };
});

registerHandler("getCloakStatus", (_params: unknown) => {
  const cloak = getCloakApi();
  return {
    available: cloak !== null,
    threads: Array.from(cloakedThreads),
    ranges: cloakedRanges.slice(),
  };
});

// --- SSL Pinning Bypass ---

const sslBypassHooks: InvocationListener[] = [];
let sslBypassActive = false;

registerHandler("bypassSslPinning", (_params: unknown) => {
  if (sslBypassActive) {
    return { active: true, message: "SSL pinning bypass already active" };
  }

  let hooksInstalled = 0;

  // Native SSL verification bypass candidates
  const sslVerifyTargets = [
    { module: "libssl.so", name: "SSL_get_verify_result" },
    { module: "libssl.so.3", name: "SSL_get_verify_result" },
    { module: "libboringssl.dylib", name: "SSL_get_verify_result" },
    { module: null, name: "SSL_get_verify_result" },
    { module: null, name: "SSL_CTX_set_custom_verify" },
  ];

  for (const target of sslVerifyTargets) {
    try {
      const addr = findExportByName(target.module, target.name);
      if (!addr || addr.isNull()) continue;

      if (target.name === "SSL_get_verify_result") {
        // Replace to always return 0 (X509_V_OK)
        const listener = Interceptor.attach(addr, {
          onLeave(retval) {
            retval.replace(ptr(0));
          },
        });
        sslBypassHooks.push(listener);
        hooksInstalled++;
        emitLog("info", `SSL bypass: hooked ${target.name} in ${target.module ?? "global"}`);
      } else if (target.name === "SSL_CTX_set_custom_verify") {
        // Intercept custom verify callback registration, replace callback with no-op
        const listener = Interceptor.attach(addr, {
          onEnter(args) {
            // arg0 = SSL_CTX*, arg1 = mode, arg2 = callback
            // Set callback to NULL to disable custom verification
            args[2] = ptr(0);
          },
        });
        sslBypassHooks.push(listener);
        hooksInstalled++;
        emitLog("info", `SSL bypass: hooked ${target.name}`);
      }
    } catch {
      // Target not found in this process, skip
    }
  }

  // Android-specific: Java TrustManager bypass
  if (Java.available) {
    try {
      Java.perform(() => {
        // Bypass X509TrustManager.checkServerTrusted
        const TrustManagerImpl = Java.use(
          "com.android.org.conscrypt.TrustManagerImpl",
        );

        if (TrustManagerImpl.checkServerTrusted) {
          TrustManagerImpl.checkServerTrusted.overload(
            "[Ljava.security.cert.X509Certificate;",
            "java.lang.String",
          ).implementation = function (_chain: unknown, _authType: unknown) {
            // Accept all certificates
          };
          hooksInstalled++;
          emitLog("info", "SSL bypass: hooked TrustManagerImpl.checkServerTrusted");
        }

        // Bypass OkHttp CertificatePinner if present
        try {
          const CertificatePinner = Java.use("okhttp3.CertificatePinner");
          CertificatePinner.check.overload(
            "java.lang.String",
            "java.util.List",
          ).implementation = function (_hostname: unknown, _peerCertificates: unknown) {
            // No-op: accept all certificates
          };
          hooksInstalled++;
          emitLog("info", "SSL bypass: hooked OkHttp CertificatePinner.check");
        } catch {
          // OkHttp not present, skip
        }
      });
    } catch {
      // Java not available or class not found, skip
    }
  }

  sslBypassActive = hooksInstalled > 0;

  return {
    active: sslBypassActive,
    hooksInstalled,
    message:
      hooksInstalled > 0
        ? `SSL pinning bypass active (${hooksInstalled} hooks)`
        : "No SSL verification functions found to hook",
  };
});

// --- Root / Jailbreak Detection Bypass ---

const rootBypassHooks: InvocationListener[] = [];
let rootBypassActive = false;

const ROOT_PATHS = [
  "/su",
  "/system/xbin/su",
  "/system/bin/su",
  "/sbin/su",
  "/data/local/su",
  "/data/local/bin/su",
  "/data/local/xbin/su",
  "/system/app/Superuser.apk",
  "/system/etc/init.d/99telecominfra",
  "/dev/com.koushikdutta.superuser.daemon/",
  "/data/data/com.noshufou.android.su/",
  "/data/data/eu.chainfire.supersu/",
  "/data/data/com.topjohnwu.magisk/",
  // iOS jailbreak indicators
  "/Applications/Cydia.app",
  "/Library/MobileSubstrate/MobileSubstrate.dylib",
  "/bin/bash",
  "/usr/sbin/sshd",
  "/etc/apt",
  "/private/var/lib/apt/",
  "/private/var/lib/cydia",
  "/private/var/stash",
];

function isRootPath(path: string | null): boolean {
  if (!path) return false;
  return ROOT_PATHS.some((rp) => path.includes(rp));
}

registerHandler("bypassRootDetection", (_params: unknown) => {
  if (rootBypassActive) {
    return { active: true, message: "Root detection bypass already active" };
  }

  let hooksInstalled = 0;

  // Hook access() to hide root-related paths
  const accessAddr = findExportByName(null, "access");
  if (accessAddr && !accessAddr.isNull()) {
    const listener = Interceptor.attach(accessAddr, {
      onEnter(args) {
        try {
          const path = args[0].readUtf8String();
          if (isRootPath(path)) {
            (this as unknown as Record<string, boolean>).shouldBlock = true;
          }
        } catch {
          // Ignore read errors
        }
      },
      onLeave(retval) {
        if ((this as unknown as Record<string, boolean>).shouldBlock) {
          retval.replace(ptr(-1)); // ENOENT
        }
      },
    });
    rootBypassHooks.push(listener);
    hooksInstalled++;
    emitLog("info", "Root bypass: hooked access()");
  }

  // Hook fopen() to hide root-related paths
  const fopenAddr = findExportByName(null, "fopen");
  if (fopenAddr && !fopenAddr.isNull()) {
    const listener = Interceptor.attach(fopenAddr, {
      onEnter(args) {
        try {
          const path = args[0].readUtf8String();
          if (isRootPath(path)) {
            (this as unknown as Record<string, boolean>).shouldBlock = true;
          }
        } catch {
          // Ignore read errors
        }
      },
      onLeave(retval) {
        if ((this as unknown as Record<string, boolean>).shouldBlock) {
          retval.replace(ptr(0)); // NULL (file not found)
        }
      },
    });
    rootBypassHooks.push(listener);
    hooksInstalled++;
    emitLog("info", "Root bypass: hooked fopen()");
  }

  // Hook stat() to hide root-related paths
  const statAddr = findExportByName(null, "stat");
  if (statAddr && !statAddr.isNull()) {
    const listener = Interceptor.attach(statAddr, {
      onEnter(args) {
        try {
          const path = args[0].readUtf8String();
          if (isRootPath(path)) {
            (this as unknown as Record<string, boolean>).shouldBlock = true;
          }
        } catch {
          // Ignore read errors
        }
      },
      onLeave(retval) {
        if ((this as unknown as Record<string, boolean>).shouldBlock) {
          retval.replace(ptr(-1)); // Error
        }
      },
    });
    rootBypassHooks.push(listener);
    hooksInstalled++;
    emitLog("info", "Root bypass: hooked stat()");
  }

  // Android-specific: Java-level root detection bypass
  if (Java.available) {
    try {
      Java.perform(() => {
        // Hook Runtime to block root-probing commands
        const Runtime = Java.use("java.lang.Runtime");
        const IOException = Java.use("java.io.IOException");
        const Arrays = Java.use("java.util.Arrays");

        const blockedCommands = ["su", "which", "busybox"];

        function containsBlockedCommand(text: string): boolean {
          return blockedCommands.some((cmd) => text.includes(cmd));
        }

        Runtime.exec.overload("java.lang.String").implementation = function (
          cmd: string,
        ) {
          if (containsBlockedCommand(cmd)) {
            emitLog("info", `Root bypass: blocked Runtime command "${cmd}"`);
            throw IOException.$new("Cannot run program");
          }
          return this.exec(cmd);
        };
        hooksInstalled++;
        emitLog("info", "Root bypass: hooked Runtime (String)");

        Runtime.exec.overload("[Ljava.lang.String;").implementation =
          function (cmds: string[]) {
            const cmdStr = Arrays.toString(cmds);
            if (containsBlockedCommand(cmdStr)) {
              emitLog("info", `Root bypass: blocked Runtime command ${cmdStr}`);
              throw IOException.$new("Cannot run program");
            }
            return this.exec(cmds);
          };
        hooksInstalled++;
        emitLog("info", "Root bypass: hooked Runtime (String[])");

        // Hook Build.TAGS to remove "test-keys" indicator
        try {
          const Build = Java.use("android.os.Build");
          const tagsField = Build.class.getDeclaredField("TAGS");
          tagsField.setAccessible(true);
          tagsField.set(null, Java.use("java.lang.String").$new("release-keys"));
          hooksInstalled++;
          emitLog("info", "Root bypass: patched Build.TAGS");
        } catch {
          // Field access may fail on some ROMs
        }

        // Hook PackageManager to hide root packages
        try {
          const PackageManager = Java.use(
            "android.app.ApplicationPackageManager",
          );
          const NameNotFound = Java.use(
            "android.content.pm.PackageManager$NameNotFoundException",
          );
          const rootPackages = [
            "com.topjohnwu.magisk",
            "com.noshufou.android.su",
            "eu.chainfire.supersu",
            "com.koushikdutta.superuser",
            "com.thirdparty.superuser",
          ];

          PackageManager.getPackageInfo.overload(
            "java.lang.String",
            "int",
          ).implementation = function (
            packageName: string,
            flags: number,
          ) {
            if (rootPackages.includes(packageName)) {
              emitLog("info", `Root bypass: hid package ${packageName}`);
              throw NameNotFound.$new(packageName);
            }
            return this.getPackageInfo(packageName, flags);
          };
          hooksInstalled++;
          emitLog("info", "Root bypass: hooked PackageManager.getPackageInfo");
        } catch {
          // Class may not be available
        }
      });
    } catch {
      // Java not available, skip Android-specific hooks
    }
  }

  rootBypassActive = hooksInstalled > 0;

  return {
    active: rootBypassActive,
    hooksInstalled,
    message:
      hooksInstalled > 0
        ? `Root detection bypass active (${hooksInstalled} hooks)`
        : "No root detection functions found to hook",
  };
});
