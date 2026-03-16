export type Mat3 = [
    number, number, number,
    number, number, number,
    number, number, number
];

export interface Point2D {
    x: number;
    y: number;
}

export const EPS = 1e-10;

export const mat3 = {
    identity(): Mat3 {
        return [
            1, 0, 0,
            0, 1, 0,
            0, 0, 1
        ];
    },

    multiply(a: Mat3, b: Mat3): Mat3 {
        const result: Mat3 = [0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (let i = 0; i < 3; i++) {
            const rowOffset = i * 3;
            for (let j = 0; j < 3; j++) {
                let sum = 0;
                for (let k = 0; k < 3; k++) {
                    sum += a[rowOffset + k] * b[k * 3 + j];
                }
                result[rowOffset + j] = sum;
            }
        }
        return result;
    },

    translate(tx: number, ty: number): Mat3 {
        return [
            1, 0, tx,
            0, 1, ty,
            0, 0, 1
        ];
    },

    scale(sx: number, sy: number): Mat3 {
        return [
            sx, 0, 0,
            0, sy, 0,
            0, 0, 1
        ];
    },

    rotate(rad: number): Mat3 {
        const c = Math.cos(rad);
        const s = Math.sin(rad);
        return [
            c, -s, 0,
            s,  c, 0,
            0,  0, 1
        ];
    },

    fromTransform(
        tx: number,
        ty: number,
        rotationRad: number,
        sx: number,
        sy: number
    ): Mat3 {
        const T = this.translate(tx, ty);
        const R = this.rotate(rotationRad);
        const S = this.scale(sx, sy);
        // First scale, then rotate, then translate: M = T * (R * S)
        const RS = this.multiply(R, S);
        return this.multiply(T, RS);
    },

    transformPoint(m: Mat3, x: number, y: number): Point2D {
        const x1 = m[0] * x + m[1] * y + m[2];
        const y1 = m[3] * x + m[4] * y + m[5];
        return { x: x1, y: y1 };
    },

    invert(m: Mat3): Mat3 | null {
        const a = m[0], b = m[1], tx = m[2];
        const c = m[3], d = m[4], ty = m[5];
        const det = a * d - b * c;
        if (Math.abs(det) < EPS) {
            return null;
        }
        const invDet = 1.0 / det;
        return [
            d * invDet, -b * invDet, (b * ty - d * tx) * invDet,
            -c * invDet,  a * invDet, (c * tx - a * ty) * invDet,
            0, 0, 1
        ];
    }
};