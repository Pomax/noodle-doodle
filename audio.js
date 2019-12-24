import { Tone } from "./Tone.js";

const beat = new Tone.Synth().toMaster();
const oscillator = {
    type: 'triangle8'
  };
const envelope = {
    attack: 0.001,
    decay: 1,
    sustain: 0.4,
    release: 4
  };
const synth = new Tone.PolySynth(16, Tone.Synth, {
    oscillator,
    envelope
}).toMaster();


export { synth, beat };
