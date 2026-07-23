#!/usr/bin/env python3
"""Procedurally synthesize all game audio (SFX + music) as 16-bit PCM WAVs.
Pure standard library so the build stays dependency-free. Run:  python3 gen_audio.py
Outputs into ../audio/ relative to this file."""
import math, os, struct, wave, random

SR = 22050
OUT = os.path.join(os.path.dirname(__file__), "..", "audio")
os.makedirs(OUT, exist_ok=True)

def write_wav(name, samples):
    path = os.path.join(OUT, name)
    # clamp + to int16
    frames = bytearray()
    for s in samples:
        v = int(max(-1.0, min(1.0, s)) * 32767)
        frames += struct.pack("<h", v)
    with wave.open(path, "w") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(bytes(frames))
    print("  wrote", name, "%.1fs" % (len(samples)/SR))

def env_adsr(n, a, d, s, r, sus=0.7):
    a=max(1,int(a*SR)); d=max(1,int(d*SR)); r=max(1,int(r*SR))
    out=[]
    for i in range(n):
        if i < a: out.append(i/a)
        elif i < a+d: out.append(1 - (1-sus)*((i-a)/d))
        elif i < n-r: out.append(sus)
        else: out.append(sus*max(0.0,(n-i)/r))
    return out

def sine(f, i): return math.sin(2*math.pi*f*i/SR)
def saw(f, i):
    p=(f*i/SR)%1.0; return 2*p-1
def tri(f,i):
    p=(f*i/SR)%1.0; return 4*abs(p-0.5)-1

def tone(freq, dur, vol=0.5, wave_fn=sine, a=0.005, d=0.03, s=0.02, r=0.05, sus=0.6, vibrato=0.0, vf=6.0):
    n=int(dur*SR); e=env_adsr(n,a,d,s,r,sus); out=[]
    for i in range(n):
        f=freq*(1+vibrato*math.sin(2*math.pi*vf*i/SR))
        out.append(wave_fn(f,i)*e[i]*vol)
    return out

def noise(dur, vol=0.4, a=0.005, r=0.05, lp=0.0):
    n=int(dur*SR); e=env_adsr(n,a,0.02,0.02,r,0.6); out=[]; prev=0.0
    for i in range(n):
        x=random.uniform(-1,1)
        if lp>0: prev=prev+(x-prev)*lp; x=prev
        out.append(x*e[i]*vol)
    return out

def mix(*layers):
    n=max(len(l) for l in layers); out=[0.0]*n
    for l in layers:
        for i,v in enumerate(l): out[i]+=v
    return out

def add_at(base, layer, at):
    for i,v in enumerate(layer):
        j=at+i
        if j < len(base): base[j]+=v
    return base

# ---------------- SFX ----------------
random.seed(7)

def sfx_click():
    return tone(880, 0.07, 0.35, sine, a=0.001, d=0.02, r=0.04, sus=0.3)
def sfx_confirm():
    return mix(tone(660,0.10,0.28,tri,a=0.002,r=0.06,sus=0.5),
               [0]*int(0.05*SR)+tone(990,0.12,0.26,tri,a=0.002,r=0.07,sus=0.5))
def sfx_blip():
    return tone(1250,0.05,0.28,sine,a=0.001,r=0.03,sus=0.3)
def sfx_cash():
    out=[]
    for k,f in enumerate([784,988,1319,1568]):
        out=add_at(out+[0]*0, tone(f,0.18,0.22,tri,a=0.001,d=0.04,r=0.10,sus=0.35), 0) if not out else out
    base=[0.0]*int(0.42*SR)
    for k,f in enumerate([784,988,1319,1568]):
        add_at(base, tone(f,0.20,0.20,tri,a=0.001,r=0.12,sus=0.3), int(k*0.045*SR))
    return base
def sfx_fail():
    n=int(0.28*SR); e=env_adsr(n,0.004,0.05,0.05,0.14,0.6); out=[]
    for i in range(n):
        f=420-180*(i/n); out.append(saw(f,i)*e[i]*0.26)
    return out
def sfx_whoosh():
    return noise(0.22,0.30,a=0.06,r=0.12,lp=0.15)
def sfx_cheer():
    base=noise(1.0,0.22,a=0.25,r=0.4,lp=0.08)
    # swelling amplitude for a crowd feel
    for i in range(len(base)):
        base[i]*= (0.4+0.6*math.sin(math.pi*i/len(base)))
    # a couple whistle overtones
    add_at(base, tone(1800,0.5,0.05,sine,a=0.2,r=0.25,sus=0.4,vibrato=0.02), int(0.2*SR))
    return base
def sfx_gavel():
    base=[0.0]*int(0.4*SR)
    add_at(base, noise(0.06,0.5,a=0.001,r=0.05,lp=0.5), 0)
    add_at(base, noise(0.06,0.5,a=0.001,r=0.05,lp=0.5), int(0.14*SR))
    return base
