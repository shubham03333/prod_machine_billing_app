function pickVoice(langPrefix: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix.toLowerCase())) ||
    voices.find((v) => v.lang.toLowerCase().includes(langPrefix.split('-')[0].toLowerCase())) ||
    null
  )
}

function speakOnce(text: string, lang: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve()
      return
    }
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = lang
    utter.rate = 0.9
    const voice = pickVoice(lang)
    if (voice) utter.voice = voice
    utter.onend = () => resolve()
    utter.onerror = () => resolve()
    window.speechSynthesis.speak(utter)
  })
}

export async function speakMeasuredArea(acres: number, guntha: number): Promise<void> {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    throw new Error('या फोनवर आवाज उपलब्ध नाही')
  }

  window.speechSynthesis.cancel()
  // Some browsers load voices asynchronously.
  await new Promise((r) => setTimeout(r, 50))
  if (window.speechSynthesis.getVoices().length === 0) {
    await new Promise<void>((resolve) => {
      window.speechSynthesis.onvoiceschanged = () => resolve()
      setTimeout(() => resolve(), 400)
    })
  }

  const acreText = acres.toFixed(2)
  const gunthaText = guntha.toFixed(1)

  const marathi = `मोजलेले क्षेत्र ${gunthaText} गुंठा आहे. म्हणजे ${acreText} एकर.`
  const english = `Measured area is ${gunthaText} guntha. That is ${acreText} acre.`

  const marathiLang = pickVoice('mr-IN') ? 'mr-IN' : pickVoice('hi-IN') ? 'hi-IN' : 'hi-IN'
  await speakOnce(marathi, marathiLang)
  await speakOnce(english, pickVoice('en-IN') ? 'en-IN' : 'en-US')
}
