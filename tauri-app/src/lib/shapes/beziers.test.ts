import { describe, it, expect } from 'vitest';
import { Triangle } from './Triangle';
import { QuadraticBezier } from './QuadraticBezier';
import { CubicBezier } from './CubicBezier';
import { PathBezier } from './PathBezier';

function makeTransform(overrides: any = {}) {
    return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, ...overrides };
}

describe('Triangle', () => {
    const tri = new Triangle('t1', makeTransform(), 0, -40, 40, 30, -40, 30);

    it('hitTest inside', () => {
        expect(tri.hitTest(0, 0)).toBe(true);
    });
    it('hitTest outside', () => {
        expect(tri.hitTest(50, 0)).toBe(false);
    });
    it('bounds after transform', () => {
        const t = new Triangle('t2', makeTransform({ x: 100, y: 100 }), 0, -40, 40, 30, -40, 30);
        const b = t.getBounds();
        expect(b.minX).toBeCloseTo(60);
        expect(b.maxX).toBeCloseTo(140);
    });
});

describe('QuadraticBezier', () => {
    const q = new QuadraticBezier('q1', makeTransform(),
        { x: 0, y: 0 }, { x: 50, y: -80 }, { x: 100, y: 0 }
    );

    it('hitTest near curve', () => {
        // При t=0.5 кривая проходит через (50, -40), а не (50, 0)
        const midPoint = q.evalLocal(0.5);
        expect(midPoint.x).toBeCloseTo(50);
        expect(midPoint.y).toBeCloseTo(-40);

        // Точка на кривой должна обнаруживаться
        expect(q.hitTest(50, -40)).toBe(true);
        // Точка далеко от кривой
        expect(q.hitTest(50, 30)).toBe(false);
    });

    it('bounds', () => {
        const b = q.getBounds();
        // Кривая лежит внутри bbox: x in [0,100], y in [-40,0]
        expect(b.minX).toBeLessThanOrEqual(0);
        expect(b.maxX).toBeGreaterThanOrEqual(100);
        expect(b.minY).toBeLessThanOrEqual(-40); // реальный минимум Y = -40
        expect(b.maxY).toBeGreaterThanOrEqual(0);
    });

    it('serialization round-trip', () => {
        const json = q.toJSON();
        expect(json.type).toBe('quadratic-bezier');
        expect(json.p0).toEqual({ x: 0, y: 0 });
    });
});

describe('CubicBezier', () => {
    const c = new CubicBezier('c1', makeTransform(),
        { x: 0, y: 0 }, { x: 30, y: -100 }, { x: 70, y: 100 }, { x: 100, y: 0 }
    );

    it('hitTest near curve', () => {
        // При t=0.5 кривая проходит примерно через (50, 0)
        const midPoint = c.evalLocal(0.5);
        expect(midPoint.x).toBeCloseTo(50);
        expect(midPoint.y).toBeCloseTo(0);
        // Точка рядом с кривой
        expect(c.hitTest(50, 2)).toBe(true);
        // Точка далеко
        expect(c.hitTest(50, 50)).toBe(false);
    });

    it('bounds contain control points', () => {
        const b = c.getBounds();
        // Кривая лежит внутри bbox, который на самом деле уже, чем контрольные точки
        // Минимум Y меньше -28.8, максимум Y больше 28.8
        expect(b.minX).toBeLessThanOrEqual(0);
        expect(b.maxX).toBeGreaterThanOrEqual(100);
        expect(b.minY).toBeLessThanOrEqual(-28.8);
        expect(b.maxY).toBeGreaterThanOrEqual(28.8);
    });
});

describe('PathBezier', () => {
    const pts = [{ x: 0, y: 0 }, { x: 40, y: -60 }, { x: 80, y: -20 }];
    const path = new PathBezier('p1', makeTransform(), pts, 'catmull', false);

    it('hitTest on path', () => {
        // Catmull-Rom проходит через опорные точки, так что (0,0) точно на пути
        expect(path.hitTest(0, 0)).toBe(true);
        expect(path.hitTest(20, 20)).toBe(false);
    });

    it('add/remove points', () => {
        const p = new PathBezier('p2', makeTransform(), [...pts], 'catmull', false);
        p.addPoint({ x: 100, y: 0 });
        expect(p.points.length).toBe(4);
        p.removePoint(1);
        expect(p.points.length).toBe(3);
    });

    it('serialization', () => {
        const json = path.toJSON();
        expect(json.type).toBe('path-bezier');
        expect(json.mode).toBe('catmull');
    });
});