import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Rect } from './Rect';
import { Line } from './Line';
import { Oval } from './Oval';
import { ShapeFactory } from './ShapeFactory';
import { ShapeManager } from './ShapeManager';
import { RendererAdapter } from './RendererAdapter';
import type { Transform, IRenderer, Point } from './types';
import type { RGBA } from '../raster/RasterRenderer';

// ----------------------------------------------------------------------
// Вспомогательные утилиты для тестов
// ----------------------------------------------------------------------

/** Создать простой трансформ для тестов */
function makeTransform(overrides: Partial<Transform> = {}): Transform {
    return {
        x: 0,
        y: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        ...overrides,
    };
}

/** Сравнение двух объектов Point с допустимой погрешностью */
function expectPointClose(actual: Point, expected: Point, eps = 1e-9): void {
    expect(actual.x).toBeCloseTo(expected.x, Math.abs(Math.log10(eps)));
    expect(actual.y).toBeCloseTo(expected.y, Math.abs(Math.log10(eps)));
}

/** Создать мок-рендерер, который только считает вызовы */
function createMockRenderer(): IRenderer {
    return {
        width: 800,
        height: 600,
        fillPolygon: vi.fn(),
        strokePolygon: vi.fn(),
        strokeLine: vi.fn(),
        fillCircle: vi.fn(),
        setLineAlgorithm: vi.fn(),
    };
}

// ----------------------------------------------------------------------
// Тесты для конкретных фигур
// ----------------------------------------------------------------------

describe('Rect', () => {
    let rect: Rect;

    beforeEach(() => {
        rect = new Rect('r1', makeTransform({ x: 100, y: 50 }), 80, 60);
    });

    it('должен правильно вычислять локальные границы', () => {
        const bounds = rect.getLocalBounds();
        expect(bounds).toEqual({
            minX: -40,
            minY: -30,
            maxX: 40,
            maxY: 30,
        });
    });

    it('должен вычислять границы в экранных координатах без трансформации', () => {
        const bounds = rect.getBounds();
        expect(bounds).toEqual({
            minX: 60,  // 100 - 40
            minY: 20,  // 50 - 30
            maxX: 140, // 100 + 40
            maxY: 80,  // 50 + 30
        });
    });

    it('должен корректно транслировать точку в локальные координаты', () => {
        // Клик в центр
        const local = rect.transformPointToLocal(100, 50);
        expect(local).not.toBeNull();
        expectPointClose(local!, { x: 0, y: 0 });

        // Клик в правый верхний угол
        const cornerLocal = rect.transformPointToLocal(140, 80);
        expectPointClose(cornerLocal!, { x: 40, y: 30 });
    });

    describe('hitTest', () => {
        it('должен возвращать true для точек внутри прямоугольника', () => {
            expect(rect.hitTest(100, 50)).toBe(true);   // центр
            expect(rect.hitTest(120, 40)).toBe(true);   // внутри
            expect(rect.hitTest(80, 60)).toBe(true);    // внутри
        });

        it('должен возвращать false для точек снаружи', () => {
            expect(rect.hitTest(150, 50)).toBe(false);  // справа
            expect(rect.hitTest(50, 50)).toBe(false);   // слева
            expect(rect.hitTest(100, 100)).toBe(false); // снизу
        });

        it('должен корректно работать при повороте', () => {
            const rotated = new Rect('r2', makeTransform({ x: 0, y: 0, rotation: Math.PI / 2 }), 80, 60);
            // После поворота на 90° ширина и высота меняются местами
            expect(rotated.hitTest(25, 0)).toBe(true);   // было x -> y
            expect(rotated.hitTest(50, 0)).toBe(false);  // за пределами новой ширины
        });
    });

    it('должен создавать корректную копию (clone)', () => {
        rect.fillColor = { r: 255, g: 0, b: 0, a: 200 };
        const clone = rect.clone();
        expect(clone).not.toBe(rect);
        expect(clone.id).toBe('r1_copy');
        expect(clone.width).toBe(rect.width);
        expect(clone.height).toBe(rect.height);
        expect(clone.transform).toEqual(rect.transform);
        expect(clone.fillColor).toEqual(rect.fillColor);
        // Изменение клона не должно влиять на оригинал
        clone.transform.x = 999;
        expect(rect.transform.x).toBe(100);
    });

    it('должен правильно сериализоваться в JSON', () => {
        const json = rect.toJSON();
        expect(json).toMatchObject({
            id: 'r1',
            type: 'rect',
            width: 80,
            height: 60,
        });
        expect(json.transform).toEqual(rect.transform);
    });

    it('должен рисоваться через IRenderer без ошибок', () => {
        const mockRenderer = createMockRenderer();
        rect.draw(mockRenderer);
        expect(mockRenderer.fillPolygon).toHaveBeenCalled();
        expect(mockRenderer.strokePolygon).toHaveBeenCalled();
    });
});

