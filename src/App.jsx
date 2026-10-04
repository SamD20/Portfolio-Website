import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import "./App.css";

const MAX_REPOSITORIES = 6;
const MAX_FEATURED_POSTS = 3;

const GITHUB_LOGO_PATH =
  "M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55v-2.13c-3.2.7-3.88-1.35-3.88-1.35-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.4-5.26 5.69.41.36.78 1.06.78 2.14v3.18c0 .3.21.66.79.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z";

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d={GITHUB_LOGO_PATH} />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="2" fill="currentColor" />
      <path
        fill="currentColor"
        d="M4.75 10h3.5v10h-3.5zM10 10h3.35v1.37h.05c.47-.89 1.62-1.83 3.33-1.83 3.56 0 4.22 2.34 4.22 5.38V20h-3.5v-4.5c0-1.08-.02-2.48-1.51-2.48-1.51 0-1.74 1.18-1.74 2.4V20H10z"
      />
    </svg>
  );
}

function latLonToVector3(latitude, longitude, radius = 1) {
  const phi = ((90 - latitude) * Math.PI) / 180;
  const theta = ((longitude + 180) * Math.PI) / 180;

  return [
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ];
}

function getStableGlobePosition(id) {
  const hash = [...id].reduce(
    (value, character) =>
      (value * 31 + character.charCodeAt(0)) >>> 0,
    7,
  );

  return {
    lat: (hash % 130) - 65,
    lon: ((hash * 17) % 360) - 180,
  };
}

async function fetchRepositories(signal) {
  const response = await fetch(
    "https://api.github.com/users/SamD20/repos?per_page=100&sort=updated",
    { signal },
  );

  if (!response.ok) {
    throw new Error(`GitHub returned ${response.status}`);
  }

  const repositories = await response.json();

  return repositories
    .filter((repository) => !repository.fork)
    .sort((first, second) => {
      const firstScore =
        first.stargazers_count * 3 +
        first.forks_count * 2 +
        first.watchers_count;
      const secondScore =
        second.stargazers_count * 3 +
        second.forks_count * 2 +
        second.watchers_count;

      return secondScore - firstScore;
    })
    .slice(0, MAX_REPOSITORIES)
    .map((repository) => {
      const id = `github-${repository.id}`;

      return {
        ...getStableGlobePosition(id),
        id,
        type: "github",
        title: repository.name,
        url: repository.html_url,
        language: repository.language,
      };
    });
}

async function fetchLinkedInPosts(signal) {
  const response = await fetch(
    `${import.meta.env.BASE_URL}linkedin-posts.json`,
    { signal, cache: "no-cache" },
  );

  if (!response.ok) {
    throw new Error(`LinkedIn feed returned ${response.status}`);
  }

  const feed = await response.json();

  if (!Array.isArray(feed.recent) || !Array.isArray(feed.popular)) {
    throw new Error("LinkedIn feed has an invalid format");
  }

  const postsById = new Map();
  const featuredPosts = [
    ...feed.recent.slice(0, MAX_FEATURED_POSTS),
    ...feed.popular.slice(0, MAX_FEATURED_POSTS),
  ];

  featuredPosts.forEach((post) => {
    if (!post.id || !post.url || !post.title) {
      return;
    }

    postsById.set(post.id, {
      ...getStableGlobePosition(post.id),
      ...post,
      type: "linkedin",
    });
  });

  return {
    posts: [...postsById.values()],
    configured: Boolean(feed.updatedAt),
  };
}

function Pin({ item, visible, onHoverChange }) {
  const position = useMemo(
    () => latLonToVector3(item.lat, item.lon, 1.04),
    [item.lat, item.lon],
  );
  const [hovered, setHovered] = useState(false);
  const Icon = item.type === "github" ? GitHubIcon : LinkedInIcon;
  const itemType =
    item.type === "github" ? "GitHub repository" : "LinkedIn post";
  const tooltipTitle = item.language
    ? `${item.title} · ${item.language}`
    : item.title;

  function handleHover(isHovered) {
    setHovered(isHovered);
    onHoverChange(isHovered);
  }

  return (
    <Html center distanceFactor={4} position={position}>
      <a
        aria-label={`Open ${itemType}: ${item.title}${item.language ? `, ${item.language}` : ""}`}
        className={`globe-pin ${item.type} ${hovered ? "hovered" : ""}`}
        href={item.url}
        onBlur={() => handleHover(false)}
        onFocus={() => handleHover(true)}
        onMouseEnter={() => handleHover(true)}
        onMouseLeave={() => handleHover(false)}
        rel="noreferrer"
        style={{
          visibility: visible ? "visible" : "hidden",
          pointerEvents: visible ? "auto" : "none",
        }}
        target="_blank"
        title={tooltipTitle}
      >
        <Icon />
        <span className="pin-tooltip">
          <span className="pin-title">{item.title}</span>
          {item.language && (
            <span className="pin-language">{item.language}</span>
          )}
        </span>
      </a>
    </Html>
  );
}

