import { synth, beat } from "./audio.js";

const BPM = 130;
const preroll = 2;
const noBeep = false;
const tickLength = 60000 / BPM;

const octaves = [0,1,2,3,4,5,6,7,8];
let octave = 2;
const keys = 'c,cd,d,de,e,f,fg,g,ga,a,ab,b'.split(`,`);
const offsets = `✖,✖,z,s,x,d,c,v,g,b,h,n,j,m,q,2,w,3,e,r,5,t,6,y,7,u,i,9,o,0,p,[,=,]`.split(`,`);
const lengths = `1,2,3,4,5,6,7,8,0`.split(`,`);
let duration = false;

function createCells(track,label) {
    let td = document.createElement('td');
    td.classList.add('label');
    if (label <= 8) td.dataset.step = label;
    td.textContent = label;
    track.appendChild(td);

    let n = 4;
    while (n-->0) {
        let o = octave + (4 - n);
        keys.forEach(k => {
            let td = document.createElement('td');
            td.dataset.note = k.toUpperCase() + o;
            td.classList.add(k, 'key', `o${o}`);
            td.draggable = true;
            track.appendChild(td);
        });
    };

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
let recording = false;
let last = 0;
let stopTimeout = false;

function getTick() {
    return Array.from(scrubber.parentNode.children).indexOf(scrubber) - 1;
}
function startRecording() {
    if (!recording) {
        clearTimeout(stopTimeout);
        stopTimeout = false;
        recording = true;
        last = Date.now() + preroll * tickLength;
        requestAnimationFrame(record);
    }
}

function stopRecording() {
    if (stopTimeout) clearTimeout(stopTimeout);
    stopTimeout = setTimeout(() => {
        if (stopTimeout && Object.keys(activeKeys).length===0) {
            recording = false;
        }
    }, tickLength);
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

    if (recording) {
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
    onBeat(playCurrentRow, scrubberDown);
    if (playing) requestAnimationFrame(playMusic);
}

function playCurrentRow(track) {
    track = track || scrubber.nextElementSibling;
    if (track) {
        // get all "red" keys, play them.
        track.querySelectorAll('td.red').forEach(cell => {
            let note = cell.dataset.note;
            if (note.length === 3) {
                note = note[0] + '#' + note[2];
            }
            synth.triggerAttackRelease(note, "8n");
        });
    }
}

// --------------

function scrubberUp(stickToTop, largeSkip) {
    program.querySelectorAll(`.green`).forEach(e => e.classList.remove(`green`));
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
    if (!playing) playCurrentRow();
}

function scrubberDown(stickToBottom, largeSkip) {
    program.querySelectorAll(`.green`).forEach(e => e.classList.remove(`green`));
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
    if (!playing) playCurrentRow();
}

// -----------

function stop(evt) { evt.preventDefault(); }

function keyDown(evt) {
    // explicit duration? (non-exclusive)
    if (evt.shiftKey && lengths.includes(String.fromCharCode(evt.keyCode))) {
        let step = parseInt(String.fromCharCode(evt.keyCode));

        if (duration) {
            let marker = program.querySelector(`td.label[data-step="${duration}"]`);
            marker.classList.remove('highlight');
            if (step === duration) {
                return (duration = false);
            }
        }

        if (step === 0) {
            duration = false;
        } else {
            duration = step;
            let marker = program.querySelector(`td.label[data-step="${duration}"]`);
            marker.classList.add('highlight');
        }
    }

    if (evt.key === "Home") {
        stop(evt);
        program.insertBefore(scrubber, master.nextElementSibling);
        if (!playing) playCurrentRow();
    }

    if (evt.key === "End") {
        stop(evt);
        program.appendChild(scrubber);
        program.insertBefore(scrubber,scrubber.previousElementSibling);
        if (!playing) playCurrentRow();
    }

    if (evt.key === "Return" || evt.key === "Enter") {
        if (!playing) playCurrentRow();
    }

    if (evt.key === "+" && octave < 5) {
        octave++;
        updateKeyOctaves();
    }

    if (evt.key === "-" && octave > 0) {
        octave--;
        updateKeyOctaves();
    }

    // move scrubber up
    if (evt.key === "ArrowUp" || evt.key === "ArrowLeft") {
        stop(evt);
        scrubberUp(false, evt.shiftKey);
    }

    // move scrubber down
    else if (evt.key === "ArrowDown" || evt.key === "ArrowRight") {
        stop(evt);
        scrubberDown(false, evt.shiftKey);
    }

    // intercept the "backspace". It should delete and move the scrubber.
    else if (evt.key === "Backspace") {
        stop(evt);
        // "back" by default, "forward" if we're shift-backspacing
        if (evt.shiftKey) {
            clear();
            scrubberDown()
        } else {
            scrubberUp();
            clear();
        }
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

                // color any other active key green, too.
                Object.keys(activeKeys).forEach(offset => {
                    let cell = track.querySelector(`td:nth-child(${offset})`);
                    cell.classList.add('green');
                });

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
                    }

                    if (!recording) {
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

// -------------------

let curCell = false;

function dragStart(evt) {
    if (evt.target.classList.contains('red')) {
        curCell = evt.target;
    }

    // prevent the ghost image:
    return false;
}

function dragEnd(_evt) {
    curCell = false;
}

function drag(evt) {
    let t = evt.target;
    if (t !== curCell && t.parentNode === curCell.parentNode) {
        curCell.classList.remove('red');
        t.classList.add('red');
        curCell = t;
        playCurrentRow(curCell.parentNode);
    }

    // prevent the ghost image:
    return false;
}

document.addEventListener('dragstart', dragStart);
document.addEventListener('dragend', dragEnd);
document.addEventListener('dragover', drag);

// ----------

function mouseDown(evt) {
    if (document.hasFocus() && document.activeElement === program) {
        let e = evt.target;
        if (e.classList.contains(`key`)) {
            e.classList.toggle(`red`);
            playCurrentRow(e.parentNode);
        }
    }
}

document.addEventListener('mousedown', mouseDown);

// ----------

program.focus();
