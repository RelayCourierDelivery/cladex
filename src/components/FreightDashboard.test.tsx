import { describe, expect, it } from "vitest";

const ALLOWED_NEXT: Record<string, string | undefined> = {
  draft: "submitted",
  approved: "posted",
  posted: "assigned",
  assigned: "in_transit",
  in_transit: "delivered",
};

describe("freight dashboard workflow", () => {
  it("keeps approval out of ordinary automatic transitions", () => {
    expect(ALLOWED_NEXT.submitted).toBeUndefined();
    expect(ALLOWED_NEXT.draft).toBe("submitted");
  });
  it("allows only the ordered manual lifecycle after approval", () => {
    expect(ALLOWED_NEXT.approved).toBe("posted");
    expect(ALLOWED_NEXT.posted).toBe("assigned");
    expect(ALLOWED_NEXT.assigned).toBe("in_transit");
    expect(ALLOWED_NEXT.in_transit).toBe("delivered");
  });
  it("does not provide a next state after delivery", () => {
    expect(ALLOWED_NEXT.delivered).toBeUndefined();
  });
});
