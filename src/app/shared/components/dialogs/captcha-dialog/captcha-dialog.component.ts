import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

type CaptchaData = {
  title?: string;
  message?: string;
  length?: number;       // ความยาวโค้ด (ค่าเริ่มต้น 6)
  caseSensitive?: boolean; // แยกตัวพิมพ์เล็ก/ใหญ่ไหม (ค่าเริ่มต้น false)
};

@Component({
  selector: 'app-captcha-dialog',
  templateUrl: './captcha-dialog.component.html',
  styleUrl: './captcha-dialog.component.scss'
})
export class CaptchaDialogComponent {
  code = '';
  imgSrc = '';
  input = '';
  length = 6;
  caseSensitive = false;

  constructor(
    private ref: MatDialogRef<CaptchaDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: CaptchaData
  ) {
    this.length = data?.length ?? 6;
    this.caseSensitive = !!data?.caseSensitive;
    this.regenerate();
  }

  regenerate() {
    this.code = this.makeCode(this.length);
    this.imgSrc = this.draw(this.code);
    this.input = '';
  }

  get matched(): boolean {
    if (this.caseSensitive) return this.input === this.code;
    return (this.input || '').toUpperCase() === this.code.toUpperCase();
  }

  cancel()  { this.ref.close(false); }
  confirm() { if (this.matched) this.ref.close(true); }

  private makeCode(n: number) {
    // ตัดตัวอักษรที่สับสน 0/O/o/1/I/l ออก
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
    let out = '';
    for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  private draw(text: string) {
    const w = 260, h = 80;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    // พื้นหลัง
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    // เส้นรบกวน
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = 'rgba(30,60,120,0.25)';
      ctx.lineWidth = 1 + Math.random() * 1.5;
      ctx.beginPath();
      ctx.moveTo(Math.random()*w, Math.random()*h);
      ctx.bezierCurveTo(Math.random()*w, Math.random()*h, Math.random()*w, Math.random()*h, Math.random()*w, Math.random()*h);
      ctx.stroke();
    }
    // จุดรบกวน
    for (let i = 0; i < 180; i++) {
      ctx.fillStyle = 'rgba(30,60,120,0.15)';
      ctx.beginPath();
      const x = Math.random()*w, y = Math.random()*h;
      ctx.arc(x, y, Math.random()*1.8, 0, Math.PI*2);
      ctx.fill();
    }
    // ตัวอักษร
    const gap = w / (text.length + 1);
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      ctx.save();
      const x = gap*(i+1), y = h/2 + (Math.random()*16 - 8);
      ctx.translate(x, y);
      ctx.rotate((Math.random()*0.6 - 0.3)); // เอียงเล็กน้อย
      ctx.fillStyle = '#324f9b';
      ctx.font = `${28 + Math.floor(Math.random()*8)}px Georgia`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    }
    return canvas.toDataURL('image/png');
  }
}
