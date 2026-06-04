import { Shape } from './Shape';
import type { Transform, Bounds, Point, IRenderer } from './types';

export class Triangle extends Shape {
    private localA: Point;
    private localB: Point;
    private localC: Point;

    constructor(
        id: string,
        transform: Transform,
        ax: number,
        ay: number,
        bx: number,
        by: number,
        cx: number,
        cy: number
    ) {
        const centerX = (ax + bx + cx) / 3;
        const centerY = (ay + by + cy) / 3;

        const adjustedTransform: Transform = {
            ...transform,
            x: transform.x + centerX,
            y: transform.y + centerY,
        };

        super(id, adjustedTransform);

        this.localA = { x: ax - centerX, y: ay - centerY };
        this.localB = { x: bx - centerX, y: by - centerY };
        this.localC = { x: cx - centerX, y: cy - centerY };
    }

    override getCenter(): Point {
        return { x: 0, y: 0 };
    }

    private sign(p1: Point, p2: Point, p3: Point): number {
        return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
    }

    override hitTest(px: number, py: number): boolean {
        const local = this.transformPointToLocal(px, py);
        if (!local) return false;

        const d1 = this.sign(local, this.localA, this.localB);
        const d2 = this.sign(local, this.localB, this.localC);
        const d3 = this.sign(local, this.localC, this.localA);

        const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
        const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);

        return !(hasNeg && hasPos);
    }

    override getLocalBounds(): Bounds {
        const xs = [this.localA.x, this.localB.x, this.localC.x];
        const ys = [this.localA.y, this.localB.y, this.localC.y];
        return {
            minX: Math.min(...xs),
            minY: Math.min(...ys),
            maxX: Math.max(...xs),
            maxY: Math.max(...ys),
        };
    }

    override getBounds(): Bounds {
        const a = this.transformPointToDevice(this.localA.x, this.localA.y);
        const b = this.transformPointToDevice(this.localB.x, this.localB.y);
        const c = this.transformPointToDevice(this.localC.x, this.localC.y);

        const xs = [a.x, b.x, c.x];
        const ys = [a.y, b.y, c.y];

        return {
            minX: Math.min(...xs),
            minY: Math.min(...ys),
            maxX: Math.max(...xs),
            maxY: Math.max(...ys),
        };
    }

    override draw(r: IRenderer): void {
        const a = this.transformPointToDevice(this.localA.x, this.localA.y);
        const b = this.transformPointToDevice(this.localB.x, this.localB.y);
        const c = this.transformPointToDevice(this.localC.x, this.localC.y);

        const pts = [a, b, c];
        const fill = this.getEffectiveFillColor();
        if (fill) r.fillPolygon(pts, fill);

        const stroke = this.getEffectiveStrokeColor();
        if (stroke && this.strokeWidth > 0) r.strokePolygon(pts, stroke, this.strokeWidth);
    }

    override clone(): Triangle {
        const cloned = new Triangle(
            this.id + '_copy',
            { ...this.transform },
            this.localA.x + this.transform.x, this.localA.y + this.transform.y,
            this.localB.x + this.transform.x, this.localB.y + this.transform.y,
            this.localC.x + this.transform.x, this.localC.y + this.transform.y
        );

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
            type: 'triangle',
            transform: { ...this.transform },

            // важно: сохраняем ЛОКАЛЬНЫЕ точки, а не абсолютные
            points: [
                { ...this.localA },
                { ...this.localB },
                { ...this.localC },
            ],

            fillColor: this.fillColor ? { ...this.fillColor } : null,
            fillOpacity: this.fillOpacity,

            strokeColor: this.strokeColor ? { ...this.strokeColor } : null,
            strokeOpacity: this.strokeOpacity,
            strokeWidth: this.strokeWidth,
        };
    }
}