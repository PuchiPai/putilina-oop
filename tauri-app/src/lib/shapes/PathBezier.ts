import { Shape } from './Shape';
import type { Transform, Bounds, Point, IRenderer } from './types';

export type PathMode = 'polyline' | 'bezier' | 'catmull';

export class PathBezier extends Shape {
    public points: Point[] = [];      // локальные опорные точки
    public mode: PathMode = 'polyline';
    public closed: boolean = false;

    constructor(id: string, transform: Transform, points: Point[] = [], mode: PathMode = 'polyline', closed = false) {
        super(id, transform);
        this.points = points;
        this.mode = mode;
        this.closed = closed;
    }

    // Преобразование Catmull-Rom (tension=0.5) в кубические сегменты (в локальных коорд.)
    private catmullToBeziers(): Point[][] {
        const pts = this.points;
        if (pts.length < 2) return [];
        const segments: Point[][] = [];
        const n = pts.length;
        // Для замкнутого контура зацикливаем индексы
        const get = (i: number) => pts[(i + n) % n];
        const count = this.closed ? n : n - 1;
        for (let i = 0; i < count; i++) {
            const p0 = this.closed ? get(i - 1) : (i === 0 ? pts[0] : pts[i - 1]);
            const p1 = pts[i];
            const p2 = this.closed ? get(i + 1) : (i + 1 < n ? pts[i + 1] : pts[n - 1]);
            const p3 = this.closed ? get(i + 2) : (i + 2 < n ? pts[i + 2] : pts[n - 1]);

            const cp1: Point = {
                x: p1.x + (p2.x - p0.x) / 6,
                y: p1.y + (p2.y - p0.y) / 6,
            };
            const cp2: Point = {
                x: p2.x - (p3.x - p1.x) / 6,
                y: p2.y - (p3.y - p1.y) / 6,
            };
            segments.push([p1, cp1, cp2, p2]);
        }
        return segments;
    }

    // Получение экранной ломаной (аппроксимация всего пути)
    getFlattenedDevice(segmentsPerCurve = 32): Point[] {
        const devicePoints: Point[] = [];
        const transformPoint = (p: Point) => this.transformPointToDevice(p.x, p.y);

        if (this.mode === 'polyline') {
            for (const pt of this.points) devicePoints.push(transformPoint(pt));
        } else if (this.mode === 'bezier') {
            // Интерпретируем точки как последовательность кубических сегментов: p0,cp1,cp2,p3, ...
            const pts = this.points;
            for (let i = 0; i + 3 < pts.length; i += 4) {
                const P0 = transformPoint(pts[i]);
                const P1 = transformPoint(pts[i + 1]);
                const P2 = transformPoint(pts[i + 2]);
                const P3 = transformPoint(pts[i + 3]);
                for (let s = 0; s <= segmentsPerCurve; s++) {
                    const t = s / segmentsPerCurve;
                    const mt = 1 - t;
                    const x = mt * mt * mt * P0.x + 3 * mt * mt * t * P1.x + 3 * mt * t * t * P2.x + t * t * t * P3.x;
                    const y = mt * mt * mt * P0.y + 3 * mt * mt * t * P1.y + 3 * mt * t * t * P2.y + t * t * t * P3.y;
                    devicePoints.push({ x, y });
                }
            }
        } else if (this.mode === 'catmull') {
            const bezierSegments = this.catmullToBeziers();
            for (const [P0, P1, P2, P3] of bezierSegments) {
                const dp0 = transformPoint(P0);
                const dp1 = transformPoint(P1);
                const dp2 = transformPoint(P2);
                const dp3 = transformPoint(P3);
                for (let s = 0; s <= segmentsPerCurve; s++) {
                    const t = s / segmentsPerCurve;
                    const mt = 1 - t;
                    const x = mt * mt * mt * dp0.x + 3 * mt * mt * t * dp1.x + 3 * mt * t * t * dp2.x + t * t * t * dp3.x;
                    const y = mt * mt * mt * dp0.y + 3 * mt * mt * t * dp1.y + 3 * mt * t * t * dp2.y + t * t * t * dp3.y;
                    devicePoints.push({ x, y });
                }
            }
        }
        return devicePoints;
    }

    override draw(r: IRenderer): void {
        const stroke = this.getEffectiveStrokeColor();
        if (!stroke || this.strokeWidth <= 0) return;
        const flat = this.getFlattenedDevice();
        if (flat.length < 2) return;
        r.strokePolygon(flat, stroke, this.strokeWidth, this.closed);
    }

    override hitTest(px: number, py: number): boolean {
        const flat = this.getFlattenedDevice();
        const threshold = Math.max(5, this.strokeWidth / 2 + 2);
        let minDist = Infinity;
        const count = this.closed ? flat.length : flat.length - 1;
        for (let i = 0; i < count; i++) {
            const a = flat[i];
            const b = flat[(i + 1) % flat.length];
            const dx = b.x - a.x, dy = b.y - a.y;
            const lenSq = dx * dx + dy * dy;
            let dist: number;
            if (lenSq === 0) {
                dist = Math.hypot(px - a.x, py - a.y);
            } else {
                let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq;
                t = Math.max(0, Math.min(1, t));
                const projX = a.x + t * dx;
                const projY = a.y + t * dy;
                dist = Math.hypot(px - projX, py - projY);
            }
            if (dist < minDist) minDist = dist;
        }
        return minDist <= threshold;
    }

    override getLocalBounds(): Bounds {
        if (this.points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
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
            maxX: Math.max(...xs),
            maxY: Math.max(...ys),
        };
    }

    // Редактирование
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