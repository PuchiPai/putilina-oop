import { Shape } from './Shape';
import { Rect } from './Rect';
import { Line } from './Line';
import { Oval } from './Oval';
import { Triangle } from './Triangle';
import { QuadraticBezier } from './QuadraticBezier';
import { CubicBezier } from './CubicBezier';
import { PathBezier } from './PathBezier';
import type { Transform } from './types';

export class ShapeFactory {
    static fromJSON(data: any): Shape {
        const { id, type, transform, ...rest } = data;
        const t: Transform = transform;
        switch (type) {
            case 'rect':
                return new Rect(id, t, rest.width, rest.height);
            case 'line':
                return new Line(id, t, rest.x1, rest.y1, rest.x2, rest.y2);
            case 'oval':
                return new Oval(id, t, rest.radiusX, rest.radiusY);
            case 'triangle':
                return new Triangle(id, t,
                rest.points[0].x, rest.points[0].y,
                rest.points[1].x, rest.points[1].y,
                rest.points[2].x, rest.points[2].y,
                );
            case 'quadratic-bezier':
                return new QuadraticBezier(id, t, rest.p0, rest.p1, rest.p2);
            case 'cubic-bezier':
                return new CubicBezier(id, t, rest.p0, rest.p1, rest.p2, rest.p3);
            case 'path-bezier':
                return new PathBezier(id, t, rest.points, rest.mode, rest.closed);
            default:
                throw new Error(`Unknown shape type: ${type}`);
        }
    }
}