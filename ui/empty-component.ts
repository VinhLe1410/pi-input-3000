import type { Component } from "@earendil-works/pi-tui";

export class EmptyComponent implements Component {
  render(): string[] {
    return [];
  }

  invalidate(): void {}
}
