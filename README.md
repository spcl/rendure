# Rendure - A Lightweight Web Rendering Framework

**Rendure** is a modern, lightweight web rendering framework designed for
building high-performance, interactive web graphics applications. It provides a
clean abstraction layer over HTML5 Canvas with support for advanced rendering
capabilities.

## Features

- 🎨 **Canvas-based Rendering**: High-performance HTML5 Canvas rendering engine
- 🔧 **TypeScript Support**: Full TypeScript support with comprehensive type definitions
- 🎯 **Event-driven Architecture**: Built-in event handling and state management
- 🖱️ **Interactive Elements**: Support for hover, selection, and highlighting states
- 🔍 **Debugging Tools**: Built-in debug drawing capabilities
- 📱 **VS Code Integration**: Detection for when rendering inside of a VS Code webview
- 🎪 **UI Components**: Built-in UI components with Bootstrap styling

## Installation

```bash
npm install rendure
```

## Core Concepts

### Renderable Objects
Renderable objects are the building blocks of your graphics application. They extend the base `Renderable` class and define how they should be drawn on the canvas.

### Renderer
The renderer manages the rendering loop, handles events, and maintains the state of all renderable objects. Rendure provides an `HtmlCanvasRenderer` for Canvas-based applications.

### Event System
Rendure uses an event-driven architecture, allowing you to respond to user interactions and system events:

```typescript
renderer.on('click', (event) => {
    // Handle click events
});
```

## Development

### Prerequisites

- Node.js >= 22.17.0
- npm or yarn

## License

This project is licensed under the BSD-3-Clause License. See the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For questions and support, please visit our [GitHub Issues](https://github.com/spcl/rendure/issues) page.

---

**Copyright (c) ETH Zurich and the rendure authors. All rights reserved.**
