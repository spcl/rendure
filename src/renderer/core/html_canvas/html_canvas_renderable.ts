// Copyright (c) ETH Zurich and the rendure authors. All rights reserved.

import { Renderable } from '../common/renderable';
import type {
    HTMLCanvasRenderer,
    HTMLCanvasRendererEvent,
} from './html_canvas_renderer';


export abstract class HTMLCanvasRenderable extends Renderable {

    protected _activeCtx: CanvasRenderingContext2D;
    protected _minimapCtx?: CanvasRenderingContext2D;

    public constructor(
        renderer: HTMLCanvasRenderer<HTMLCanvasRendererEvent>,
        protected readonly _ctx: CanvasRenderingContext2D,
        _minimapCtx: CanvasRenderingContext2D | undefined,
        id: number,
        data?: Record<string, unknown>
    ) {
        super(renderer, id, data);
        this._activeCtx = _ctx;
        this._minimapCtx = _minimapCtx;
    }

    protected get minimapCxt(): CanvasRenderingContext2D | undefined {
        return this._minimapCtx;
    }

    protected set minimapCxt(ctx: CanvasRenderingContext2D | undefined) {
        this._minimapCtx = ctx;
    }

    protected get ctx(): CanvasRenderingContext2D {
        return this._activeCtx;
    }

    public setTemporaryContext(ctx: CanvasRenderingContext2D): void {
        this._activeCtx = ctx;
    }

    public restoreContext(): void {
        this._activeCtx = this._ctx;
    }

    public debugDraw(overrideDebugDrawEnabled: boolean = false): void {
        if (this.renderer.debugDraw || overrideDebugDrawEnabled) {
            // Print the center and bounding box in debug mode.
            const topleft = this.topleft();
            this.ctx.beginPath();
            this.ctx.arc(topleft.x, topleft.y, 1, 0, 2 * Math.PI, false);
            this.ctx.fillStyle = 'red';
            this.ctx.fill();
            this.ctx.strokeStyle = 'red';
            this.ctx.stroke();
            this.ctx.strokeRect(topleft.x, topleft.y, this.width, this.height);
        }
    }

}
