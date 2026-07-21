import assert from "node:assert/strict";
import test from "node:test";
import { customCode, destinationUrl } from "../app/lib/links";
import { projectId, projectName } from "../app/lib/projects";

test("accepts safe destinations and aliases", () => {
  assert.equal(destinationUrl("https://example.com/path"), "https://example.com/path");
  assert.equal(destinationUrl("ftp://example.com"), null);
  assert.equal(destinationUrl("https://user:pass@example.com"), null);
  assert.equal(customCode("Summer_Sale"), "summer_sale");
  assert.equal(customCode("api"), null);
  assert.equal(projectName(" Summer campaign "), "Summer campaign");
  assert.equal(projectName(" "), null);
  assert.equal(projectId("5c452e94-a14d-4e76-8cf5-48cd064b5b32"), "5c452e94-a14d-4e76-8cf5-48cd064b5b32");
  assert.equal(projectId("not-a-project"), null);
});
