import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private audioCtx?: AudioContext;

  playSound(type: string, enabled: boolean) {
    if (!enabled) return;

    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      const now = this.audioCtx.currentTime;

      switch (type) {
        case 'move':
          osc.type = 'sine';
          this.setEnvelope(osc, gain, 400, 350, 0.05, 0.05, now);
          break;
        case 'down':
          osc.type = 'sine';
          this.setEnvelope(osc, gain, 200, 150, 0.03, 0.04, now);
          break;
        case 'rotate':
          osc.type = 'triangle';
          this.setEnvelope(osc, gain, 600, 900, 0.04, 0.08, now);
          break;
        case 'drop':
          osc.type = 'sine';
          this.setEnvelope(osc, gain, 120, 40, 0.2, 0.15, now);
          break;
        case 'clear':
          osc.type = 'sine';
          this.setEnvelope(osc, gain, 523, 1046, 0.1, 0.4, now);
          break;
        case 'gameover':
          osc.type = 'sine';
          this.setEnvelope(osc, gain, 650, 20, 0.1, 1.2, now);
          break;
      }
      osc.start(now);
      osc.stop(now + 1.5);
    } catch (e) {
      console.warn("Audio interaction required.");
    }
  }

  private setEnvelope(osc: OscillatorNode, gain: GainNode, startFreq: number, endFreq: number, vol: number, duration: number, now: number) {
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + duration);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.linearRampToValueAtTime(0, now + duration);
  }
}