const clamp = value => Math.max(0, Math.min(1, value));
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function random(seed) {
  return () => {
    seed |= 0;
    seed = seed + 0x6d2b79f5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function segmentClear(a, b, obstacle) {
  const cos = Math.cos(obstacle.angle), sin = Math.sin(obstacle.angle);
  const local = point => [
    ((point[0] - obstacle.x) * cos + (point[1] - obstacle.y) * sin) / obstacle.rx,
    (-(point[0] - obstacle.x) * sin + (point[1] - obstacle.y) * cos) / obstacle.ry
  ];
  const u = local(a), v = local(b), dx = v[0] - u[0], dy = v[1] - u[1];
  const t = clamp(-(u[0] * dx + u[1] * dy) / (dx * dx + dy * dy || 1));
  return (u[0] + t * dx) ** 2 + (u[1] + t * dy) ** 2 > 1.00001;
}

export function buildTree(seed = 67) {
  const rng = random(seed);
  const obstacles = [
    { x: 0.43, y: 0.35, rx: 0.105, ry: 0.23, angle: -0.22 },
    { x: 0.78, y: 0.70, rx: 0.16, ry: 0.18, angle: 0.25 },
    { x: 1.12, y: 0.28, rx: 0.12, ry: 0.20, angle: 0.1 },
    { x: 1.31, y: 0.77, rx: 0.09, ry: 0.12, angle: -0.4 }
  ];
  const clear = (a, b) => obstacles.every(obstacle => segmentClear(a, b, obstacle));
  const start = [0.035, 0.5], goal = [1.565, 0.5];
  const points = [start], parents = [-1], costs = [0], children = [new Set()];
  const frames = [{ parents: new Int16Array([-1]), path: [], cost: Infinity, rewired: [] }];
  let firstPath = -1, rewires = 0;

  function updateCosts(root, difference) {
    const queue = [root];
    for (let i = 0; i < queue.length; i++) {
      costs[queue[i]] += difference;
      queue.push(...children[queue[i]]);
    }
  }

  for (let attempts = 0; points.length < 620 && attempts < 6000; attempts++) {
    const sample = rng() < 0.065 ? goal : [0.015 + 1.57 * rng(), 0.015 + 0.97 * rng()];
    if (!clear(sample, sample)) continue;
    let nearest = 0, nearestDistance = Infinity;
    points.forEach((point, i) => {
      const length = distance(point, sample);
      if (length < nearestDistance) {
        nearest = i;
        nearestDistance = length;
      }
    });
    if (nearestDistance < 0.012) continue;
    const step = Math.min(0.067 / nearestDistance, 1);
    const point = points[nearest].map((value, i) => value + step * (sample[i] - value));
    if (!clear(points[nearest], point)) continue;

    const radius = Math.min(0.22, 0.95 * Math.sqrt(Math.log(points.length + 1) / (points.length + 1)));
    const neighbors = [];
    let parent = nearest, cost = costs[nearest] + distance(points[nearest], point);
    points.forEach((neighbor, i) => {
      const length = distance(neighbor, point);
      if (length > radius || !clear(neighbor, point)) return;
      neighbors.push([i, length]);
      if (costs[i] + length < cost) {
        parent = i;
        cost = costs[i] + length;
      }
    });

    const index = points.length, rewired = [];
    points.push(point);
    parents.push(parent);
    costs.push(cost);
    children.push(new Set());
    children[parent].add(index);
    for (const [neighbor, length] of neighbors) {
      if (cost + length >= costs[neighbor] - 1e-10) continue;
      children[parents[neighbor]].delete(neighbor);
      children[index].add(neighbor);
      parents[neighbor] = index;
      updateCosts(neighbor, cost + length - costs[neighbor]);
      rewired.push(neighbor);
      rewires++;
    }

    let finish = -1, best = Infinity;
    points.forEach((point, i) => {
      const length = distance(point, goal);
      if (length < 0.105 && costs[i] + length < best && clear(point, goal)) {
        best = costs[i] + length;
        finish = i;
      }
    });
    const path = [];
    for (let node = finish; node >= 0; node = parents[node]) path.push(node);
    path.reverse();
    if (finish >= 0 && firstPath < 0) firstPath = frames.length;
    frames.push({ parents: Int16Array.from(parents), path, cost: best, rewired });
  }
  return { points, goal, obstacles, frames, firstPath, rewires, costs };
}
