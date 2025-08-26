import Quill from 'quill';

export class ImageResizeCustom {
  private quill: any;
  private img: HTMLImageElement | null = null;
  private box: HTMLDivElement | null = null;
  private originalWidth = 0;
  private originalHeight = 0;
  private startX = 0;
  private startY = 0;

  constructor(quill: any) {
    this.quill = quill;

    this.quill.root.addEventListener('click', (evt: MouseEvent) => {
      const target = evt.target as HTMLElement;
      if (target && target.tagName === 'IMG') {
        this.showResizeBox(target as HTMLImageElement);
      } else {
        this.removeBox();
      }
    });
  }

  private showResizeBox(image: HTMLImageElement) {
    this.removeBox();

    this.img = image;

    // เก็บขนาดเริ่มต้นและตำแหน่งเมาส์ตอนเริ่ม resize
    this.originalWidth = this.img.width;
    this.originalHeight = this.img.height;

    const box = document.createElement('div');
    box.style.position = 'absolute';
    box.style.border = '1px dashed #aaa';
    box.style.zIndex = '1000';
    box.style.cursor = 'nwse-resize';

    const rect = image.getBoundingClientRect();
    const editorRect = this.quill.root.getBoundingClientRect();
    box.style.top = rect.top - editorRect.top + 'px';
    box.style.left = rect.left - editorRect.left + 'px';
    box.style.width = rect.width + 'px';
    box.style.height = rect.height + 'px';

    const handle = document.createElement('div');
    handle.style.width = '10px';
    handle.style.height = '10px';
    handle.style.background = '#000';
    handle.style.position = 'absolute';
    handle.style.right = '0';
    handle.style.bottom = '0';
    handle.style.cursor = 'nwse-resize';

    // เก็บตำแหน่งเริ่มต้นของเมาส์ตอนคลิก handle
    handle.addEventListener('mousedown', (e) => this.startResize(e));

    box.appendChild(handle);
    this.quill.root.parentElement?.appendChild(box);
    this.box = box;
  }

  private startResize = (e: MouseEvent) => {
    e.preventDefault();
    this.startX = e.clientX;
    this.startY = e.clientY;

    document.addEventListener('mousemove', this.resize);
    document.addEventListener('mouseup', this.stopResize);
  };

  private resize = (e: MouseEvent) => {
    if (!this.img || !this.box) return;

    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;

    let newWidth = this.originalWidth + dx;
    let newHeight = this.originalHeight + dy;

    // ถ้ากด shift ค้างไว้ ให้ scale ตามอัตราส่วนเดิม (lock aspect ratio)
    if (e.shiftKey) {
      const aspectRatio = this.originalWidth / this.originalHeight;
      if (newWidth / newHeight > aspectRatio) {
        newWidth = newHeight * aspectRatio;
      } else {
        newHeight = newWidth / aspectRatio;
      }
    }

    // บังคับขนาดขั้นต่ำ (ไม่ให้ติดลบ)
    newWidth = Math.max(newWidth, 10);
    newHeight = Math.max(newHeight, 10);

    // อัพเดตขนาดและตำแหน่งกล่อง resize
    const editorRect = this.quill.root.getBoundingClientRect();
    const left = this.img.getBoundingClientRect().left - editorRect.left;
    const top = this.img.getBoundingClientRect().top - editorRect.top;

    this.img.style.width = `${newWidth}px`;
    this.img.style.height = `${newHeight}px`;

    // ตั้ง display inline ตามที่ต้องการ
    this.img.style.display = 'inline';

    this.box.style.width = `${newWidth}px`;
    this.box.style.height = `${newHeight}px`;
    this.box.style.left = `${left}px`;
    this.box.style.top = `${top}px`;
  };

  private stopResize = () => {
    document.removeEventListener('mousemove', this.resize);
    document.removeEventListener('mouseup', this.stopResize);
  };

  private removeBox() {
    if (this.box) {
      this.box.remove();
      this.box = null;
    }
  }
}
