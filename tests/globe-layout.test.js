import assert from "node:assert/strict";
import test from "node:test";
import { getEvenlySpacedPositions } from "../src/globe-layout.js";

function toUnitVector({ lat, lon }) {
  const latitude = (lat * Math.PI) / 180;
  const longitude = (lon * Math.PI) / 180;
  const latitudeRadius = Math.cos(latitude);

  return [
    latitudeRadius * Math.cos(longitude),
    Math.sin(latitude),
    latitudeRadius * Math.sin(longitude),
  ];
}

function nearestNeighborAngles(items) {
  const points = items.map(toUnitVector);

  return points.map((point, index) =>
    Math.min(
      ...points
        .filter((_, otherIndex) => otherIndex !== index)
        .map((otherPoint) => {
          const dotProduct = point.reduce(
            (sum, coordinate, axis) => sum + coordinate * otherPoint[axis],
            0,
          );

          return Math.acos(Math.max(-1, Math.min(1, dotProduct)));
        }),
    ),
  );
}

test("four globe pins are placed at the vertices of a regular tetrahedron", () => {
  const items = getEvenlySpacedPositions(
    Array.from({ length: 4 }, (_, index) => ({ id: `item-${index}` })),
  );
  const nearestAngles = nearestNeighborAngles(items);
  const expectedAngle = Math.acos(-1 / 3);

  assert.equal(items.length, 4);
  nearestAngles.forEach((angle) => {
    assert.ok(Math.abs(angle - expectedAngle) < 1e-8);
  });
});

test("globe pins remain evenly distributed from two to twelve items", () => {
  for (let count = 2; count <= 12; count += 1) {
    const items = getEvenlySpacedPositions(
      Array.from({ length: count }, (_, index) => ({ id: `item-${index}` })),
    );
    const nearestAngles = nearestNeighborAngles(items);
    const spacingRatio =
      Math.max(...nearestAngles) / Math.min(...nearestAngles);

    assert.equal(items.length, count);
    assert.ok(
      spacingRatio < 1.2,
      `${count} items had a nearest-neighbor spacing ratio of ${spacingRatio}`,
    );
  }
});

test("pin positions stay assigned to item IDs when input order changes", () => {
  const items = ["repo-c", "post-a", "repo-b", "repo-a"].map((id) => ({ id }));
  const firstLayout = getEvenlySpacedPositions(items);
  const reorderedLayout = getEvenlySpacedPositions([...items].reverse());

  assert.deepEqual(
    firstLayout.map(({ id, lat, lon }) => [id, lat, lon]),
    reorderedLayout.map(({ id, lat, lon }) => [id, lat, lon]),
  );
});

test("the Arsenic repository is placed on the visible side at startup", () => {
  const arsenicRepositoryId = "github-1307288009";
  const items = [
    { id: arsenicRepositoryId },
    { id: "github-1400701946" },
    { id: "github-1400932729" },
    { id: "linkedin-test-post" },
  ];
  const arsenicRepository = getEvenlySpacedPositions(items).find(
    (item) => item.id === arsenicRepositoryId,
  );
  const { lat, lon } = arsenicRepository;
  const latitude = (lat * Math.PI) / 180;
  const longitude = (lon * Math.PI) / 180;
  const visibleSideZ = -Math.cos(latitude) * Math.sin(longitude);

  assert.ok(
    visibleSideZ > 0,
    `expected repository to be on the visible side, received z=${visibleSideZ}`,
  );
});
