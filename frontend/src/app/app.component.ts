import { env } from '../env/env.dev';
import { CommonModule } from '@angular/common';
import { AudioService } from './audio.service';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Component, OnInit, ViewChild, ElementRef, HostListener, AfterViewInit, Renderer2 } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-root',
  styleUrls: ['./app.component.css'],
  templateUrl: './app.component.html',
  imports: [CommonModule, HttpClientModule]
})
export class AppComponent implements OnInit, AfterViewInit {
  @ViewChild('holdCanvas') holdCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('nextCanvas') nextCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('tetrisCanvas') tetrisCanvas!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private hctx!: CanvasRenderingContext2D;
  private nctx!: CanvasRenderingContext2D;

  state: any;
  isLight = false;
  showGhost = true;
  soundEnabled = true;

  private lastTime = 0;
  private moveCooldown = 0;
  private lastFrameTime = 0;
  private dropInterval = 800;
  private lastGameOverState = false;
  private keyState: { [key: string]: boolean } = {};

  constructor(
    private http: HttpClient, 
    private renderer: Renderer2,
    private audio: AudioService
  ) {}

  ngOnInit() {
    this.api();
    requestAnimationFrame(this.loop.bind(this));
  }

  ngAfterViewInit() {
    this.ctx = this.tetrisCanvas.nativeElement.getContext('2d')!;
    this.hctx = this.holdCanvas.nativeElement.getContext('2d')!;
    this.nctx = this.nextCanvas.nativeElement.getContext('2d')!;
    
    this.ctx.scale(30, 30);
    this.hctx.scale(20, 20);
    this.nctx.scale(20, 20);
  }

  api(cmd: string | null = null) {
    const oldScore = this.state?.score || 0;
    
    this.http.post(`${env.apiUrl}/state`, { cmd }).subscribe((s: any) => {
      if (cmd === 'rotate') this.audio.playSound('rotate', this.soundEnabled);
      if (cmd === 'hard_drop') this.audio.playSound('drop', this.soundEnabled);
      if (cmd === 'left' || cmd === 'right') this.audio.playSound('move', this.soundEnabled);
      
      if (s.score > oldScore) this.audio.playSound('clear', this.soundEnabled);
      if (s.game_over && !this.lastGameOverState) {
        this.audio.playSound('gameover', this.soundEnabled);
      }

      this.lastGameOverState = s.game_over;
      this.state = s;
      
      this.dropInterval = Math.max(100, 800 - ((s.level - 1) * 100));
      
      this.render();
    });
  }

  private loop(t: number) {
    const dt = t - this.lastFrameTime;
    this.lastFrameTime = t;

    if (this.state && !this.state.paused && !this.state.game_over) {
      if (this.keyState['arrowleft'] || this.keyState['arrowright'] || this.keyState['arrowdown']) {
        this.moveCooldown -= dt;
        if (this.moveCooldown <= 0) {
          if (this.keyState['arrowleft']) { this.api('left'); this.moveCooldown = 80; }
          else if (this.keyState['arrowright']) { this.api('right'); this.moveCooldown = 80; }
          else if (this.keyState['arrowdown']) { this.api('down'); this.moveCooldown = 40; }
        }
      }

      if (t - this.lastTime > this.dropInterval) { 
        this.api('tick'); 
        this.lastTime = t; 
      }
    }
    requestAnimationFrame(this.loop.bind(this));
  }

  private render() {
    if (!this.state || !this.ctx) return;
    
    this.ctx.fillStyle = this.isLight ? '#fdf0d5' : '#505050';
    this.ctx.fillRect(0, 0, 10, 20);

    this.state.board.forEach((row: any[], y: number) => {
      row.forEach((col, x) => { if(col) this.block(this.ctx, x, y, col); });
    });

    const p = this.state.active;
    if (p?.matrix) {
      p.matrix.forEach((row: any[], y: number) => row.forEach((v: number, x: number) => {
        if(v) {
          if (this.showGhost) {
            this.block(this.ctx, x + p.x, y + (this.state.ghost_y || 0), p.color, 0.15);
          }
          this.block(this.ctx, x + p.x, y + p.y, p.color, 1);
        }
      }));
    }
    this.updatePreview(this.hctx, this.state.hold);
    this.updatePreview(this.nctx, this.state.next);
  }

  private updatePreview(c: CanvasRenderingContext2D, p: any) {
    c.fillStyle = this.isLight ? '#ffafcc' : '#1a1a1a';
    c.fillRect(0, 0, 5, 5);
    if(p) {
      const m = p.matrix || p.m;
      m.forEach((row: any[], y: number) => row.forEach((v: number, x: number) => {
        if(v) this.block(c, x+0.5, y+0.5, p.color || p.c);
      }));
    }
  }

  private block(c: CanvasRenderingContext2D, x: number, y: number, col: string, a = 1) {
    c.save();
    c.globalAlpha = a;
    c.fillStyle = col;
    c.fillRect(x + 0.05, y + 0.05, 0.9, 0.9);
    c.strokeStyle = this.isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)";
    c.lineWidth = 0.05;
    c.strokeRect(x + 0.05, y + 0.05, 0.9, 0.9);
    c.restore();
  }

  toggleGhost() { this.showGhost = !this.showGhost; this.render(); }
  toggleSound() { this.soundEnabled = !this.soundEnabled; if (this.soundEnabled) this.audio.playSound('move', true); }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    const key = e.key.toLowerCase();
    const map: any = {
      'arrowleft':'left', 'arrowright':'right', 'arrowup':'rotate', 
      'arrowdown':'down', ' ':'hard_drop', 'c':'hold', 'p':'pause', 'r':'reset'
    };

    if (map[key]) {
      e.preventDefault();
      if ((this.state?.game_over || this.state?.paused) && !['p', 'r'].includes(key)) return;

      if (!this.keyState[key]) { 
        this.api(map[key]); 
        this.moveCooldown = 200;
      }
      this.keyState[key] = true;
    }

    if (key === 'l') { this.isLight = true; this.renderer.addClass(document.body, 'light-theme'); }
    if (key === 'd') { this.isLight = false; this.renderer.removeClass(document.body, 'light-theme'); }
    if (key === 'g') this.toggleGhost();
    if (key === 's') this.toggleSound();
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(e: KeyboardEvent) { 
    this.keyState[e.key.toLowerCase()] = false; 
  }
}