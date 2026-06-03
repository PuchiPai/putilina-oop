import { Shape } from './Shape';
import type { Transform, Bounds, Point, IRenderer } from './types';

export type PathMode = 'polyline' | 'bezier' | 'catmull';

export class PathBezier extends Shape {
    public points: Point[] = [];
    public mode: PathMode = 'polyline';
    public closed: boolean = false;

    constructor(id: string, transform: Transform, points: Point[] = [], mode: PathMode = 'polyline', closed = false) {
        super(id, transform);
        this.points = points;
        this.mode = mode;
        this.closed = closed;
    }

    private catmullToBeziers(): Point[][] {
        const pts = this.points;
        if (pts.length < 2) return [];
        const n = pts.length;
        const get = (i: number) => pts[(i + n) % n];
        const count = this.closed ? n : n - 1;
        const segments: Point[][] = [];

        for (let i = 0; i < count; i++) {
            const p0 = this.closed ? get(i - 1) : (i === 0 ? pts[0] : pts[i - 1]);
            const p1 = pts[i];
            const p2 = this.closed ? get(i + 1) : (i + 1 < n ? pts[i + 1] : pts[n - 1]);
            const p3 = this.closed ? get(i + 2) : (i + 2 < n ? pts[i + 2] : pts[n - 1]);

            const tension = 0.5;
            const cp1: Point = {
                x: p1.x + (p2.x - p0.x) * tension / 2,
                y: p1.y + (p2.y - p0.y) * tension / 2,
            };
            const cp2: Point = {
                x: p2.x - (p3.x - p1.x) * tension / 2,
                y: p2.y - (p3.y - p1.y) * tension / 2,
            };
            segments.push([p1, cp1, cp2, p2]);
        }
        return segments;
    }

