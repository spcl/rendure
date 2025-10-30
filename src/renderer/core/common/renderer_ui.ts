// Copyright (c) ETH Zurich and the rendure authors. All rights reserved.

import $ from 'jquery';

import type { RendererBase } from './renderer_base';


export type RendererUIFeature = (
    'menu' | 'zoomToFit' | 'zoomToFitWidth' | 'minimap' | 'zoomBtns'
);

export class RendererUI {

    protected readonly toolbar: JQuery;
    protected readonly toolbarZoomGroup?: JQuery;
    protected readonly menu?: JQuery;
    protected menuItems: [
        string, string | undefined, ((e: MouseEvent) => void) | undefined
    ][] = [];
    protected readonly menuDropdownBtn?: JQuery;
    protected readonly zoomInOutBtns?: JQuery;

    public constructor(
        protected readonly container: JQuery,
        protected readonly renderer: RendererBase,
        protected readonly _featuresMask: Partial<Record<
            RendererUIFeature, boolean
        >> = {
            menu: true,
            zoomToFit: true,
            zoomToFitWidth: true,
            minimap: true,
            zoomBtns: true,
        },
        protected readonly withToolbar: boolean = true
    ) {
        if (this._featuresMask.minimap ?? true)
            this.renderer.enableMinimap();
        else
            this.renderer.disableMinimap();

        // Construct the toolbar.
        this.toolbar = $('<div>', {
            class: 'button-bar',
            css: {
                position: 'absolute',
                top: '10px',
                left: '10px',
            },
        });

        if (this.withToolbar)
            this.container.append(this.toolbar);

        // Construct menu.
        if (this._featuresMask.menu) {
            this.menuDropdownBtn = $('<div>', {
                class: 'dropdown',
            });
            $('<button>', {
                class: 'btn btn-secondary btn-sm btn-material',
                html: '<i class="material-symbols-outlined">menu</i>',
                title: 'Menu',
                'data-bs-toggle': 'dropdown',
            }).appendTo(this.menuDropdownBtn);
            this.menu = $('<ul>', {
                class: 'dropdown-menu',
            }).appendTo(this.menuDropdownBtn);
            $('<div>', {
                class: 'btn-group',
            }).appendTo(this.toolbar).append(this.menuDropdownBtn);
        }

        if (this._featuresMask.zoomToFit ||
            this._featuresMask.zoomToFitWidth) {
            this.toolbarZoomGroup = $('<div>', {
                class: 'btn-group',
                role: 'group',
            }).appendTo(this.toolbar);
        }

        if (this._featuresMask.zoomToFit) {
            // Zoom to fit.
            $('<button>', {
                class: 'btn btn-secondary btn-sm btn-material',
                html: '<i class="material-symbols-outlined">fit_screen</i>',
                title: 'Zoom to fit contents',
                click: () => {
                    this.renderer.zoomToFitContents();
                },
            }).appendTo(this.toolbarZoomGroup!);
        }

        if (this._featuresMask.zoomToFitWidth) {
            // Zoom to fit width.
            $('<button>', {
                class: 'btn btn-secondary btn-sm btn-material',
                html: '<i class="material-symbols-outlined">fit_width</i>',
                title: 'Zoom to fit width',
                click: () => {
                    this.renderer.zoomToFitWidth();
                },
            }).appendTo(this.toolbarZoomGroup!);
        }

        if (this._featuresMask.zoomBtns) {
            this.zoomInOutBtns = $('<div>', {
                class: 'zoom-in-out-container btn-group-vertical',
                role: 'group',
                css: {
                    position: 'absolute',
                    bottom: '10px', // Position at the bottom
                    right: '10px',  // Position at the right
                    display: 'flex',
                    flexDirection: 'column',
                },
            }).appendTo(this.container);
            // Add Zoom In Button
            $('<button>', {
                class: 'btn btn-secondary btn-sm btn-material',
                html: '<i class="material-symbols-outlined">add</i>',
                title: 'Zoom In',
                click: (e: MouseEvent) => {
                    this.renderer.zoomIn(e);
                },
            }).appendTo(this.zoomInOutBtns);
            // Add Zoom Out Button
            $('<button>', {
                class: 'btn btn-secondary btn-sm btn-material',
                html: '<i class="material-symbols-outlined">remove</i>',
                title: 'Zoom Out',
                click: (e: MouseEvent) => {
                    this.renderer.zoomOut(e);
                },
            }).appendTo(this.zoomInOutBtns);
        }
    }

    protected regenerateMenu(): void {
        if (!this.menu)
            throw new Error('Menu was not enabled');
        this.menu.empty();

        for (const entry of this.menuItems) {
            const className = entry[0];
            const label = entry[1];
            const handler = entry[2];
            const item = $('<li>', {
                class: className,
                text: label ?? '',
                click: handler,
            });
            this.menu.append(item);
        }
    }

    public addMenuItem(
        label: string,
        handler: (e: MouseEvent) => void,
        idx: number = -1,
        regenerate: boolean = true
    ): void {
        if (!this.menu)
            throw new Error('Menu was not enabled');

        const item: [string, string, (e: MouseEvent) => void] = [
            'dropdown-item',
            label,
            handler,
        ];
        if (idx < 0 || idx >= this.menuItems.length)
            this.menuItems.push(item);
        else
            this.menuItems.splice(idx, 0, item);

        if (regenerate)
            this.regenerateMenu();
    }

    public clearMenuItems(): void {
        if (!this.menu)
            throw new Error('Menu was not enabled');

        this.menu.empty();
        this.menuItems = [];
    }

    public addMenuDivider(idx: number = -1, regenerate: boolean = true): void {
        if (!this.menu)
            throw new Error('Menu was not enabled');

        const divider: [string, undefined, undefined] = [
            'dropdown-divider',
            undefined,
            undefined,
        ];
        if (idx < 0 || idx >= this.menuItems.length)
            this.menuItems.push(divider);
        else
            this.menuItems.splice(idx, 0, divider);

        if (regenerate)
            this.regenerateMenu();
    }

    public destroy(): void {
        this.toolbar.remove();
        this.menu?.remove();
        this.menuDropdownBtn?.remove();
        this.toolbarZoomGroup?.remove();
        this.zoomInOutBtns?.remove();
    }

}
