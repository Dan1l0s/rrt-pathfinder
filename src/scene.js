import { buildTree } from './rrt.js';

export const DURATION = 24;
export const PREVIEW_TIME = 18;
export const PALETTES = {
  dark: { bg: '#0d1117', fg: '#e6edf3', muted: '#8b949e', accent: '#7bc9e8' },
  light: { bg: '#ffffff', fg: '#1f2328', muted: '#68727e', accent: '#267da4' }
};

const TAU = 2 * Math.PI;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
let tree;

function obstacle(ctx, shape, project, scale, palette) {
  const center = project([shape.x, shape.y]);
  ctx.beginPath();
  ctx.ellipse(center[0], center[1], shape.rx * scale, shape.ry * scale, shape.angle, 0, TAU);
  ctx.fillStyle = palette.muted;
  ctx.globalAlpha = 0.08;
  ctx.fill();
  ctx.strokeStyle = palette.muted;
  ctx.globalAlpha = 0.40;
  ctx.lineWidth = Math.max(0.65, scale / 600);
  ctx.stroke();
}

function endpoint(ctx, point, radius, filled, palette) {
  ctx.globalAlpha = 1;
  ctx.fillStyle = filled ? palette.accent : palette.bg;
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(point[0], point[1], radius, 0, TAU);
  ctx.fill();
  ctx.stroke();
}

export function createScene() {
  const data = tree || (tree = buildTree());
  function frameAt(seconds) {
    const t = clamp(seconds, 0, DURATION);
    const progress = t < 10.5
      ? data.firstPath * (t / 10.5) ** 0.95
      : data.firstPath + (data.frames.length - 1 - data.firstPath) * clamp((t - 10.5) / 12.5);
    return data.frames[Math.min(data.frames.length - 1, Math.floor(progress))];
  }

  return {
    describe(seconds) {
      const frame = frameAt(seconds);
      if (frame.parents.length === 1) return '1 node · searching';
      if (!frame.path.length) return `${frame.parents.length} nodes · searching`;
      const improvement = 100 * (1 - frame.cost / data.frames[data.firstPath].cost);
      return `${frame.parents.length} nodes · route ${improvement.toFixed(1)}% shorter`;
    },
    draw(ctx, width, height, seconds, palette) {
      const t = clamp(seconds, 0, DURATION), frame = frameAt(t);
      const scale = Math.min(width * 0.91 / 1.6, height * 0.85);
      const project = point => [width / 2 + (point[0] - 0.8) * scale, height / 2 + (point[1] - 0.5) * scale];
      const unit = Math.max(0.65, Math.min(width / 700, height / 440));
      const points = data.points.map(project);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, width, height);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([]);
      data.obstacles.forEach(shape => obstacle(ctx, shape, project, scale, palette));

      ctx.strokeStyle = palette.fg;
      ctx.lineWidth = 0.85 * unit;
      ctx.globalAlpha = 0.36;
      ctx.beginPath();
      for (let i = 1; i < frame.parents.length; i++) {
        ctx.moveTo(...points[frame.parents[i]]);
        ctx.lineTo(...points[i]);
      }
      ctx.stroke();
      ctx.fillStyle = palette.fg;
      ctx.globalAlpha = 0.46;
      ctx.beginPath();
      for (let i = 0; i < frame.parents.length; i++) {
        ctx.moveTo(points[i][0] + unit, points[i][1]);
        ctx.arc(...points[i], unit, 0, TAU);
      }
      ctx.fill();

      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 1.6 * unit;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      for (let i = Math.max(1, frame.parents.length - 8); i < frame.parents.length; i++) {
        ctx.moveTo(...points[frame.parents[i]]);
        ctx.lineTo(...points[i]);
      }
      for (const i of frame.rewired) {
        ctx.moveTo(...points[frame.parents[i]]);
        ctx.lineTo(...points[i]);
      }
      ctx.stroke();

      if (frame.path.length) {
        const path = frame.path.map(i => points[i]).concat([project(data.goal)]);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = palette.accent;
        ctx.lineWidth = 2.5 * unit;
        ctx.beginPath();
        ctx.moveTo(...path[0]);
        path.slice(1).forEach(point => ctx.lineTo(...point));
        ctx.stroke();
        const lengths = path.slice(1).map((point, i) => distance(point, path[i]));
        let remaining = ((t - 10.5) * 0.24 % 1) * lengths.reduce((sum, length) => sum + length, 0);
        for (let i = 0; i < lengths.length; i++) {
          if (remaining > lengths[i]) {
            remaining -= lengths[i];
            continue;
          }
          const fraction = remaining / lengths[i];
          ctx.fillStyle = palette.fg;
          ctx.beginPath();
          ctx.arc(path[i][0] + fraction * (path[i + 1][0] - path[i][0]), path[i][1] + fraction * (path[i + 1][1] - path[i][1]), 2.5 * unit, 0, TAU);
          ctx.fill();
          break;
        }
      }
      endpoint(ctx, points[0], 4 * unit, true, palette);
      endpoint(ctx, project(data.goal), 4.7 * unit, false, palette);
      ctx.restore();
    }
  };
}
