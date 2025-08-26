import Quill from 'quill';
import { ImageResizeCustom } from './quill/image-resize-custom';

// -----------------------------------------------------
// 1) Setup Quill (register attributors + module)
// -----------------------------------------------------
export function setupQuillOnce(): void {
  if ((window as any).__quillSetupDone) return;

  // Enable inline styles (align, color, background, font, size)
  const Align = Quill.import('attributors/style/align');
  const Color = Quill.import('attributors/style/color');
  const Background = Quill.import('attributors/style/background');
  const Font = Quill.import('attributors/style/font');
  const Size = Quill.import('attributors/style/size');

  // Register style attributors globally
  Quill.register(
    {
      'attributors/style/align': Align,
      'attributors/style/color': Color,
      'attributors/style/background': Background,
      'attributors/style/font': Font,
      'attributors/style/size': Size,
    },
    true
  );

  // ✅ Register custom image resize module
  // Casting to `any` to avoid TypeScript typing conflicts with Quill.register overloads
  (Quill as any).register('modules/imageResize', ImageResizeCustom as any);

  (window as any).__quillSetupDone = true;
}

// -----------------------------------------------------
// 2) StyledImage: extend the default Image format
// to support custom attributes (alt, height, width, style)
// -----------------------------------------------------

// Quill.import returns `unknown` in typings, so cast to `any`
const BaseImage: any = Quill.import('formats/image');

// Allowed attributes for <img>
const ImageFormatAttributesList = ['alt', 'height', 'width', 'style'] as const;
type ImgAttr = (typeof ImageFormatAttributesList)[number];

class StyledImage extends BaseImage {
  // Collect existing attributes from the DOM node
  static formats(domNode: HTMLElement) {
    return ImageFormatAttributesList.reduce((formats, attribute) => {
      if (domNode.hasAttribute(attribute)) {
        formats[attribute] = domNode.getAttribute(attribute)!;
      }
      return formats;
    }, {} as Record<string, string>);
  }

  // Apply/remove attribute values dynamically
  format(name: string, value: string | null) {
    if ((ImageFormatAttributesList as readonly string[]).includes(name)) {
      const el = this['domNode'] as HTMLElement; // Cast to HTMLElement for type safety
      if (value) {
        el.setAttribute(name as ImgAttr, value);
      } else {
        el.removeAttribute(name as ImgAttr);
      }
    } else {
      // Fallback to parent class format handler
      super.format(name, value);
    }
  }
}

// ✅ Register the custom StyledImage format
// Use object mapping instead of passing class directly to avoid TS overload errors
(Quill as any).register({ 'formats/image': StyledImage }, true);