    private cubicToPoints(P0: Point, P1: Point, P2: Point, P3: Point, segments: number): Point[] {
        const pts: Point[] = [];
        const transform = (p: Point) => this.transformPointToDevice(p.x, p.y);
        const dp0 = transform(P0);
        const dp1 = transform(P1);
        const dp2 = transform(P2);
        const dp3 = transform(P3);

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const mt = 1 - t;
            const x = mt*mt*mt*dp0.x + 3*mt*mt*t*dp1.x + 3*mt*t*t*dp2.x + t*t*t*dp3.x;
            const y = mt*mt*mt*dp0.y + 3*mt*mt*t*dp1.y + 3*mt*t*t*dp2.y + t*t*t*dp3.y;
            pts.push({ x, y });
        }
        return pts;
    }

    getFlattenedDevice(segmentsPerCurve = 32): Point[] {
        const result: Point[] = [];
        const pts = this.points;

        if (this.mode === 'polyline') {
            const end = this.closed ? pts.length : pts.length - 1;
            for (let i = 0; i < end; i++) {
                result.push(this.transformPointToDevice(pts[i].x, pts[i].y));
            }
            if (this.closed && pts.length > 0) {
                result.push(this.transformPointToDevice(pts[0].x, pts[0].y));
            }
        }
        else if (this.mode === 'bezier') {
            const pts = this.points;
            const segments: Point[][] = [];
            const n = pts.length;

            for (let i = 0; i < n - 1; i++) {
                const p0 = pts[i === 0 ? i : i - 1];
                const p1 = pts[i];
                const p2 = pts[i + 1];
                const p3 = i + 2 < n ? pts[i + 2] : pts[i + 1];
                const t = 0.5;
                const cp1 = {
                    x: p1.x + (p2.x - p0.x) * t * 0.5,
                    y: p1.y + (p2.y - p0.y) * t * 0.5,
                };
                const cp2 = {
                    x: p2.x - (p3.x - p1.x) * t * 0.5,
                    y: p2.y - (p3.y - p1.y) * t * 0.5,
                };
                segments.push([p1, cp1, cp2, p2]);
            }

            for (const [P0, P1, P2, P3] of segments) {
                const segmentPoints = this.cubicToPoints(P0, P1, P2, P3, segmentsPerCurve);
                if (result.length > 0) result.pop();
                result.push(...segmentPoints);
            }
        }
        else if (this.mode === 'catmull') {
            const bezSegments = this.catmullToBeziers();
            for (let i = 0; i < bezSegments.length; i++) {
                const [P0, P1, P2, P3] = bezSegments[i];
                const segmentPoints = this.cubicToPoints(P0, P1, P2, P3, segmentsPerCurve);
                if (result.length > 0 && segmentPoints.length > 0) {
                    result.pop();
                }
                result.push(...segmentPoints);
            }
        }
        return result;
    }

    // ИСПРАВЛЕНО: центр через bounding box
    override getCenter(): Point {
        const b = this.getLocalBounds();
        return {
            x: (b.minX + b.maxX) / 2,
            y: (b.minY + b.maxY) / 2
        };
    }

    override draw(r: IRenderer): void {
        const stroke = this.getEffectiveStrokeColor();
        if (!stroke || this.strokeWidth <= 0) return;
        const flat = this.getFlattenedDevice();
        if (flat.length < 2) return;
        r.strokePolygon(flat, stroke, this.strokeWidth, this.closed);
    }

    override hitTest(px: number, py: number): boolean {
        const local = this.transformPointToLocal(px, py);
        if (!local) return false;
        const threshold = Math.max(5, this.strokeWidth / 2 + 2);

        if (this.mode === 'polyline') {
            return this.hitTestPolyline(local, threshold);
        } else if (this.mode === 'bezier') {
            const bezierCount = Math.floor(this.points.length / 4);
            for (let i = 0; i < bezierCount; i++) {
                const base = i * 4;
                if (this.hitTestCubicBezier(local, this.points[base], this.points[base+1], this.points[base+2], this.points[base+3], threshold))
                    return true;
            }
            return false;
        } else if (this.mode === 'catmull') {
            const segs = this.catmullToBeziers();
            for (const [p0, p1, p2, p3] of segs) {
                if (this.hitTestCubicBezier(local, p0, p1, p2, p3, threshold)) return true;
            }
            return false;
        }
        return false;
    }

    private hitTestPolyline(localPt: Point, threshold: number): boolean {
        const pts = this.points;
        for (let i = 0; i < pts.length - 1; i++) {
            if (this.distToSegment(localPt, pts[i], pts[i+1]) <= threshold) return true;
        }
        if (this.closed && pts.length > 1) {
            if (this.distToSegment(localPt, pts[pts.length-1], pts[0]) <= threshold) return true;
        }
        return false;
    }

    private hitTestCubicBezier(localPt: Point, p0: Point, p1: Point, p2: Point, p3: Point, threshold: number): boolean {
        const steps = 50;
        for (let i = 0; i < steps; i++) {
            const t1 = i / steps;
            const t2 = (i + 1) / steps;
            const pt1 = this.evalCubic(t1, p0, p1, p2, p3);
            const pt2 = this.evalCubic(t2, p0, p1, p2, p3);
            if (this.distToSegment(localPt, pt1, pt2) <= threshold) return true;
        }
        return false;
    }

    private evalCubic(t: number, p0: Point, p1: Point, p2: Point, p3: Point): Point {
        const mt = 1 - t;
        return {
            x: mt*mt*mt*p0.x + 3*mt*mt*t*p1.x + 3*mt*t*t*p2.x + t*t*t*p3.x,
            y: mt*mt*mt*p0.y + 3*mt*mt*t*p1.y + 3*mt*t*t*p2.y + t*t*t*p3.y,
        };
    }

    private distToSegment(p: Point, a: Point, b: Point): number {
        const dx = b.x - a.x, dy = b.y - a.y;
        const lenSq = dx*dx + dy*dy;
        if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
        let t = ((p.x - a.x)*dx + (p.y - a.y)*dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const projX = a.x + t*dx, projY = a.y + t*dy;
        return Math.hypot(p.x - projX, p.y - projY);
    }

    override getLocalBounds(): Bounds {
        const xs = this.points.map(p => p.x);
        const ys = this.points.map(p => p.y);

        return {
            minX: Math.min(...xs),
            minY: Math.min(...ys),
            maxX: Math.max(...xs),
            maxY: Math.max(...ys),
        };
    }

    override getBounds(): Bounds {
        const flat = this.getFlattenedDevice();
        if (flat.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        const xs = flat.map(p => p.x);
        const ys = flat.map(p => p.y);
        return {
            minX: Math.min(...xs),
            minY: Math.min(...ys),
            maxX: Math.max(...xs),   // было Math.max(...xs) дважды, исправлено на ...ys
            maxY: Math.max(...ys)
        };
    }

    addPoint(localPt: Point, index?: number): void {
        if (index !== undefined) this.points.splice(index, 0, localPt);
        else this.points.push(localPt);
    }

    removePoint(index: number): void {
        if (index >= 0 && index < this.points.length) this.points.splice(index, 1);
    }

    getControlPoints(): Point[] {
        return [...this.points];
    }

    setControlPoint(index: number, localPt: Point): void {
        if (index >= 0 && index < this.points.length) this.points[index] = localPt;
    }

    override clone(): PathBezier {
        const cloned = new PathBezier(
            this.id + '_copy',
            { ...this.transform },
            this.points.map(p => ({ ...p })),
            this.mode,
            this.closed
        );
        cloned.fillColor = this.fillColor ? { ...this.fillColor } : null;
        cloned.fillOpacity = this.fillOpacity;
        cloned.strokeColor = this.strokeColor ? { ...this.strokeColor } : null;
        cloned.strokeWidth = this.strokeWidth;
        cloned.strokeOpacity = this.strokeOpacity;
        return cloned;
    }

    private static pointToSegmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
        const dx = x2 - x1, dy = y2 - y1;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.hypot(px - x1, py - y1);
        let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const projX = x1 + t * dx, projY = y1 + t * dy;
        return Math.hypot(px - projX, py - projY);
    }

    insertPointNear(localPt: Point): void {
        const pts = this.points;
        if (pts.length <= 1) {
            this.addPoint(localPt);
            return;
        }
        let minDist = Infinity, insertIndex = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            const d = PathBezier.pointToSegmentDist(localPt.x, localPt.y, pts[i].x, pts[i].y, pts[i+1].x, pts[i+1].y);
            if (d < minDist) { minDist = d; insertIndex = i; }
        }
        if (this.closed) {
            const d = PathBezier.pointToSegmentDist(localPt.x, localPt.y, pts[pts.length-1].x, pts[pts.length-1].y, pts[0].x, pts[0].y);
            if (d < minDist) insertIndex = pts.length - 1;
        }
        this.addPoint(localPt, insertIndex + 1);
    }

    override toJSON(): any {
        return {
            id: this.id,
            type: 'path-bezier',
            transform: { ...this.transform },
            points: this.points,
            mode: this.mode,
            closed: this.closed,
            strokeStyle: this.strokeColor ? `rgba(${this.strokeColor.r},${this.strokeColor.g},${this.strokeColor.b},${this.strokeOpacity})` : null,
            strokeWidth: this.strokeWidth,
        };
    }
}