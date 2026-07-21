export interface SgrMousePacket {
  readonly code: number;
  readonly col: number;
  readonly row: number;
  readonly final: "M" | "m";
}

const PREFIX = "\x1b[<";
const COMPLETE_PACKET = /^\x1b\[<(\d+);(\d+);(\d+)([Mm])/;

export interface MouseFirewallResult {
  readonly packets: readonly SgrMousePacket[];
  readonly data: string;
  readonly pending: boolean;
}

/** Stateful SGR packet firewall. Mouse bytes are removed even when packets are
 * fragmented or batched; unrelated input is returned in order. */
export class SgrMousePacketFirewall {
  private pending = "";

  feed(data: string): MouseFirewallResult {
    let source = this.pending + data;
    this.pending = "";
    let keyboard = "";
    const packets: SgrMousePacket[] = [];

    while (source.length > 0) {
      const start = source.indexOf(PREFIX);
      if (start < 0) {
        const partialLength = this.partialPrefixLength(source);
        keyboard += source.slice(0, source.length - partialLength);
        this.pending = source.slice(source.length - partialLength);
        break;
      }
      keyboard += source.slice(0, start);
      source = source.slice(start);
      const match = COMPLETE_PACKET.exec(source);
      if (match) {
        packets.push({
          code: Number(match[1]),
          col: Number(match[2]),
          row: Number(match[3]),
          final: match[4] === "m" ? "m" : "M",
        });
        source = source.slice(match[0].length);
        continue;
      }
      if (/^\x1b\[<[0-9;]*$/.test(source)) {
        this.pending = source;
        break;
      }
      // A malformed SGR mouse candidate is terminal protocol input, never text.
      const terminator = source.search(/[Mm]/);
      source = terminator < 0 ? "" : source.slice(terminator + 1);
    }
    return { packets, data: keyboard, pending: this.pending.length > 0 };
  }

  clear(): void { this.pending = ""; }

  private partialPrefixLength(source: string): number {
    for (let length = Math.min(PREFIX.length - 1, source.length); length > 0; length--) {
      if (PREFIX.startsWith(source.slice(-length))) return length;
    }
    return 0;
  }
}

export function parseSgrMousePackets(data: string): SgrMousePacket[] | null {
  const firewall = new SgrMousePacketFirewall();
  const result = firewall.feed(data);
  return result.data === "" && !result.pending && result.packets.length > 0 ? [...result.packets] : null;
}

const baseButton = (code: number): number => code & ~(4 | 8 | 16 | 32);
export const mouseScrollDelta = (packet: SgrMousePacket): number => packet.final !== "M" ? 0 : baseButton(packet.code) === 64 ? 1 : baseButton(packet.code) === 65 ? -1 : 0;
export const isLeftPress = (packet: SgrMousePacket): boolean => packet.final === "M" && baseButton(packet.code) === 0 && (packet.code & 32) === 0;
export const isLeftDrag = (packet: SgrMousePacket): boolean => packet.final === "M" && baseButton(packet.code) === 0 && (packet.code & 32) !== 0;
export const isRightPress = (packet: SgrMousePacket): boolean => packet.final === "M" && baseButton(packet.code) === 2 && (packet.code & 32) === 0;
export const isMouseRelease = (packet: SgrMousePacket): boolean => packet.final === "m";
