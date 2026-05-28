import { describe, it, expect } from "vitest";
import { sniffMime } from "./file-sniff";

const bytes = (...n: number[]) => new Uint8Array(n);

describe("sniffMime", () => {
  it("detects PDF", () => {
    expect(sniffMime(bytes(0x25, 0x50, 0x44, 0x46, 0x2d))).toBe("application/pdf");
  });

  it("detects PNG", () => {
    expect(sniffMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
  });

  it("detects JPEG", () => {
    expect(sniffMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
  });

  it("detects WEBP", () => {
    // RIFF .... WEBP
    expect(
      sniffMime(bytes(0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50)),
    ).toBe("image/webp");
  });

  it("detects HEIC via ftyp brand", () => {
    // size(4) + "ftyp" + "heic"
    expect(
      sniffMime(bytes(0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63)),
    ).toBe("image/heic");
  });

  it("rejects HTML disguised as an image", () => {
    // "<html>" — what a spoofed-MIME XSS payload would start with
    expect(sniffMime(bytes(0x3c, 0x68, 0x74, 0x6d, 0x6c, 0x3e))).toBeNull();
  });

  it("rejects SVG (which can carry script)", () => {
    // "<svg "
    expect(sniffMime(bytes(0x3c, 0x73, 0x76, 0x67, 0x20))).toBeNull();
  });

  it("rejects empty / too-short buffers", () => {
    expect(sniffMime(bytes())).toBeNull();
    expect(sniffMime(bytes(0xff))).toBeNull();
  });

  it("rejects a RIFF container that is not WEBP (e.g. WAV)", () => {
    // RIFF .... WAVE
    expect(
      sniffMime(bytes(0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45)),
    ).toBeNull();
  });
});
