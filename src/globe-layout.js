export function getEvenlySpacedPositions(items) {
  const count = items.length;

  if (count === 0) {
    return [];
  }

  let points;

  if (count === 1) {
    points = [[0, 0, 1]];
  } else if (count === 2) {
    points = [
      [0, 0, 1],
      [0, 0, -1],
    ];
  } else if (count === 3) {
    points = [
      [1, 0, 0],
      [-0.5, 0, Math.sqrt(3) / 2],
      [-0.5, 0, -Math.sqrt(3) / 2],
    ];
  } else if (count === 4) {
    const tetrahedronCoordinate = 1 / Math.sqrt(3);
    points = [
      [1, 1, 1],
      [1, -1, -1],
      [-1, 1, -1],
      [-1, -1, 1],
    ].map((point) =>
      point.map((coordinate) => coordinate * tetrahedronCoordinate),
    );
  } else {
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    points = Array.from({ length: count }, (_, index) => {
      const y = 1 - (2 * (index + 0.5)) / count;
      const radius = Math.sqrt(1 - y * y);
      const angle = goldenAngle * index;

      return [radius * Math.cos(angle), y, radius * Math.sin(angle)];
    });

    for (let iteration = 0; iteration < 240; iteration += 1) {
      const movementScale = 0.004 * (1 - iteration / 240) + 0.0001;
      const movements = points.map((point, pointIndex) => {
        const force = [0, 0, 0];

        points.forEach((otherPoint, otherIndex) => {
          if (pointIndex === otherIndex) {
            return;
          }

          const difference = point.map(
            (coordinate, axis) => coordinate - otherPoint[axis],
          );
          const distanceSquared = difference.reduce(
            (sum, coordinate) => sum + coordinate * coordinate,
            0,
          );
          const inverseDistanceCubed =
            1 / (distanceSquared * Math.sqrt(distanceSquared));

          difference.forEach((coordinate, axis) => {
            force[axis] += coordinate * inverseDistanceCubed;
          });
        });

        const radialForce = force.reduce(
          (sum, coordinate, axis) => sum + coordinate * point[axis],
          0,
        );

        return force.map(
          (coordinate, axis) =>
            (coordinate - radialForce * point[axis]) * movementScale,
        );
      });

      points = points.map((point, index) => {
        const movedPoint = point.map(
          (coordinate, axis) => coordinate + movements[index][axis],
        );
        const length = Math.sqrt(
          movedPoint.reduce(
            (sum, coordinate) => sum + coordinate * coordinate,
            0,
          ),
        );

        return movedPoint.map((coordinate) => coordinate / length);
      });
    }
  }

  const sortedItems = [...items].sort((first, second) =>
    first.id.localeCompare(second.id),
  );

  return sortedItems.map((item, index) => {
    const [x, y, z] = points[index];

    return {
      ...item,
      lat: (Math.asin(y) * 180) / Math.PI,
      lon: (Math.atan2(-z, x) * 180) / Math.PI,
    };
  });
}