def sfx_tick():
    return tone(1600,0.02,0.18,sine,a=0.001,r=0.01,sus=0.2)
def sfx_gain():
    return mix(tone(523,0.14,0.2,tri,a=0.002,r=0.08,sus=0.4),
               [0]*int(0.06*SR)+tone(784,0.16,0.2,tri,a=0.002,r=0.09,sus=0.4))

for name,fn in [("click",sfx_click),("confirm",sfx_confirm),("blip",sfx_blip),("cash",sfx_cash),
                ("fail",sfx_fail),("whoosh",sfx_whoosh),("cheer",sfx_cheer),("gavel",sfx_gavel),
                ("tick",sfx_tick),("gain",sfx_gain)]:
    write_wav("sfx_%s.wav"%name, fn())

# ---------------- MUSIC ----------------
# Simple, tasteful, seamless-looping pads built from chord progressions.
def pad_chord(freqs, dur, vol=0.12, detune=0.004):
    n=int(dur*SR); out=[0.0]*n
    for f in freqs:
        for dv in (1-detune,1+detune):
            for i in range(n):
                out[i]+= math.sin(2*math.pi*f*dv*i/SR)*vol/ (len(freqs))
    # soft attack/release so chords blend
    ramp=int(0.25*SR)
    for i in range(ramp):
        out[i]*=i/ramp; out[n-1-i]*=i/ramp
    return out

def arp(freqs, dur, step=0.25, vol=0.10):
    n=int(dur*SR); out=[0.0]*n; k=0; t=0.0
    while t < dur:
        f=freqs[k%len(freqs)]
        add_at(out, tone(f,step*0.9,vol,tri,a=0.01,r=step*0.4,sus=0.4), int(t*SR))
        t+=step; k+=1
    return out

def make_loop(progression, chord_dur, arp_notes=None, arp_step=0.25, pad_vol=0.11, name="music.wav"):
    base=[]
    for ch in progression:
        base+= pad_chord(ch, chord_dur, pad_vol)
    if arp_notes:
        a=arp(arp_notes, len(base)/SR, arp_step, 0.06)
        base=mix(base, a)
    # gentle master
    for i in range(len(base)):
        base[i]=math.tanh(base[i]*1.4)*0.85
    write_wav(name, base)

# Menu theme — hopeful I–V–vi–IV in A
A=220.0
def hz(semi, base=A): return base*(2**(semi/12))
menu=[[hz(0),hz(4),hz(7)],   # A
      [hz(7),hz(11),hz(14)], # E
      [hz(9),hz(12),hz(16)], # F#m
      [hz(5),hz(9),hz(12)]]  # D
make_loop(menu, 3.0, arp_notes=[hz(12),hz(16),hz(19),hz(16)], arp_step=0.375, pad_vol=0.12, name="music_menu.wav")

# HQ bed — calmer, slower, ii–V–I feel
hq=[[hz(-3),hz(0),hz(4)],
    [hz(2),hz(5),hz(9)],
    [hz(-5),hz(-1),hz(2)],
    [hz(0),hz(4),hz(7)]]
make_loop(hq, 3.6, arp_notes=None, pad_vol=0.10, name="music_hq.wav")

# Tension — pulsing minor, for the closing weeks / election night
def make_tension(name="music_tension.wav"):
    prog=[[hz(0),hz(3),hz(7)],[hz(-2),hz(1),hz(5)],[hz(-4),hz(0),hz(3)],[hz(-5),hz(-1),hz(2)]]
    base=[]
    for ch in prog: base+=pad_chord(ch,2.4,0.10)
    # heartbeat pulse
    pulse=[0.0]*len(base); t=0.0
    while t < len(base)/SR:
        add_at(pulse, tone(hz(-12),0.14,0.16,sine,a=0.005,r=0.1,sus=0.3), int(t*SR)); t+=0.6
    base=mix(base,pulse)
    for i in range(len(base)): base[i]=math.tanh(base[i]*1.5)*0.85
    write_wav(name, base)
make_tension()

# Victory fanfare — short, not looped
def make_victory(name="music_victory.wav"):
    base=[0.0]*int(4.0*SR)
    seq=[(hz(0),0.0),(hz(4),0.18),(hz(7),0.36),(hz(12),0.54),(hz(7),0.9),(hz(12),1.1)]
    for f,t in seq:
        add_at(base, tone(f,0.5,0.20,tri,a=0.005,r=0.3,sus=0.5), int(t*SR))
    add_at(base, pad_chord([hz(0),hz(4),hz(7),hz(12)],2.6,0.12), int(1.3*SR))
    for i in range(len(base)): base[i]=math.tanh(base[i]*1.3)*0.9
    write_wav(name, base)
make_victory()

print("audio generation complete.")
