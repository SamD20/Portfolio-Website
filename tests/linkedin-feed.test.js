import assert from "node:assert/strict";
import test from "node:test";
import { buildFeed } from "../scripts/sync-linkedin-posts.js";

const samplePosts = Array.from({ length: 5 }, (_, index) => ({
  id: `urn:li:share:${index}`,
  commentary: `Post ${index}`,
  createdAt: index + 1,
}));

test("feed includes the three newest and most liked posts", () => {
  const likes = new Map([
    [samplePosts[0].id, 20],
    [samplePosts[1].id, 80],
    [samplePosts[2].id, 10],
    [samplePosts[3].id, 60],
    [samplePosts[4].id, 5],
  ]);
  const feed = buildFeed(
    samplePosts,
    likes,
    "2026-10-04T00:00:00.000Z",
  );

  assert.deepEqual(
    feed.recent.map((post) => post.id),
    [samplePosts[4].id, samplePosts[3].id, samplePosts[2].id],
  );
  assert.deepEqual(
    feed.popular.map((post) => post.id),
    [samplePosts[1].id, samplePosts[3].id, samplePosts[0].id],
  );
  assert.equal(feed.updatedAt, "2026-10-04T00:00:00.000Z");
});

test("feed handles an empty LinkedIn account", () => {
  const feed = buildFeed([], new Map());

  assert.ok(Date.parse(feed.updatedAt));
  assert.deepEqual(feed.recent, []);
  assert.deepEqual(feed.popular, []);
});
