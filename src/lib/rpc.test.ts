import { describe, expect, it } from "vitest";
import { unwrapRpcResult } from "~/lib/rpc";

describe("unwrapRpcResult", () => {
	it("returns plain values unchanged", () => {
		expect(unwrapRpcResult(["a", "b"])).toEqual(["a", "b"]);
	});

	it("unwraps successful RPC envelopes", () => {
		expect(
			unwrapRpcResult({
				success: true,
				data: { ok: true },
			}),
		).toEqual({ ok: true });
	});

	it("throws on failed RPC envelopes", () => {
		expect(() =>
			unwrapRpcResult({
				success: false,
				error: "boom",
			}),
		).toThrowError("boom");
	});
});
