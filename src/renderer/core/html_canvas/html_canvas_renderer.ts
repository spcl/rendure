// Copyright (c) ETH Zurich and the rendure authors. All rights reserved.

import '../../../../scss/html_canvas_renderer.scss';

import $ from 'jquery';

import { CanvasManager } from './canvas_manager';
import type { Point2D, SimpleRect } from '../../../types';
import { RendererBase } from '../common/renderer_base';
import { Renderable } from '../common/renderable';
import { boundingBox } from '../common/renderer_utils';


// External, non-typescript libraries which are presented as previously loaded
// scripts and global javascript variables:
declare const blobStream: () => WritableStream;
declare const canvas2pdf: {
    PdfContext: new (
        stream: WritableStream, options: any
    ) => PDFCanvasRenderingContext2D,
};

interface BlobStream extends WritableStream {
    toBlobURL(type: string): string;
    on(event: string, callback: CallableFunction): void;
}

interface PDFCanvasRenderingContext2D extends CanvasRenderingContext2D {
    stream: BlobStream;
    pdf: boolean;
    end(): void;
}

export interface HTMLCanvasRendererOptions {
    debugDrawing?: boolean;
    useVerticalScrollNavigation?: boolean;
    adaptiveContentHiding?: boolean;
    viewportOnly?: boolean;
    bindToViewport?: boolean;
}

export const HTML_CANVAS_RENDERER_DEFAULT_OPTIONS: HTMLCanvasRendererOptions = {
    debugDrawing: false,
    useVerticalScrollNavigation: false,
    adaptiveContentHiding: true,
    viewportOnly: true,
    bindToViewport: true,
};

export type HTMLCanvasRendererOptionKey = keyof HTMLCanvasRendererOptions;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface HTMLCanvasRendererEvent {
}

/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
export interface HTMLCanvasRenderer {

    on<U extends keyof HTMLCanvasRendererEvent>(
        event: U, listener: HTMLCanvasRendererEvent[U]
    ): this;

    emit<U extends keyof HTMLCanvasRendererEvent>(
        event: U, ...args: Parameters<HTMLCanvasRendererEvent[U]>
    ): boolean;

}

/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
export abstract class HTMLCanvasRenderer extends RendererBase {

    public readonly canvas: HTMLCanvasElement;
    public readonly canvasManager: CanvasManager;
    public readonly ctx: CanvasRenderingContext2D;
    private pdfCtx?: PDFCanvasRenderingContext2D;

