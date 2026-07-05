/**
 * Tiny WebAudio synth for Squad Surge — no audio assets, everything is
 * generated. Create one engine per play session; call `unlock()` from a user
 * gesture so iOS lets the context start.
 */

type NoiseOpts = {
	duration: number;
	volume: number;
	filterFreq: number;
	filterType?: BiquadFilterType;
};

export class SquadSurgeAudio {
	private ctx: AudioContext | null = null;
	private master: GainNode | null = null;
	private noiseBuffer: AudioBuffer | null = null;
	private lastShot = 0;
	muted = false;

	unlock() {
		if (typeof window === "undefined") {
			return;
		}
		if (!this.ctx) {
			const Ctor =
				window.AudioContext ??
				(window as unknown as { webkitAudioContext?: typeof AudioContext })
					.webkitAudioContext;
			if (!Ctor) {
				return;
			}
			this.ctx = new Ctor();
			this.master = this.ctx.createGain();
			this.master.gain.value = 0.5;
			this.master.connect(this.ctx.destination);
			const len = this.ctx.sampleRate * 0.5;
			this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
			const data = this.noiseBuffer.getChannelData(0);
			for (let i = 0; i < len; i += 1) {
				data[i] = Math.random() * 2 - 1;
			}
		}
		if (this.ctx.state === "suspended") {
			this.ctx.resume().catch(() => {});
		}
	}

	dispose() {
		this.ctx?.close().catch(() => {});
		this.ctx = null;
		this.master = null;
		this.noiseBuffer = null;
	}

	private get ready() {
		return !this.muted && this.ctx !== null && this.ctx.state === "running";
	}

	private noise({ duration, volume, filterFreq, filterType }: NoiseOpts) {
		if (!this.ready || !this.ctx || !this.master || !this.noiseBuffer) {
			return;
		}
		const t = this.ctx.currentTime;
		const src = this.ctx.createBufferSource();
		src.buffer = this.noiseBuffer;
		const filter = this.ctx.createBiquadFilter();
		filter.type = filterType ?? "lowpass";
		filter.frequency.value = filterFreq;
		const gain = this.ctx.createGain();
		gain.gain.setValueAtTime(volume, t);
		gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
		src.connect(filter).connect(gain).connect(this.master);
		src.start(t);
		src.stop(t + duration);
	}

	private tone(
		freq: number,
		duration: number,
		volume: number,
		type: OscillatorType = "square",
		slideTo?: number,
		delay = 0,
	) {
		if (!this.ready || !this.ctx || !this.master) {
			return;
		}
		const t = this.ctx.currentTime + delay;
		const osc = this.ctx.createOscillator();
		osc.type = type;
		osc.frequency.setValueAtTime(freq, t);
		if (slideTo !== undefined) {
			osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
		}
		const gain = this.ctx.createGain();
		gain.gain.setValueAtTime(volume, t);
		gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
		osc.connect(gain).connect(this.master);
		osc.start(t);
		osc.stop(t + duration);
	}

	/** Gunfire — throttled so a minigun doesn't stack 60 sounds a second. */
	shoot(pitch = 900) {
		const now = performance.now();
		if (now - this.lastShot < 55) {
			return;
		}
		this.lastShot = now;
		this.noise({
			duration: 0.07,
			volume: 0.16,
			filterFreq: pitch + Math.random() * 500,
			filterType: "bandpass",
		});
	}

	kill() {
		this.tone(320, 0.09, 0.1, "square", 90);
	}

	gateGood() {
		this.tone(523, 0.1, 0.16, "triangle");
		this.tone(784, 0.14, 0.16, "triangle", undefined, 0.07);
	}

	gateBad() {
		this.tone(196, 0.22, 0.18, "sawtooth", 110);
	}

	pickup() {
		this.tone(440, 0.08, 0.16, "square");
		this.tone(660, 0.08, 0.16, "square", undefined, 0.07);
		this.tone(880, 0.16, 0.16, "square", undefined, 0.14);
	}

	hurt() {
		this.noise({ duration: 0.18, volume: 0.3, filterFreq: 300 });
		this.tone(140, 0.16, 0.2, "sawtooth", 70);
	}

	bossRoar() {
		this.tone(70, 0.7, 0.32, "sawtooth", 45);
		this.noise({ duration: 0.5, volume: 0.2, filterFreq: 200 });
	}

	win() {
		const notes = [523, 659, 784, 1046];
		notes.forEach((freq, i) => {
			this.tone(freq, 0.22, 0.2, "triangle", undefined, i * 0.13);
		});
	}

	lose() {
		const notes = [392, 330, 262, 196];
		notes.forEach((freq, i) => {
			this.tone(freq, 0.3, 0.18, "sawtooth", undefined, i * 0.18);
		});
	}
}
