import { Tone } from "./Tone.js";
const synth = new Tone.PolySynth(8, Tone.Synth, {
    oscillator : {
          type : "square"
      }
  }).toMaster();
const beat = new Tone.Synth().toMaster();
const noBeep = false;
const BPM = 130;
const tickLength = 60000 / BPM;

const octaves = [2,3,4,5];
const keys = 'c,cd,d,de,e,f,fg,g,ga,a,ab,b'.split(`,`);
const offsets = `⻀,⻀,z,s,x,d,c,v,g,b,h,n,j,m,q,2,w,3,e,r,5,t,6,y,7,u,i,9,o,0,p`.split(`,`);
const lengths = `1,2,3,4,5,6,7,8`.split(`,`);
let duration = false;

function createCells(track,label) {
    let l = document.createElement('td');
    l.classList.add('label');
    l.textContent = label;
    track.appendChild(l);
    octaves.forEach(o => {
        keys.forEach(k => {
            let td = document.createElement('td');
            td.dataset.note = k.toUpperCase() + o;
            td.classList.add(k, 'key', `o${o}`);
            track.appendChild(td);
        });
    });
    return track;
}

function createTrack(label) {
    let track = document.createElement("tr");
    track.classList.add('rail');
    if (label > 1 && (label - 1) % 8 === 0) {
        track.classList.add('major');
    }
    return createCells(track, label);
}

const program = document.getElementById('program');
const scrubber = document.querySelector('tr.scrubber');

let master = createTrack();
master.classList.add('master');
program.appendChild(master);
program.appendChild(scrubber);

for(let i=0; i<32; i++) {
    program.appendChild(createTrack(i+1));
}

function clear() {
    const track = scrubber.nextElementSibling;
    track.querySelectorAll('td').forEach(td => {
        td.classList.remove('red', 'green');
    });
}

// --------------

let activeKeys = {};
let recCount = 0;
let last = 0;

function getTick() {
    return Array.from(scrubber.parentNode.children).indexOf(scrubber) - 1;
}
function startRecording() {
    if (recCount === 0) {
        last = Date.now();
        requestAnimationFrame(record);
    }
    recCount++;
}

function stopRecording() {
    recCount--;
}

function onBeat(fn1, fn2) {
    if (Date.now() - last >= tickLength) {
        fn1();
        last = Date.now();
        fn2();
    }
}

function record() {
    onBeat(() => {
        // 1. record the active keys
        if(!noBeep) {
            beat.triggerAttackRelease((getTick()) % 4 === 0 ? "C7" : "C6", "16n");
        }

        let offsets = Object.keys(activeKeys);
        let track = scrubber.nextElementSibling;
        if (track) {
            offsets.forEach(offset => {
                let qs = `td:nth-child(${parseInt(offset)})`;
                track.querySelector(qs).classList.add('red');
            });
        }
    },
    // 2. move the scrubber
    () => scrubberDown());

    if (recCount > 0) {
        requestAnimationFrame(record);
    }
}

// --------------

let playing = false;

function togglePlay() {
    playing = !playing;
    if (playing) {
        last = 0;
        playMusic();
    }
}

function playMusic() {
    onBeat(() => {
        let track = scrubber.nextElementSibling;
        if (track) {
            // get all "red" keys, play them.
            track.querySelectorAll('td.red').forEach(cell => {
                let note = cell.dataset.note;
                if (note.length === 3) note = note[0] + '#' + note[2];
                synth.triggerAttackRelease(note, "8n");
            });
        }
    },() => scrubberDown());
    if (playing) requestAnimationFrame(playMusic);
}

// --------------

function scrubberUp(stickToTop, largeSkip) {
    let prev = scrubber.previousElementSibling;
    if (largeSkip) {
        let n = 8;
        while(--n>0) {
            if (prev === master) {
                prev = Array.from(master.parentNode.childNodes).slice(-1)[0];
            }
            prev = prev.previousElementSibling;
        }
    }
    if (prev !== master) {
        scrubber.parentNode.insertBefore(scrubber, prev);
    } else if (!stickToTop) {
        program.appendChild(scrubber);
        program.insertBefore(scrubber, scrubber.previousElementSibling);
    }
}

function scrubberDown(stickToBottom, largeSkip) {
    let next = scrubber.nextElementSibling;
    if (largeSkip) {
        let n = 8;
        while(--n>0) {
            if (!next.nextElementSibling) {
                next = master;
            }
            next = next.nextElementSibling;
        }
    }
    next = next.nextElementSibling;
    if (next) {
        program.insertBefore(scrubber, next);
    } else if (!stickToBottom) {
        program.insertBefore(scrubber, master.nextElementSibling);
    }
}

function stop(evt) { evt.preventDefault(); }

function keyDown(evt) {
    // explicit duration? (non-exclusive)
    if (evt.shiftKey && lengths.includes(String.fromCharCode(evt.keyCode))) {
        duration = parseInt(String.fromCharCode(evt.keyCode));
    }

    // move scrubber up
    if (evt.key === "ArrowUp") {
        stop(evt);
        scrubberUp(false, evt.shiftKey);
    }

    // move scrubber down
    else if (evt.key === "ArrowDown") {
        stop(evt);
        scrubberDown(false, evt.shiftKey);
    }

    // intercept the "backspace". It should delete the previous row.
    else if (evt.key === "Backspace") {
        stop(evt);
        scrubberUp();
        clear();
    }

    // "delete" should delete the current row
    else if (evt.key === "Delete") {
        clear();
    }

    // spacebar toggles play/record
    else if(evt.key === " ") {
        stop(evt);
        togglePlay();
    }


    // "play" a key
    else {
        let offset = offsets.findIndex(v => v === evt.key.toLowerCase());
        if (offset !== -1) {
            let track = scrubber.nextElementSibling;
            let cell = false;
            let note = false;

            if (track) {
                cell = track.querySelector(`td:nth-child(${offset})`);
                cell.classList.add('green');
                note = cell.dataset.note;
                if (note.length === 3) note = note[0] + '#' + note[2];

                if (duration) {
                    // explicitly record this, once, at the specified length.
                    let n = duration;
                    while(n--) {
                        scrubber.nextElementSibling.querySelector(`td:nth-child(${offset})`).classList.add('red');
                        scrubberDown();
                    }
                    synth.triggerAttackRelease(note, "8n");
                }

                else {
                    // record this "with a tick" if held long enough.
                    let initiate = !activeKeys[offset];

                    if (!activeKeys[offset]) {
                        activeKeys[offset] = true;
                        startRecording();
                    }

                    if (cell && initiate) {
                        synth.triggerAttack(note);
                    }
                }
            }
        }
    }
}

function keyUp(evt) {
    if (evt.shiftKey && lengths.includes(String.fromCharCode(evt.keyCode))) { duration = false }
    if (evt.keyCode === 38) {}
    else if (evt.keyCode === 40) {}
    else {
        let offset = offsets.findIndex(v => v === evt.key.toLowerCase());
        if (offset !== -1) {
            delete activeKeys[offset];

            stopRecording();

            let track = scrubber.nextElementSibling;
            if (track) {
                let td = track.querySelector(`td:nth-child(${offset})`);
                td.classList.remove('green');

                let note = td.dataset.note;
                if (note.length === 3) note = note[0] + '#' + note[2];
                synth.triggerRelease(note);
            }
        }
    }
}

document.addEventListener('keydown', keyDown);
document.addEventListener('keyup', keyUp);
program.focus();