    // Minimap related fields.
    protected minimapCtx?: CanvasRenderingContext2D;
    protected minimapCanvas?: HTMLCanvasElement;
    protected minimapBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };

    // Mouse-related fields.
    // Last position of the mouse pointer (in canvas coordinates).
    protected mousePos?: Point2D;
    // Last position of the mouse pointer (in pixel coordinates).
    protected realMousePos?: Point2D;
    protected dragging: boolean = false;
    protected readonly tooltipContainer: JQuery<HTMLDivElement>;
    protected readonly tooltipText: JQuery<HTMLSpanElement>;
    // Null if the mouse/touch is not activated.
    protected dragStart?: MouseEvent | TouchEvent;

    // Debug information display fields.
    protected readonly dbgInfoBox?: JQuery;
    protected readonly dbgMouseCoords?: JQuery;
    // Interaction or additional info display fields.
    protected readonly interactionInfoBox: JQuery;
    protected readonly interactionInfoText: JQuery;
    // Error popup / popover fields.
    protected readonly errorPopoverContainer: JQuery;
    protected readonly errorPopoverText: JQuery;

    protected _desiredOptions: HTMLCanvasRendererOptions;
    protected _currentOptions: HTMLCanvasRendererOptions;

    public constructor(
        protected container: JQuery,
        protected extMouseHandler: (
            (...args: any[]) => boolean
        ) | null = null,
        protected initialUserTransform: DOMMatrix | null = null,
        protected backgroundColor: string | null = null,
        desiredOptions?: HTMLCanvasRendererOptions
    ) {
        desiredOptions ??= HTML_CANVAS_RENDERER_DEFAULT_OPTIONS;

        super(desiredOptions.debugDrawing ?? false);

        this._desiredOptions = desiredOptions;

        this._currentOptions = JSON.parse(
            JSON.stringify(this._desiredOptions)
        ) as HTMLCanvasRendererOptions;

        // Initialize the DOM.
        this.canvas = document.createElement('canvas');
        this.canvas.classList.add('rendure-canvas');
        if (this.backgroundColor)
            this.canvas.style.backgroundColor = this.backgroundColor;
        else
            this.canvas.style.backgroundColor = 'inherit';
        this.container[0].append(this.canvas);
        this._htmlElem = this.canvas;

        // Set inherited background.
        this.backgroundColor ??= window.getComputedStyle(
            this.canvas
        ).backgroundColor;

        // Initialize debug drawing, if requested.
        if (this.debugDraw) {
            this.dbgInfoBox = $('div', {
                css: {
                    position: 'absolute',
                    bottom: '.5rem',
                    right: '.5rem',
                    backgroundColor: 'black',
                    padding: '.3rem',
                },
            });
            this.dbgMouseCoords = $('span', {
                css: {
                    color: 'white',
                    fontSiye: '1rem',
                    innerText: 'x: N/A | y: N/A',
                },
            });
            this.dbgInfoBox.append(this.dbgMouseCoords);
            this.container.append(this.dbgInfoBox);
        }

        //const rCtx = this.canvas.getContext('2d', { desynchronized: true });
        const rCtx = this.canvas.getContext('2d');
        if (!rCtx)
            throw Error('Failed to obtain the canvas rendering context');
        this.ctx = rCtx;

        // Set up translation/scaling management.
        this.canvasManager = new CanvasManager(this.ctx, this, this.canvas);
        if (this.initialUserTransform !== null)
            this.canvasManager.setUserTransform(this.initialUserTransform);

        // Observe resize events for the canvas and its container.
        const observer = new MutationObserver(() => {
            this.onresize();
            this.drawAsync();
        });
        observer.observe(this.container[0], { attributes: true });
        const resizeObserver = new ResizeObserver(() => {
            this.onresize();
            this.drawAsync();
        });
        resizeObserver.observe(this.container[0]);

        // Set mouse event handlers.
        this.registerMouseHandlers();

        // UI initialization.
        // First, initialize common UI components as specified by the features
        // mask.
        // Initialize the interaction information panel.
        this.interactionInfoBox = $('<div>', {
            class: 'rendure-html-canvas-renderer-interaction-info-container',
        }).appendTo(this.container);
        this.interactionInfoText = $('<div>', {
            html: '',
        }).appendTo(this.interactionInfoBox);

        // Initialze the error popover container.
        this.errorPopoverContainer = $('<div>', {
            text: '',
            class: 'rendure-html-canvas-renderer-error-popover',
        }).appendTo(this.container);
        this.errorPopoverText = $('<div>').appendTo(this.errorPopoverContainer);
        const errorPopoverDismiss = $('<button>', {
            type: 'button',
            class: 'btn-close',
        }).appendTo(this.errorPopoverContainer);
        errorPopoverDismiss.on('click', () => {
            this.errorPopoverText.text('');
            this.errorPopoverContainer.hide();
        });

        // Initialize tooltips.
        this.tooltipContainer = $('<div>', {
            class: 'rendure-tooltip',
            css: {
                left: '0px',
                top: '0px',
                display: 'none',
            },
        });
        this.tooltipContainer.appendTo($(document.body));
        this.tooltipText = $('<span>', {
            class: 'rendure-tooltip-text',
            html: '',
            css: {
                'white-space': 'pre-line',
            },
        });
        this.tooltipContainer.append(this.tooltipText);

        this.onresize();
    }

    public destroy(): void {
        try {
            this.canvasManager.destroy();
            this.container.empty();
            this.dbgInfoBox?.remove();
        } catch (_ex) {
            // Do nothing
            console.error('Error while destroying HTMLCanvasRenderer:', _ex);
        }
    }

    public showTooltip(
        x: number, y: number, text: string, html: boolean = false,
        correctOffscrenen: boolean = true
    ): void {
        if (html)
            this.tooltipText.html(text);
        else
            this.tooltipText.text(text);
        this.tooltipContainer.show();
        const bcr = this.tooltipContainer[0].getBoundingClientRect();
        this.tooltipContainer.css(
            'left', (x - bcr.width / 2).toString() + 'px'
        );
        const topOffset = 8;
        let yPos = y - (bcr.height + topOffset);
        if (yPos < 0 && correctOffscrenen) {
            // If the tooltip would be off-screen, move it to the oposite side
            // of the y coordinate.
            yPos = y + topOffset;
        }
        this.tooltipContainer.css(
            'top', yPos.toString() + 'px'
        );
    }

    public showTooltipAtMouse(text: string, html?: boolean): void {
        let tooltipX;
        let tooltipY;
        if (this.realMousePos) {
            tooltipX = this.realMousePos.x;
            tooltipY = this.realMousePos.y;
        } else {
            tooltipX = this.canvas.width / 2;
            tooltipY = this.canvas.height / 2;
        }
        this.showTooltip(tooltipX, tooltipY, text, html);
    }

    public hideTooltip(): void {
        this.tooltipContainer.hide();
    }

    public showInteractionInfo(text: string, asHtml: boolean = false): void {
        if (asHtml)
            this.interactionInfoText.html(text);
        else
            this.interactionInfoText.text(text);
        this.interactionInfoBox.show();
    }

    public hideInteractionInfo(): void {
        this.interactionInfoText.text('');
        this.interactionInfoBox.hide();
    }

    public showError(text: string): void {
        this.errorPopoverText.text(text);
        this.errorPopoverContainer.show();
    }

    protected clearMinimap(): void {
        if (this.minimapCtx) {
            this.minimapCtx.save();

            this.minimapCtx.setTransform(1, 0, 0, 1, 0, 0);
            this.minimapCtx.clearRect(
                0, 0, this.minimapCtx.canvas.width,
                this.minimapCtx.canvas.height
            );

            this.minimapCtx.restore();
        }
    }

    protected onMinimapClicked(mouseEvent: MouseEvent): void {
        if (!this.minimapCanvas)
            return;

        // Get target offset from graph center in minimap coordinates.
        const centerX = this.minimapCanvas.width / 2;
        const centerY = this.minimapCanvas.height / 2;
        const minimapCenterOffset = {
            x: mouseEvent.offsetX - centerX,
            y: mouseEvent.offsetY - centerY,
        };

        // Translate minimap coordinate center offset to graph canvas center
        // offset.
        const contentsBB = this.getContentsBoundingBox();
        const scale = Math.min(
            this.minimapCanvas.width / contentsBB.w,
            this.minimapCanvas.height / contentsBB.h
        );
        const targetCenterOffset = {
            x: minimapCenterOffset.x * (1 / scale),
            y: minimapCenterOffset.y * (1 / scale),
        };
        const targetPos = {
            x: (contentsBB.w / 2) + targetCenterOffset.x,
            y: (contentsBB.h / 2) + targetCenterOffset.y,
        };

        this.moveViewTo(targetPos.x, targetPos.y);
    }

    protected drawMinimap(): void {
        if (!this.minimapCtx || !this.minimapCanvas)
            return;

        // Ensure the minimap isn't taking up too much screen realestate.
        const minDimSize = 180;
        let targetWidth = minDimSize;
        let targetHeight = minDimSize;
        const maxPercentage = 0.22;
        if (targetHeight > this.canvas.height * maxPercentage)
            targetHeight = Math.floor(this.canvas.height * maxPercentage);
        if (targetWidth > this.canvas.width * maxPercentage)
            targetWidth = Math.floor(this.canvas.width * maxPercentage);

        // Prevent forced style reflow if nothing changed
        // Can save about 0.5ms of computation
        if (this.minimapCanvas.height !== targetHeight) {
            this.minimapCanvas.height = targetHeight;
            this.minimapCanvas.style.height = targetHeight.toString() + 'px';
        }
        if (this.minimapCanvas.width !== targetWidth) {
            this.minimapCanvas.width = targetWidth;
            this.minimapCanvas.style.width = targetWidth.toString() + 'px';
        }

        // Set the zoom level and translation so everything is visible.
        const bb = this.getContentsBoundingBox();
        const scale = Math.min(
            targetWidth / bb.w, targetHeight / bb.h
        );
        const originX = (targetWidth / 2) - ((bb.w / 2) + bb.x) * scale;
        const originY = (targetHeight / 2) - ((bb.h / 2) + bb.y) * scale;
        this.minimapCtx.setTransform(
            scale, 0, 0,
            scale, originX, originY
        );

        this._drawMinimapContents();

        // Draw the viewport.
        this.minimapCtx.strokeStyle = this.getCssProperty(
            '--color-minimap-viewport'
        );
        this.minimapCtx.lineWidth = 1 / scale;
        this.minimapCtx.strokeRect(
            this.viewport.x, this.viewport.y,
            this.viewport.w, this.viewport.h
        );

        this.minimapBounds.minX = 0 - originX / scale;
        this.minimapBounds.minY = 0 - originY / scale;
        this.minimapBounds.maxX = this.minimapBounds.minX + (
            this.minimapCanvas.width / scale
        );
        this.minimapBounds.maxY = this.minimapBounds.minY + (
            this.minimapCanvas.height / scale
        );
    }

    protected abstract _drawMinimapContents(): void;

    public disableMinimap(): void {
        this.minimapCanvas?.remove();
        this.minimapCanvas = undefined;
        this.minimapCtx = undefined;
    }

    public enableMinimap(): void {
        this.minimapCanvas = document.createElement('canvas');
        this.minimapCanvas.addEventListener('click', (ev) => {
            this.onMinimapClicked(ev);
        });
        this.minimapCanvas.classList.add('rendure-canvas', 'rendure-minimap');
        this.minimapCanvas.style.backgroundColor = 'white';
        this.minimapCtx = this.minimapCanvas.getContext('2d') ?? undefined;
        this.container.append(this.minimapCanvas);
    }

    protected abstract initUI(): void;

    protected registerMouseHandlers(): void {
        this.canvas.addEventListener('click', this.onClick.bind(this));
        this.canvas.addEventListener('dblclick', this.onDblClick.bind(this));
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener(
            'touchstart', this.onTouchStart.bind(this)
        );
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
        this.canvas.addEventListener('wheel', this.onWheel.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this));
        this.canvas.addEventListener(
            'contextmenu', this.onContextMenu.bind(this)
        );
    }

    protected onMouseMove(event: MouseEvent): boolean {
        if (this.dragStart && this.dragStart instanceof MouseEvent &&
            event.buttons & 1) {
            // Pan the view with the left mouse button.
            this.dragging = true;
            this.panOnMouseMove(event);
            return true;
        } else if (this.dragStart && event.buttons & 4) {
            // Pan the view with the middle mouse button.
            this.dragging = true;
            this.panOnMouseMove(event);
            return true;
        } else {
            this.dragStart = undefined;
            if (event.buttons & 1 || event.buttons & 4)
                return true; // Don't stop propagation
            return false;
        }
    }

    public drawAsync(ctx?: CanvasRenderingContext2D): void {
        this._currentOptions.adaptiveContentHiding =
            this._desiredOptions.adaptiveContentHiding;
        this.clearCssPropertyCache();
        this.canvasManager.drawAsync(ctx);
    }

    protected getMouseEventRealCoords(event: MouseEvent | TouchEvent): Point2D {
        const rect = this.canvas.getBoundingClientRect();

        if (event instanceof TouchEvent) {
            return {
                x: this.canvasManager.mapPixelToCoordsX(
                    event.touches[0].clientX - rect.left
                ),
                y: this.canvasManager.mapPixelToCoordsY(
                    event.touches[0].clientY - rect.top
                ),
            };
        }

        return {
            x: this.canvasManager.mapPixelToCoordsX(event.clientX - rect.left),
            y: this.canvasManager.mapPixelToCoordsY(event.clientY - rect.top),
        };
    }

    public onresize(): void {
        // Update the canvas size.
        //this.canvas.style.width = '99%';
        //this.canvas.style.height = '99%';
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
    }

    public get canSaveToPDF(): boolean {
        try {
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            blobStream;
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            canvas2pdf.PdfContext;
            return true;
        } catch (_e) {
            return false;
        }
    }

    // Draw a debug grid on the canvas to indicate coordinates.
    public drawDebugGrid(
        curx: number, cury: number, endx: number, endy: number,
        gridWidth: number = 100, ctx?: CanvasRenderingContext2D
    ): void {
        const lCtx = ctx ?? this.ctx;

        const limXMin = Math.floor(curx / gridWidth) * gridWidth;
        const limXMax = Math.ceil(endx / gridWidth) * gridWidth;
        const limYMin = Math.floor(cury / gridWidth) * gridWidth;
        const limYMax = Math.ceil(endy / gridWidth) * gridWidth;
        for (let i = limXMin; i <= limXMax; i += gridWidth) {
            lCtx.moveTo(i, limYMin);
            lCtx.lineTo(i, limYMax);
        }
        for (let i = limYMin; i <= limYMax; i += gridWidth) {
            lCtx.moveTo(limXMin, i);
            lCtx.lineTo(limXMax, i);
        }
        lCtx.strokeStyle = 'yellow';
        lCtx.stroke();

        // Draw the zero-point.
        lCtx.beginPath();
        lCtx.arc(0, 0, 10, 0, 2 * Math.PI, false);
        lCtx.fillStyle = 'red';
        lCtx.fill();
        lCtx.strokeStyle = 'red';
        lCtx.stroke();
    }

    protected abstract internalDraw(
        dt?: number, ctx?: CanvasRenderingContext2D
    ): void;

    public draw(dt?: number, ctx?: CanvasRenderingContext2D): void {
        this.onPreDraw();

        this.internalDraw(dt, ctx ?? this.ctx);

        if (this.debugDraw) {
            this.drawDebugGrid(
                this.canvasManager.viewport.x,
                this.canvasManager.viewport.y,
                this.canvasManager.viewport.w,
                this.canvasManager.viewport.h,
                100
            );

            if (this.dbgMouseCoords) {
                if (this.mousePos) {
                    this.dbgMouseCoords.text(
                        'x: ' + Math.floor(this.mousePos.x).toString() +
                        ' | y: ' + Math.floor(this.mousePos.y).toString()
                    );
                } else {
                    this.dbgMouseCoords.text('x: N/A | y: N/A');
                }
            }
        }

        this.onPostDraw();
    }

    protected onPreDraw(): void {
        this.clearMinimap();
    }

    protected onPostDraw(): void {
        this.drawMinimap();

        // In the case of PDF drawing, explicitly end the context.
        this.pdfCtx?.end();
    }

    public saveAsPDF(filename: string, saveAll: boolean = false): void {
        if (!this.canSaveToPDF)
            throw Error('Saving to PDF is not supported');

        const stream = blobStream();

        // Compute document size.
        const curx = this.canvasManager.mapPixelToCoordsX(0);
        const cury = this.canvasManager.mapPixelToCoordsY(0);
        const contentBox = this.getContentsBoundingBox();
        let size;
        if (saveAll) {
            // Get size of the entire contents.
            size = [contentBox.w, contentBox.h];
        } else {
            size = [this.viewport.w, this.viewport.h];
        }

        this.pdfCtx = new canvas2pdf.PdfContext(stream, {
            size: size,
        });
        this.pdfCtx.pdf = true;

        // Save previous settings and ensure PDF exporting is done on a WYSIWYG
        // basis.
        const oldViewportOnly = this.options.viewportOnly;
        const oldAdaptiveHiding = this.options.adaptiveContentHiding;
        if (!saveAll) {
            this._currentOptions.viewportOnly = true;
            this._currentOptions.adaptiveContentHiding =
                this._desiredOptions.adaptiveContentHiding ?? false;
        } else {
            this._currentOptions.viewportOnly = false;
            this._currentOptions.adaptiveContentHiding = false;
        }

        // Center on saved region.
        if (!saveAll)
            this.ctx.translate(-(curx ? curx : 0), -(cury ? cury : 0));
        else
            this.ctx.translate(contentBox.x, contentBox.y);

        this.drawAsync(this.pdfCtx);

        this.pdfCtx.stream.on('finish', () => {
            this.save(
                filename,
                this.pdfCtx?.stream.toBlobURL('application/pdf')
            );
            this._currentOptions.viewportOnly = oldViewportOnly;
            this._currentOptions.adaptiveContentHiding = oldAdaptiveHiding;
            this.pdfCtx = undefined;
            this.drawAsync();
        });
    }

    public saveCanvasAsPng(filename: string): void {
        this.save(filename, this.canvas.toDataURL('image/png'));
    }

    public moveViewTo(x: number, y: number): void {
        const targetRect = {
            x: x - (this.viewport.w / 2),
            y: y - (this.viewport.h / 2),
            w: this.viewport.w,
            h: this.viewport.h,
        };
        this.canvasManager.setView(targetRect, true);
        this.drawAsync();
    }

    public zoomToFitContents(
        animate: boolean = true,
        padding: number | undefined = undefined,
        redraw: boolean = true
    ): void {
        const contentsBB = this.getContentsBoundingBox();
        let absPadding = 10;
        if (padding !== undefined)
            absPadding = padding;
        contentsBB.x -= absPadding;
        contentsBB.y -= absPadding;
        contentsBB.w += 2 * absPadding;
        contentsBB.h += 2 * absPadding;
        this.canvasManager.setView(contentsBB, animate);

        if (redraw)
            this.drawAsync();
    }

    public zoomToFitWidth(
        animate: boolean = true, padding: number = 10, redraw: boolean = true
    ): void {
        const contentsBB = this.getContentsBoundingBox();

        contentsBB.x -= padding;
        contentsBB.w += 2 * padding;
        contentsBB.y = this.viewport.y - padding;
        contentsBB.h = this.viewport.h + 2 * padding;

        this.canvasManager.setView(contentsBB, animate);

        if (redraw)
            this.drawAsync();
    }

    public zoomToFit(
        elements: Renderable[] | undefined = undefined,
        animate: boolean = true,
        padding: number | undefined = undefined,
        redraw: boolean = true
    ): void {
        if (elements) {
            let paddingPercent = 10;
            if (padding !== undefined)
                paddingPercent = padding;

            let paddingAbs = 0;
            if (paddingPercent > 0) {
                paddingAbs = Math.min(
                    (this.canvas.width / 100) * paddingPercent,
                    (this.canvas.height / 100) * paddingPercent
                );
            }

            const bb = boundingBox(elements, paddingAbs);
            this.canvasManager.setView(bb, animate);

            if (redraw)
                this.drawAsync();
        } else {
            this.zoomToFitContents(animate, padding, redraw);
        }
    }

    /**
     * Checks if pan movement is in the bounds of the content bounding box.
     * Takes the current viewport and checks if its center is within the current
     * content bounding box. The pan movement (movX, movY) is corrected
     * accordingly to have a smooth view pan blocking.
     * @param movX Requested pan movement in the x direction.
     * @param movY Requested pan movement in the y direction.
     * @returns    Corrected movement clamped to the content bounding box.
     */
    public checkPanMovementInBounds(movX: number, movY: number) {
        if (!this.options.bindToViewport) {
            return {
                x: movX,
                y: movY,
            };
        }

        const contentBB = this.getContentsBoundingBox();

        // Compute where the viewport center is out of bounds:
        // outofboundsX/Y === 0 means not out of bounds
        let outofboundsX = 0;
        let outofboundsY = 0;

        const padding = 50;
        if (this.viewport.x + this.viewport.w < (contentBB.x + padding))
            outofboundsX = -1;
        else if (this.viewport.x > ((contentBB.x + contentBB.w) - padding))
            outofboundsX = 1;

        if (this.viewport.y + this.viewport.h < (contentBB.y + padding))
            outofboundsY = -1;
        else if (this.viewport.y > ((contentBB.y + contentBB.h) - padding))
            outofboundsY = 1;

        // Take uncorrected mouse event movement as default
        const correctedMovement = {
            x: movX,
            y: movY,
        };

        // Correct mouse movement if necessary
        if ((outofboundsX === -1 && correctedMovement.x > 0) ||
            (outofboundsX === 1 && correctedMovement.x < 0))
            correctedMovement.x = 0;
        if ((outofboundsY === -1 && correctedMovement.y > 0) ||
            (outofboundsY === 1 && correctedMovement.y < 0))
            correctedMovement.y = 0;

        return correctedMovement;
    }

    public registerExternalMouseHandler(
        handler: ((...args: any[]) => boolean) | null
    ): void {
        this.extMouseHandler = handler;
    }

    // ==================
    // = Event handlers =
    // ==================

    protected onMouseDown(event: MouseEvent): boolean {
        this.dragStart = event;
        if (!this.mousePos)
            return true;
        return false;
    }

    protected onMouseUp(_event: MouseEvent): boolean {
        this.dragStart = undefined;
        return false;
    }

    protected onTouchStart(event: TouchEvent): boolean {
        this.dragStart = event;
        if (!this.mousePos)
            return true;
        return false;
    }

    protected onTouchEnd(event: TouchEvent): boolean {
        if (event.touches.length === 0)
            this.dragStart = undefined;
        else
            this.dragStart = event;
        return false;
    }

    protected onTouchMove(_event: TouchEvent): boolean {
        return true;
    }

    protected onClick(_event: MouseEvent): boolean {
        return true;
    }

    protected onDblClick(_event: MouseEvent): boolean {
        return true;
    }

    protected onContextMenu(event: MouseEvent): boolean {
        event.preventDefault();
        event.stopPropagation();
        return false;
    }

    protected onWheel(event: WheelEvent): boolean {
        if (this.options.useVerticalScrollNavigation && !event.ctrlKey ||
            !this.options.useVerticalScrollNavigation && event.ctrlKey) {
            // If vertical scroll navigation is turned on, use this to
            // move the viewport up and down. If the control key is held
            // down while scrolling, treat it as a typical zoom operation.
            const movX = 0;
            const movY = -event.deltaY;

            // Check if scroll is in bounds (near graph)
            // and restrict/correct it.
            const correctedMovement = this.checkPanMovementInBounds(movX, movY);

            this.canvasManager.translate(
                correctedMovement.x, correctedMovement.y
            );
        } else {
            // Get physical x,y coordinates (rather than canvas coordinates).
            const br = this.canvas.getBoundingClientRect();
            const x = event.clientX - br.x;
            const y = event.clientY - br.y;
            this.canvasManager.scale(event.deltaY > 0 ? 0.9 : 1.1, x, y);
        }

        this.drawAsync();

        return false;
    }

    protected panOnMouseMove(
        event: MouseEvent, suppressDraw: boolean = false
    ): void {
        // Check if panning in bounds and restrict/correct it.
        const correctedMovement = this.checkPanMovementInBounds(
            event.movementX, event.movementY
        );
        this.canvasManager.translate(correctedMovement.x, correctedMovement.y);
        if (!suppressDraw)
            this.drawAsync();
    }

    // =====================
    // = Getters / Setters =
    // =====================

    public getCanvas(): HTMLCanvasElement | null {
        return this.canvas;
    }

    public getCanvasManager(): CanvasManager | null {
        return this.canvasManager;
    }

    public getContext(): CanvasRenderingContext2D | null {
        return this.ctx;
    }

    public getViewport(): SimpleRect | null {
        return this.viewport;
    }

    public getBackgroundColor(): string {
        return this.backgroundColor ?? '';
    }

    public getMousePos(): Point2D | undefined {
        return this.mousePos;
    }

    public setBackgroundColor(backgroundColor: string): void {
        this.backgroundColor = backgroundColor;
    }

    public get options(): HTMLCanvasRendererOptions {
        return this._currentOptions;
    }

    public get viewport(): SimpleRect {
        return this.canvasManager.viewport;
    }

    public get adaptiveHiding(): boolean {
        return this._currentOptions.adaptiveContentHiding ?? false;
    }

    public get viewportOnly(): boolean {
        return this._currentOptions.viewportOnly ?? false;
    }

}

