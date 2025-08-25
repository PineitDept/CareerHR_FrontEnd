import Quill from 'quill';
import { ImageResizeCustom } from './quill/image-resize-custom';

export function setupQuillOnce(): void {
  if ((window as any).__quillSetupDone) return;

  // Optional: เปิด inline style
  const Align = Quill.import('attributors/style/align');
  const Color = Quill.import('attributors/style/color');
  const Background = Quill.import('attributors/style/background');
  const Font = Quill.import('attributors/style/font');
  const Size = Quill.import('attributors/style/size');

  Quill.register({
    'attributors/style/align': Align,
    'attributors/style/color': Color,
    'attributors/style/background': Background,
    'attributors/style/font': Font,
    'attributors/style/size': Size,
  }, true);

  // ✅ Register module imageResizeCustom
  Quill.register('modules/imageResize', ImageResizeCustom);

  (window as any).__quillSetupDone = true;
}


const BaseImage = Quill.import('formats/image');

const ImageFormatAttributesList = ['alt', 'height', 'width', 'style'];

class StyledImage extends BaseImage {
  static formats(domNode: HTMLElement) {
    return ImageFormatAttributesList.reduce((formats, attribute) => {
      if (domNode.hasAttribute(attribute)) {
        formats[attribute] = domNode.getAttribute(attribute)!;
      }
      return formats;
    }, {} as Record<string, string>);
  }

  format(name: string, value: string | null) {
    if (ImageFormatAttributesList.includes(name)) {
      if (value) {
        this['domNode'].setAttribute(name, value);
      } else {
        this['domNode'].removeAttribute(name);
      }
    } else {
      super.format(name, value);
    }
  }
}

Quill.register(StyledImage, true);