function Globe({ items, filter, paused, reducedMotion, onHoverChange }) {
  return (
    <Canvas
      aria-label="Interactive globe of GitHub repositories and LinkedIn posts"
      camera={{ position: [0, 0, 4.5], fov: 42 }}
      dpr={[1, 1.5]}
    >
      <group>
        <mesh>
          <sphereGeometry args={[1, 48, 48]} />
          <meshBasicMaterial
            color="#8295b6"
            wireframe
            transparent
            opacity={0.3}
          />
        </mesh>

        <mesh>
          <sphereGeometry args={[0.985, 48, 48]} />
          <meshBasicMaterial
            color="#101a2b"
            transparent
            opacity={0.96}
          />
        </mesh>

        <mesh rotation={[Math.PI / 2.8, 0, 0]}>
          <torusGeometry args={[1.12, 0.002, 8, 120]} />
          <meshBasicMaterial
            color="#8295b6"
            transparent
            opacity={0.2}
          />
        </mesh>

        {items.map((item) => (
          <Pin
            key={item.id}
            item={item}
            visible={filter === "all" || filter === item.type}
            onHoverChange={onHoverChange}
          />
        ))}
      </group>

      <OrbitControls
        enablePan={false}
        enableZoom
        autoRotate={!reducedMotion && !paused}
        autoRotateSpeed={0.16}
        minDistance={3}
        maxDistance={6}
      />
    </Canvas>
  );
}

function App() {
  const [repositories, setRepositories] = useState([]);
  const [posts, setPosts] = useState([]);
  const [linkedinConfigured, setLinkedinConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  const [filter, setFilter] = useState("all");
  const [pinHovered, setPinHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const controller = new AbortController();

    Promise.allSettled([
      fetchRepositories(controller.signal),
      fetchLinkedInPosts(controller.signal),
    ])
      .then(([githubResult, linkedinResult]) => {
        if (controller.signal.aborted) {
          return;
        }

        if (githubResult.status === "fulfilled") {
          setRepositories(githubResult.value);
        } else {
          console.error(
            "Unable to load GitHub repositories:",
            githubResult.reason,
          );
          setErrors((current) => [
            ...current,
            "GitHub repositories unavailable",
          ]);
        }

        if (linkedinResult.status === "fulfilled") {
          setPosts(linkedinResult.value.posts);
          setLinkedinConfigured(linkedinResult.value.configured);
        } else {
          console.error(
            "Unable to load LinkedIn posts:",
            linkedinResult.reason,
          );
          setErrors((current) => [...current, "LinkedIn posts unavailable"]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const preference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const updatePreference = (event) => setReducedMotion(event.matches);

    preference.addEventListener("change", updatePreference);
    return () => preference.removeEventListener("change", updatePreference);
  }, []);

  const items = [...repositories, ...posts];
  const filters = [
    { id: "all", label: "All", count: items.length },
    { id: "github", label: "GitHub", count: repositories.length },
    { id: "linkedin", label: "LinkedIn", count: posts.length },
  ];
  const statusMessage = loading
    ? "Loading work…"
    : errors.length > 0
      ? errors.join(" · ")
      : `${repositories.length} repositories · ${
          linkedinConfigured
            ? `${posts.length} LinkedIn posts`
            : "LinkedIn sync needs setup"
        }`;
  const visibleItems = items.filter(
    (item) => filter === "all" || filter === item.type,
  );

  return (
    <main className="app">
      <div className="globe-background">
        <Globe
          filter={filter}
          items={items}
          paused={pinHovered}
          reducedMotion={reducedMotion}
          onHoverChange={setPinHovered}
        />
      </div>

      <section className="content">
        <p className="eyebrow">
          Software engineer <span>·</span> Bracknell, UK
        </p>
        <h1>
          A world of
          <br />
          <em>experience.</em>
        </h1>
        <p className="intro">
          Hello, I'm Sam Derricott. Explore my current GitHub projects and
          featured LinkedIn posts using this interactive globe.
        </p>

        <div aria-label="Filter pins" className="filters">
          {filters.map(({ id, label, count }) => (
            <button
              key={id}
              aria-pressed={filter === id}
              className={filter === id ? "active" : ""}
              onClick={() => setFilter(id)}
              type="button"
            >
              {label}
              <span>{count}</span>
            </button>
          ))}
        </div>

        <p aria-live="polite" className="status">
          {statusMessage}
        </p>
      </section>

      <footer className="footer">
        <a className="availability" href="mailto:sam.derricott@gmail.com">
          <i />
          Open to opportunities
        </a>
        <a href="https://github.com/SamD20" rel="noreferrer" target="_blank">
          <GitHubIcon />
          GitHub
        </a>
        <a
          href="https://www.linkedin.com/in/samderricott/"
          rel="noreferrer"
          target="_blank"
        >
          <LinkedInIcon />
          LinkedIn
        </a>
      </footer>

      <nav aria-label="Work links" className="pin-accessibility">
        {visibleItems.map((item) => (
          <a
            key={item.id}
            href={item.url}
            onBlur={() => setPinHovered(false)}
            onFocus={() => setPinHovered(true)}
            rel="noreferrer"
            target="_blank"
          >
            {item.type === "github" ? "GitHub repository" : "LinkedIn post"}:{" "}
            {item.title}
          </a>
        ))}
      </nav>
    </main>
  );
}

export default App;
