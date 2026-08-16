import { StaticFlagProvider } from "@5min/shared-flags";
import { InternalDemoAdminContext } from "./internal-demo-admin-context";

describe("InternalDemoAdminContext", () => {
  it("A. production/default (both flags off) -> unavailable", () => {
    const context = new InternalDemoAdminContext(new StaticFlagProvider());
    expect(context.isAvailable()).toBe(false);
  });

  it("A2. production runtime where only proto_admin_trace was flipped on -> still unavailable", () => {
    const context = new InternalDemoAdminContext(new StaticFlagProvider({ proto_admin_trace: true }));
    expect(context.isAvailable()).toBe(false);
  });

  it("B. internal-demo runtime with the feature flag off -> unavailable", () => {
    const context = new InternalDemoAdminContext(
      new StaticFlagProvider({ proto_internal_demo_runtime: true, proto_admin_trace: false }),
    );
    expect(context.isAvailable()).toBe(false);
  });

  it("C. internal-demo runtime with the feature flag on -> available", () => {
    const context = new InternalDemoAdminContext(
      new StaticFlagProvider({ proto_internal_demo_runtime: true, proto_admin_trace: true }),
    );
    expect(context.isAvailable()).toBe(true);
  });
});
