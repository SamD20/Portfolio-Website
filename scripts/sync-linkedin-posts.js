import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const LINKEDIN_API_URL = "https://api.linkedin.com/rest";
const POSTS_PER_REQUEST = 100;
const LIKE_REQUEST_CONCURRENCY = 5;
const FEATURED_POST_COUNT = 3;

async function requestLinkedIn(url, accessToken, apiVersion) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": apiVersion,
      "X-Restli-Protocol-Version": "2.0.0",
    },
  });

  if (!response.ok) {
    const responseDetails = (await response.text()).slice(0, 240);
    throw new Error(
      `LinkedIn returned ${response.status}: ${responseDetails}`,
    );
  }

  return response.json();
}

async function fetchAllPublishedPosts(accessToken, personUrn, apiVersion) {
  const posts = [];

  for (let start = 0; ; start += POSTS_PER_REQUEST) {
    const query = new URLSearchParams({
      q: "author",
      author: personUrn,
      count: POSTS_PER_REQUEST,
      start,
      sortBy: "LAST_MODIFIED",
    });
    const page = await requestLinkedIn(
      `${LINKEDIN_API_URL}/posts?${query}`,
      accessToken,
      apiVersion,
    );
    const pagePosts = page.elements || [];

    posts.push(
      ...pagePosts.filter(
        (post) => post.lifecycleState === "PUBLISHED" && post.id,
      ),
    );

    const reachedEndOfPosts =
      pagePosts.length < POSTS_PER_REQUEST ||
      start + POSTS_PER_REQUEST >= (page.paging?.total ?? Infinity);

    if (reachedEndOfPosts) {
      return posts;
    }
  }
}

async function fetchPostLikes(post, accessToken, apiVersion) {
  const socialActions = await requestLinkedIn(
    `${LINKEDIN_API_URL}/socialActions/${encodeURIComponent(post.id)}`,
    accessToken,
    apiVersion,
  );

  return Number(
    socialActions.likesSummary?.totalLikes ??
      socialActions.likesSummary?.aggregatedTotalLikes ??
      0,
  );
}

async function mapWithConcurrency(items, concurrency, callback) {
  const results = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await callback(items[index]);
      }
    },
  );

  await Promise.all(workers);
  return results;
}

function getPostTitle(post) {
  const commentary =
    typeof post.commentary === "string" ? post.commentary : "";
  const title = commentary.replace(/\s+/g, " ").trim();

  return (title || "LinkedIn post").slice(0, 110);
}

export function buildFeed(
  posts,
  likesByPostId,
  updatedAt = new Date().toISOString(),
) {
  const formattedPosts = posts.map((post) => ({
    id: post.id,
    title: getPostTitle(post),
    url: `https://www.linkedin.com/feed/update/${post.id}/`,
    createdAt: Number(post.createdAt || post.lastModifiedAt || 0),
    likes: likesByPostId.get(post.id) || 0,
  }));

  const recentPosts = [...formattedPosts]
    .sort((first, second) => second.createdAt - first.createdAt)
    .slice(0, FEATURED_POST_COUNT);
  const popularPosts = [...formattedPosts]
    .sort(
      (first, second) =>
        second.likes - first.likes || second.createdAt - first.createdAt,
    )
    .slice(0, FEATURED_POST_COUNT);

  return {
    updatedAt,
    recent: recentPosts,
    popular: popularPosts,
  };
}

export async function syncLinkedInPosts({
  accessToken = process.env.LINKEDIN_ACCESS_TOKEN,
  personUrn = process.env.LINKEDIN_PERSON_URN,
  apiVersion = process.env.LINKEDIN_API_VERSION || "202609",
} = {}) {
  if (!accessToken || !personUrn) {
    throw new Error(
      "Set LINKEDIN_ACCESS_TOKEN and LINKEDIN_PERSON_URN in GitHub Actions secrets.",
    );
  }

  const posts = await fetchAllPublishedPosts(
    accessToken,
    personUrn,
    apiVersion,
  );
  const postLikes = await mapWithConcurrency(
    posts,
    LIKE_REQUEST_CONCURRENCY,
    async (post) => [
      post.id,
      await fetchPostLikes(post, accessToken, apiVersion),
    ],
  );
  const feed = buildFeed(posts, new Map(postLikes));

  await writeFile(
    new URL("../public/linkedin-posts.json", import.meta.url),
    `${JSON.stringify(feed, null, 2)}\n`,
  );

  console.log(
    `Synced ${posts.length} LinkedIn posts ` +
      `(${feed.recent.length} recent, ${feed.popular.length} popular).`,
  );
}

const isRunDirectly =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isRunDirectly) {
  syncLinkedInPosts().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
