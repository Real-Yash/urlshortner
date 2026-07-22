import assert from "node:assert/strict";
import test from "node:test";
import { customCode, destinationUrl } from "../app/lib/links";
import { projectId, projectName } from "../app/lib/projects";
import { summarizeClicks } from "../app/lib/analytics";

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

test("summarizes click events by link", () => {
  const now = new Date().toISOString();
  const summary = summarizeClicks([{link_id:"1",clicked_at:now,links:{code:"sale"}},{link_id:"1",clicked_at:now,links:{code:"sale"}}]);
  assert.equal(summary.total, 2);
  assert.deepEqual(summary.links, [{code:"sale",clicks:2}]);
});
