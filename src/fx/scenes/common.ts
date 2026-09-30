import { Color, ColorManagement, LinearSRGBColorSpace, WebGLRenderer } from 'three';

// Scenes work in plain CSS colors end to end. With three's color management on, theme colors are
// converted to linear light, but our raw shaders output them as-is, so scenes came out far too dark.
// Turning it off and skipping the output conversion keeps every color exactly as the theme defines
// it, in shaders and built-in materials alike.
ColorManagement.enabled = false;

// Our shaders output premultiplied color, so their materials set `premultipliedAlpha: true`
// (otherwise alpha is applied twice and scenes fade to almost nothing).
export function createRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power', premultipliedAlpha: true });
  // Backgrounds are soft; full retina resolution isn't worth the battery.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  return renderer;
}

export const color = (css: string) => new Color().setStyle(css.trim() || '#000');
