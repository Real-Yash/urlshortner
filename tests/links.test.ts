import assert from "node:assert/strict";
import test from "node:test";
import { customCode, destinationUrl } from "../app/lib/links";

test("accepts safe destinations and aliases", () => {
  assert.equal(destinationUrl("https://example.com/path"), "https://example.com/path");
  assert.equal(destinationUrl("ftp://example.com"), null);
  assert.equal(destinationUrl("https://user:pass@example.com"), null);
  assert.equal(customCode("Summer_Sale"), "summer_sale");
  assert.equal(customCode("api"), null);
});
