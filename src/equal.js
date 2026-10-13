import { timingSafeEqual } from "node:crypto";

export function constantTimeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") {
    throw new TypeError("both arguments must be strings");
  }

  const leftBytes = Buffer.from(left, "utf16le");
  const rightBytes = Buffer.from(right, "utf16le");
  if (leftBytes.length !== rightBytes.length) {
    return false;
  }
  return timingSafeEqual(leftBytes, rightBytes);
}
