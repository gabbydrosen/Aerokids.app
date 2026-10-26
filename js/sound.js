// engine, wind and effects (Kenney CC0 sounds). Browsers need a tap before audio can start.

const FILES = { coin: "coin", land: "land", click: "toggle", crash: "impact", engine: "engine" };
const STORAGE_KEY = "aerokids-sound";

export class SoundBoard {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.muted = false;
    this.started = false;
    try {
      this.muted = globalThis.localStorage?.getItem(STORAGE_KEY) === "off";
    } catch {
      /* storage blocked */
    }
  }

  // Call from a click or key handler.
  start() {
    if (this.started) {
      this.ctx?.resume?.();
      return;
    }
    const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioCtx || typeof fetch !== "function") return;
    this.started = true;
    try {
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(this.ctx.destination);
      this._buildEngine();
      for (const [name, file] of Object.entries(FILES)) this._load(name, `./sounds/${file}.mp3`);
    } catch (error) {
      console.warn("Sound is unavailable", error);
      this.ctx = null;
    }
  }

  async _load(name, url) {
    try {
      const data = await (await fetch(url)).arrayBuffer();
      this.buffers[name] = await new Promise((resolve, reject) =>
        this.ctx.decodeAudioData(data, resolve, reject),
      );
      if (name === "engine") this._startEngineLoop();
    } catch (error) {
      console.warn("Could not load sound", name, error);
    }
  }

  _buildEngine() {
    const c = this.ctx;
    this.engineGain = c.createGain();
    this.engineGain.gain.value = 0;
    this.engineFilter = c.createBiquadFilter();
    this.engineFilter.type = "lowpass";
    this.engineFilter.frequency.value = 900;
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    // Wind: filtered noise that rises with airspeed.
    const length = c.sampleRate * 2,
      noise = c.createBuffer(1, length, c.sampleRate),
      d = noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      last = last * 0.97 + (Math.random() * 2 - 1) * 0.03;
      d[i] = last * 6;
    }
    this.wind = c.createBufferSource();
    this.wind.buffer = noise;
    this.wind.loop = true;
    this.windFilter = c.createBiquadFilter();
    this.windFilter.type = "bandpass";
    this.windFilter.frequency.value = 500;
    this.windFilter.Q.value = 0.6;
    this.windGain = c.createGain();
    this.windGain.gain.value = 0;
    this.wind.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.master);
    this.wind.start();
  }

  _startEngineLoop() {
    const buffer = this.buffers.engine;
    if (!buffer || this.engineSource) return;
    this.engineSource = this.ctx.createBufferSource();
    this.engineSource.buffer = buffer;
    this.engineSource.loop = true;
    // Trim the encoder padding at each end so the loop has no click.
    this.engineSource.loopStart = 0.06;
    this.engineSource.loopEnd = Math.max(0.2, buffer.duration - 0.06);
    this.engineSource.connect(this.engineFilter);
    this.engineSource.start(0, 0.06);
  }

  // Called every frame with the airplane state.
  flight({ active, throttle = 0, speedKts = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime,
      on = active ? 1 : 0;
    this.engineGain.gain.setTargetAtTime(on * (0.05 + throttle * 0.16), t, 0.15);
    this.engineFilter.frequency.setTargetAtTime(600 + throttle * 1400, t, 0.2);
    if (this.engineSource) this.engineSource.playbackRate.setTargetAtTime(0.55 + throttle * 0.5, t, 0.2);
    this.windGain.gain.setTargetAtTime(on * Math.min(0.12, Math.max(0, speedKts - 20) / 900), t, 0.3);
    this.windFilter.frequency.setTargetAtTime(350 + speedKts * 6, t, 0.3);
  }

  play(name, volume = 0.6) {
    if (!this.ctx || this.muted) return;
    const buffer = this.buffers[name];
    if (!buffer) return;
    const src = this.ctx.createBufferSource(),
      gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.buffer = buffer;
    src.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  setMuted(value) {
    this.muted = Boolean(value);
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, this.muted ? "off" : "on");
    } catch {
      /* storage blocked */
    }
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
    return this.muted;
  }
  toggle() {
    return this.setMuted(!this.muted);
  }
}
