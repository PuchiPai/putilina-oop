import { Shape } from './Shape';
import type { Transform, Bounds, Point, IRenderer } from './types';

export class QuadraticBezier extends Shape {
    public p0: Point;
    public p1: Point;
    public p2: Point;

    constructor(
        id: string,
        transform: Transform,
        p0: Point, p1: Point, p2: Point
    ) {
        super(id, transform);
        this.p0 = p0;
        this.p1 = p1;
        this.p2 = p2;
    }

    /** Точка на кривой в локальных координатах */
    evalLocal(t: number): Point {
        const mt = 1 - t;
        const x = mt * mt * this.p0.x + 2 * mt * t * this.p1.x + t * t * this.p2.x;
        const y = mt * mt * this.p0.y + 2 * mt * t * this.p1.y + t * t * this.p2.y;
        return { x, y };
    }

    /** Аппроксимация кривой ломаной в экранных координатах */
    flattenDevice(segments = 64): Point[] {
        const pts: Point[] = [];
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const lp = this.evalLocal(t);                  // используем evalLocal
            const dp = this.transformPointToDevice(lp.x, lp.y);
            pts.push(dp);
        }
        return pts;
    }

    override draw(r: IRenderer): void {
        const stroke = this.getEffectiveStrokeColor();
        if (!stroke || this.strokeWidth <= 0) return;
        const flat = this.flattenDevice();
        r.strokePolygon(flat, stroke, this.strokeWidth, false);
    }

    override hitTest(px: number, py: number): boolean {
        const flat = this.flattenDevice();
        const threshold = Math.max(5, this.strokeWidth / 2 + 2);
        let minDist = Infinity;
        for (let i = 0; i < flat.length - 1; i++) {
            const a = flat[i], b = flat[i + 1];
            const dx = b.x - a.x, dy = b.y - a.y;
            const lenSq = dx * dx + dy * dy;
            let dist: number;
            if (lenSq === 0) {
                dist = Math.hypot(px - a.x, py - a.y);
            } else {
                let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq;
                t = Math.max(0, Math.min(1, t));
                const projX = a.x + t * dx, projY = a.y + t * dy;
                dist = Math.hypot(px - projX, py - projY);
            }
            if (dist < minDist) minDist = dist;
        }
        return minDist <= threshold;
    }

    override getLocalBounds(): Bounds {
        const xs = [this.p0.x, this.p1.x, this.p2.x];
        const ys = [this.p0.y, this.p1.y, this.p2.y];
        return {
            minX: Math.min(...xs),
            minY: Math.min(...ys),
            maxX: Math.max(...xs),
            maxY: Math.max(...ys),
        };
    }

    override getBounds(): Bounds {
        const flat = this.flattenDevice();
        const xs = flat.map(p => p.x);
        const ys = flat.map(p => p.y);
        return {
            minX: Math.min(...xs),
            minY: Math.min(...ys),
            maxX: Math.max(...xs),
            maxY: Math.max(...ys),
        };
    }

    getControlPoints(): Point[] {
        return [this.p0, this.p1, this.p2];
    }

    setControlPoint(index: number, localPt: Point): void {
        if (index === 0) this.p0 = localPt;
        else if (index === 1) this.p1 = localPt;
        else if (index === 2) this.p2 = localPt;
    }

    override clone(): QuadraticBezier {
        const cloned = new QuadraticBezier(
            this.id + '_copy',
            { ...this.transform },
            { ...this.p0 }, { ...this.p1 }, { ...this.p2 }
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
            type: 'quadratic-bezier',
            transform: { ...this.transform },
            p0: this.p0, p1: this.p1, p2: this.p2,
            strokeStyle: this.strokeColor ? `rgba(${this.strokeColor.r},${this.strokeColor.g},${this.strokeColor.b},${this.strokeOpacity})` : null,
            strokeWidth: this.strokeWidth,
        };
    }
}