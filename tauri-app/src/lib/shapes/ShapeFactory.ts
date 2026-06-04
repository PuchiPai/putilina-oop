import { Shape } from './Shape';
import { Rect } from './Rect';
import { Line } from './Line';
import { Oval } from './Oval';
import { Triangle } from './Triangle';
import { QuadraticBezier } from './QuadraticBezier';
import { CubicBezier } from './CubicBezier';
import { PathBezier } from './PathBezier';
import type { Transform } from './types';
import type { RGBA } from '../raster/RasterRenderer';

function clamp255(v: any): number {
    const n = Number(v);
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(255, n));
}

function normalizeRGBA(value: any): RGBA | null {
    if (!value) return null;

    if (typeof value === 'string') {
        const m = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([0-9.]*)?\)/i);
        if (!m) return null;

        const r = clamp255(m[1]);
        const g = clamp255(m[2]);
        const b = clamp255(m[3]);
        const aRaw = m[4];

        let a = 255;
        if (aRaw !== undefined && aRaw !== '') {
            const alpha = Number(aRaw);
            a = alpha <= 1 ? Math.round(alpha * 255) : clamp255(alpha);
        }

        return { r, g, b, a };
    }

    if (typeof value === 'object') {
        return {
            r: clamp255(value.r),
            g: clamp255(value.g),
            b: clamp255(value.b),
            a: clamp255(value.a ?? 255),
        };
    }

    return null;
}

function applyStyle(shape: Shape, data: any): void {
    const fill = normalizeRGBA(data.fillColor ?? data.fillStyle);
    const stroke = normalizeRGBA(data.strokeColor ?? data.strokeStyle);

    if (fill) shape.fillColor = fill;
    if (stroke) shape.strokeColor = stroke;

    if (typeof data.fillOpacity === 'number') {
        shape.fillOpacity = data.fillOpacity;
    }

    if (typeof data.strokeOpacity === 'number') {
        shape.strokeOpacity = data.strokeOpacity;
    }

    if (typeof data.strokeWidth === 'number') {
        shape.strokeWidth = data.strokeWidth;
    }
}

export class ShapeFactory {
    static fromJSON(data: any): Shape {
        const { id, type, transform, ...rest } = data;
        const t: Transform = transform;

        let shape: Shape;

        switch (String(type).toLowerCase()) {
            case 'rect':
                shape = new Rect(id, t, rest.width, rest.height);
                break;

            case 'line':
                shape = new Line(id, t, rest.x1, rest.y1, rest.x2, rest.y2);
                break;

            case 'oval':
                shape = new Oval(id, t, rest.radiusX, rest.radiusY);
                break;

            case 'triangle':
                shape = new Triangle(
                    id,
                    t,
                    rest.points[0].x, rest.points[0].y,
                    rest.points[1].x, rest.points[1].y,
                    rest.points[2].x, rest.points[2].y
                );
                break;

            case 'quadratic-bezier':
            case 'quadratic':
            case 'quad':
                shape = new QuadraticBezier(id, t, rest.p0, rest.p1, rest.p2);
                break;

            case 'cubic-bezier':
            case 'cubic':
                shape = new CubicBezier(id, t, rest.p0, rest.p1, rest.p2, rest.p3);
                break;

            case 'path-bezier':
            case 'path':
                shape = new PathBezier(id, t, rest.points, rest.mode, rest.closed);
                break;

            default:
                throw new Error(`Unknown shape type: ${type}`);
        }

        applyStyle(shape, rest);
        return shape;
    }
}