describe('Line', () => {
    let line: Line;

    beforeEach(() => {
        // Отрезок от (0,0) до (100,0) с центром в (50,0)
        line = new Line('l1', makeTransform({ x: 0, y: 0 }), 0, 0, 100, 0);
    });

    it('должен правильно хранить локальные координаты', () => {
        expect(line.x1).toBeCloseTo(-50);
        expect(line.y1).toBeCloseTo(0);
        expect(line.x2).toBeCloseTo(50);
        expect(line.y2).toBeCloseTo(0);
    });

    it('должен вычислять локальные границы', () => {
        const bounds = line.getLocalBounds();
        expect(bounds.minX).toBeCloseTo(-50);
        expect(bounds.maxX).toBeCloseTo(50);
        expect(bounds.minY).toBeCloseTo(0);
        expect(bounds.maxY).toBeCloseTo(0);
    });

    it('должен вычислять границы в экране с учётом трансляции', () => {
        const moved = new Line('l2', makeTransform({ x: 10, y: 20 }), 0, 0, 100, 0);
        const bounds = moved.getBounds();
        // В конструкторе центр добавляется к transform, поэтому фактический центр = (10+50, 20+0) = (60,20)
        // Концы отрезка: (60-50,20) = (10,20) и (60+50,20) = (110,20)
        expect(bounds.minX).toBeCloseTo(10);
        expect(bounds.maxX).toBeCloseTo(110);
        expect(bounds.minY).toBeCloseTo(20);
        expect(bounds.maxY).toBeCloseTo(20);
    });

    describe('hitTest', () => {
        it('должен определять попадание на отрезок', () => {
            expect(line.hitTest(50, 0)).toBe(true);    // середина
            expect(line.hitTest(0, 0)).toBe(true);     // начало (экранное)
            expect(line.hitTest(100, 0)).toBe(true);   // конец
            expect(line.hitTest(50, 3)).toBe(true);    // рядом
        });

        it('должен возвращать false для удалённых точек', () => {
            expect(line.hitTest(50, 20)).toBe(false);
            expect(line.hitTest(-10, 0)).toBe(false);
        });

        it('должен учитывать толщину линии при hitTest', () => {
            line.strokeWidth = 10;
            expect(line.hitTest(50, 6)).toBe(true);    // в пределах толщины
            expect(line.hitTest(50, 12)).toBe(false);  // за пределами
        });
    });

    it('должен создавать корректную копию', () => {
        const clone = line.clone();
        expect(clone.id).toBe('l1_copy');
        expect(clone.x1).toBe(line.x1);
        expect(clone.y1).toBe(line.y1);
        expect(clone.x2).toBe(line.x2);
        expect(clone.y2).toBe(line.y2);
        expect(clone.transform).toEqual(line.transform);
    });

    it('должен сериализоваться с абсолютными координатами', () => {
        const json = line.toJSON();
        expect(json).toMatchObject({
            id: 'l1',
            type: 'line',
            x1: 0,
            y1: 0,
            x2: 100,
            y2: 0,
        });
    });
});

describe('Oval', () => {
    let oval: Oval;

    beforeEach(() => {
        oval = new Oval('o1', makeTransform({ x: 200, y: 150 }), 80, 40);
    });

    it('должен правильно вычислять локальные границы', () => {
        const bounds = oval.getLocalBounds();
        expect(bounds).toEqual({
            minX: -80,
            minY: -40,
            maxX: 80,
            maxY: 40,
        });
    });

    it('должен вычислять экранные границы без поворота', () => {
        const bounds = oval.getBounds();
        expect(bounds.minX).toBeCloseTo(120);
        expect(bounds.maxX).toBeCloseTo(280);
        expect(bounds.minY).toBeCloseTo(110);
        expect(bounds.maxY).toBeCloseTo(190);
    });

    describe('hitTest', () => {
        it('должен возвращать true для точек внутри эллипса', () => {
            expect(oval.hitTest(200, 150)).toBe(true); // центр
            expect(oval.hitTest(240, 150)).toBe(true); // на границе по X
            expect(oval.hitTest(200, 170)).toBe(true); // внутри
        });

        it('должен возвращать false для точек снаружи', () => {
            expect(oval.hitTest(300, 150)).toBe(false);
            expect(oval.hitTest(200, 200)).toBe(false);
        });

        it('должен корректно работать при масштабировании', () => {
            const scaled = new Oval('o2', makeTransform({ x: 0, y: 0, scaleX: 2, scaleY: 1 }), 50, 30);
            // После масштаба эффективные радиусы: rx = 100, ry = 30
            expect(scaled.hitTest(90, 0)).toBe(true);
            expect(scaled.hitTest(110, 0)).toBe(false);
        });
    });

    it('должен создавать копию', () => {
        const clone = oval.clone();
        expect(clone.id).toBe('o1_copy');
        expect(clone.radiusX).toBe(80);
        expect(clone.radiusY).toBe(40);
    });
});

