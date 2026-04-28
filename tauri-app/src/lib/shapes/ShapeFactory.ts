import { Shape } from './Shape';
import { Rect } from './Rect';
import { Line } from './Line';
import { Oval } from './Oval';
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
            default:
                throw new Error(`Unknown shape type: ${type}`);
        }
    }
}