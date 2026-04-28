import { Shape } from './Shape';
import type { Transform, Bounds, Point, IRenderer } from './types';

export class Oval extends Shape {
    public radiusX: number;
    public radiusY: number;

    constructor(id: string, transform: Transform, radiusX: number, radiusY: number) {
        super(id, transform);
        this.radiusX = radiusX;
        this.radiusY = radiusY;
    }

    override getLocalBounds(): Bounds {
        return {
            minX: -this.radiusX,
            minY: -this.radiusY,
            maxX: this.radiusX,
            maxY: this.radiusY,
        };
    }

    override getBounds(): Bounds {
        const angles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];
        const pts = angles.map(a => {
            const lx = this.radiusX * Math.cos(a);
            const ly = this.radiusY * Math.sin(a);
            return this.transformPointToDevice(lx, ly);
        });
        const xs = pts.map(p => p.x);
        const ys = pts.map(p => p.y);
        return {
            minX: Math.min(...xs),
            minY: Math.min(...ys),
            maxX: Math.max(...xs),
            maxY: Math.max(...ys),
        };
    }

    override draw(r: IRenderer): void {
        const steps = 64;
        const points: Point[] = [];
        for (let i = 0; i <= steps; i++) {
            const t = (i / steps) * 2 * Math.PI;
            const lx = this.radiusX * Math.cos(t);
            const ly = this.radiusY * Math.sin(t);
            points.push(this.transformPointToDevice(lx, ly));
        }
        const fill = this.getEffectiveFillColor();
        if (fill) r.fillPolygon(points, fill);
        const stroke = this.getEffectiveStrokeColor();
        if (stroke && this.strokeWidth > 0) {
            r.strokePolygon(points, stroke, this.strokeWidth);
        }
    }

    override hitTest(px: number, py: number): boolean {
        const local = this.transformPointToLocal(px, py);
        if (!local) return false;
        const nx = local.x / this.radiusX;
        const ny = local.y / this.radiusY;
        return nx * nx + ny * ny <= 1;
    }

    override clone(): Oval {
        const cloned = new Oval(this.id + '_copy', { ...this.transform }, this.radiusX, this.radiusY);
        cloned.fillColor = this.fillColor ? { ...this.fillColor } : null;
        cloned.fillOpacity = this.fillOpacity;
        cloned.strokeColor = this.strokeColor ? { ...this.strokeColor } : null;
        cloned.strokeWidth = this.strokeWidth;
        cloned.strokeOpacity = this.strokeOpacity;
        return cloned;
    }

    override toJSON(): any {
        return {
            id: this.id,
            type: 'oval',
            transform: { ...this.transform },
            radiusX: this.radiusX,
            radiusY: this.radiusY,
            fillStyle: this.fillColor ? `rgba(${this.fillColor.r},${this.fillColor.g},${this.fillColor.b},${this.fillOpacity})` : null,
            strokeStyle: this.strokeColor ? `rgba(${this.strokeColor.r},${this.strokeColor.g},${this.strokeColor.b},${this.strokeOpacity})` : null,
            strokeWidth: this.strokeWidth,
        };
    }
}