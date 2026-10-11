"""Create a soft, original bell transition without external audio dependencies."""
from pathlib import Path
import math
import random
import struct
import wave

RATE = 44100
DURATION = 1.8
random.seed(11)
output = Path(__file__).resolve().parents[1] / "assets/audio/opening-chime.wav"
samples = []
for i in range(int(RATE * DURATION)):
    t = i / RATE
    value = 0.0
    for delay, frequency, gain in [(0, 523.25, .14), (.11, 659.25, .10), (.23, 783.99, .09), (.37, 1046.5, .065)]:
        note_t = t - delay
        if note_t >= 0:
            envelope = min(note_t / .012, 1) * math.exp(-note_t * 3.4)
            tone = math.sin(2 * math.pi * frequency * note_t) + .25 * math.sin(2 * math.pi * frequency * 2 * note_t)
            value += gain * envelope * tone
    # A very quiet shimmer gives the heart burst a light, airy tail.
    value += random.uniform(-1, 1) * .004 * math.sin(math.pi * t / DURATION) ** 2
    value *= min((DURATION - t) / .15, 1)
    samples.append(struct.pack("<h", int(max(-1, min(1, value)) * 32767)))
with wave.open(str(output), "wb") as audio:
    audio.setnchannels(1)
    audio.setsampwidth(2)
    audio.setframerate(RATE)
    audio.writeframes(b"".join(samples))
print(f"Created {output.name}: {DURATION}s")
