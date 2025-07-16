// Copyright (c) ETH Zurich and the rendure authors. All rights reserved.

export interface Point2D {
    x: number;
    y: number;
}

export interface Size2D {
    w: number;
    h: number;
}

export type SimpleRect = Point2D & Size2D;
