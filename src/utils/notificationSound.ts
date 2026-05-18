let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx || ctx.state === 'closed') {
    ctx = new AudioContext()
  }
  return ctx
}

function beep(audioCtx: AudioContext, freq: number, start: number, duration: number) {
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()

  osc.connect(gain)
  gain.connect(audioCtx.destination)

  osc.type = 'sine'
  osc.frequency.value = freq

  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(0.35, start + 0.01)
  gain.gain.linearRampToValueAtTime(0, start + duration)

  osc.start(start)
  osc.stop(start + duration + 0.05)
}

export function playNewOrderSound() {
  try {
    const audioCtx = getCtx()

    // resume necessário se o contexto foi suspenso pelo browser (política de autoplay)
    audioCtx.resume().then(() => {
      const now = audioCtx.currentTime
      beep(audioCtx, 880, now, 0.12)         // primeiro ding  (A5)
      beep(audioCtx, 1108, now + 0.18, 0.12) // segundo ding   (C#6)
      beep(audioCtx, 1320, now + 0.36, 0.18) // terceiro ding  (E6)
    })
  } catch {
    // Web Audio API não disponível ou bloqueado — ignora silenciosamente
  }
}