// ----------------------------------------------------------------------
// Тесты фабрики и менеджера
// ----------------------------------------------------------------------

describe('ShapeFactory', () => {
    it('должен восстанавливать Rect из JSON', () => {
        const json = {
            id: 'test-rect',
            type: 'rect',
            transform: { x: 10, y: 20, rotation: 0.5, scaleX: 2, scaleY: 1 },
            width: 100,
            height: 50,
        };
        const shape = ShapeFactory.fromJSON(json);
        expect(shape).toBeInstanceOf(Rect);
        expect(shape.id).toBe('test-rect');
        expect((shape as Rect).width).toBe(100);
        expect(shape.transform.rotation).toBe(0.5);
    });

    it('должен восстанавливать Line из JSON', () => {
        const json = {
            id: 'test-line',
            type: 'line',
            transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            x1: 10, y1: 20, x2: 30, y2: 40,
        };
        const shape = ShapeFactory.fromJSON(json);
        expect(shape).toBeInstanceOf(Line);
    });

    it('должен восстанавливать Oval из JSON', () => {
        const json = {
            id: 'test-oval',
            type: 'oval',
            transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            radiusX: 30,
            radiusY: 20,
        };
        const shape = ShapeFactory.fromJSON(json);
        expect(shape).toBeInstanceOf(Oval);
    });

    it('должен выбрасывать ошибку для неизвестного типа', () => {
        const json = { id: 'bad', type: 'hexagon' }; // неизвестный тип
        expect(() => ShapeFactory.fromJSON(json)).toThrow(/Unknown shape type/);
    });
});

describe('ShapeManager', () => {
    let manager: ShapeManager;
    let rect: Rect;
    let line: Line;

    beforeEach(() => {
        manager = new ShapeManager();
        rect = new Rect('r1', makeTransform(), 10, 10);
        line = new Line('l1', makeTransform(), 0, 0, 10, 10);
    });

    it('должен добавлять и получать фигуры', () => {
        manager.add(rect);
        manager.add(line);
        expect(manager.getShapes()).toHaveLength(2);
    });

    it('должен удалять фигуру по id', () => {
        manager.add(rect);
        manager.add(line);
        manager.remove('r1');
        expect(manager.getShapes()).toHaveLength(1);
        expect(manager.getShapes()[0].id).toBe('l1');
    });

    it('должен управлять выделением', () => {
        manager.add(rect);
        manager.add(line);
        manager.select('r1');
        expect(manager.getSelected()).toHaveLength(1);
        expect(manager.getSelected()[0].id).toBe('r1');

        manager.select('l1', true); // multi
        expect(manager.getSelected()).toHaveLength(2);

        manager.clearSelection();
        expect(manager.getSelected()).toHaveLength(0);
    });

    it('должен сериализовать и загружать данные', () => {
        manager.add(rect);
        manager.add(line);
        const json = manager.toJSON();
        expect(json).toHaveLength(2);

        const newManager = new ShapeManager();
        newManager.loadFromJSON(json);
        expect(newManager.getShapes()).toHaveLength(2);
        expect(newManager.getShapes()[0]).toBeInstanceOf(Rect);
    });
});

// ----------------------------------------------------------------------
// Интеграционный тест с RendererAdapter (проверка, что не падает)
// ----------------------------------------------------------------------

describe('RendererAdapter', () => {
    it('должен проксировать вызовы в RasterRenderer', () => {
        const mockRaster = {
            width: 100,
            height: 100,
            fillPolygon: vi.fn(),
            strokePolygon: vi.fn(),
            strokeLine: vi.fn(),
            fillCircle: vi.fn(),
            setLineAlgorithm: vi.fn(),
        } as any;

        const adapter = new RendererAdapter(mockRaster);
        const points: Point[] = [{ x: 0, y: 0 }];
        const color: RGBA = { r: 255, g: 0, b: 0, a: 255 };

        adapter.fillPolygon(points, color);
        expect(mockRaster.fillPolygon).toHaveBeenCalledWith(points, color);

        adapter.strokePolygon(points, color, 2);
        expect(mockRaster.strokePolygon).toHaveBeenCalledWith(points, color, 2, true);

        adapter.strokeLine(0, 0, 10, 10, color, 3);
        expect(mockRaster.strokeLine).toHaveBeenCalledWith(0, 0, 10, 10, color, 3);

        adapter.fillCircle(5, 5, 10, color);
        expect(mockRaster.fillCircle).toHaveBeenCalledWith(5, 5, 10, color);

        adapter.setLineAlgorithm('wu');
        expect(mockRaster.setLineAlgorithm).toHaveBeenCalledWith('wu');
    });
});