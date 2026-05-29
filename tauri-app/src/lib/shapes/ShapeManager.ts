import { Shape } from './Shape';
import { ShapeFactory } from './ShapeFactory';

export class ShapeManager {
    private shapes: Shape[] = [];
    private selectedIds = new Set<string>();

    add(shape: Shape): void {
        this.shapes.push(shape);
    }

    remove(id: string): void {
        this.shapes = this.shapes.filter(s => s.id !== id);
        this.selectedIds.delete(id);
    }

    getShapes(): Shape[] {
        return [...this.shapes];
    }

    select(id: string, multi = false): void {
        if (!multi) this.selectedIds.clear();
        this.selectedIds.add(id);
    }

    clearSelection(): void {
        this.selectedIds.clear();
    }

    getSelected(): Shape[] {
        return this.shapes.filter(s => this.selectedIds.has(s.id));
    }

    // --- методы для работы со слоями ---
    moveUp(id: string): void {
        const idx = this.shapes.findIndex(s => s.id === id);
        if (idx >= 0 && idx < this.shapes.length - 1) {
            [this.shapes[idx], this.shapes[idx + 1]] = [this.shapes[idx + 1], this.shapes[idx]];
        }
    }

    moveDown(id: string): void {
        const idx = this.shapes.findIndex(s => s.id === id);
        if (idx > 0) {
            [this.shapes[idx - 1], this.shapes[idx]] = [this.shapes[idx], this.shapes[idx - 1]];
        }
    }

    moveToTop(id: string): void {
        const idx = this.shapes.findIndex(s => s.id === id);
        if (idx >= 0 && idx < this.shapes.length - 1) {
            const [item] = this.shapes.splice(idx, 1);
            this.shapes.push(item);
        }
    }

    moveToBottom(id: string): void {
        const idx = this.shapes.findIndex(s => s.id === id);
        if (idx > 0) {
            const [item] = this.shapes.splice(idx, 1);
            this.shapes.unshift(item);
        }
    }

    toJSON(): any[] {
        return this.shapes.map(s => s.toJSON());
    }

    loadFromJSON(data: any[]): void {
        this.shapes = data.map(item => ShapeFactory.fromJSON(item));
    }
}