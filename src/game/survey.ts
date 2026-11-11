// Encuesta de evaluación integrada en el juego (sustituye al formulario externo).
// Las respuestas se guardan en este navegador y se pueden descargar o copiar; si SURVEY_ENDPOINT
// tiene una URL, además se envían allí como JSON.
import { SURVEY_ENDPOINT } from './config'

type Scale = { type: 'scale'; lo: string; hi: string }
type Choice = { type: 'choice'; options: string[]; multi?: boolean }
type Text = { type: 'text'; placeholder?: string }
type Question = { id: string; text: string } & (Scale | Choice | Text)
type Section = { title: string; note?: string; optional?: boolean; questions: Question[] }

const scale = (id: string, text: string, lo: string, hi: string): Question => ({ id, text, type: 'scale', lo, hi })
const choice = (id: string, text: string, options: string[], multi = false): Question => ({ id, text, type: 'choice', options, multi })
const text = (id: string, text: string, placeholder?: string): Question => ({ id, text, type: 'text', placeholder })

const IMPROVED: [string, string] = ['No mejoró', 'Mejoró considerablemente']
const YES_PARTLY_NO = ['Sí', 'En parte', 'No']
const YES_MAYBE_NO = ['Sí', 'Tal vez', 'No']

export const SURVEY: Section[] = [
  {
    title: 'Comparación con la versión anterior',
    note: 'Escala del 1 al 5: 1 = «No mejoró», 5 = «Mejoró considerablemente».',
    questions: [
      scale('cmp1', 'En comparación con la versión anterior, ¿cómo calificarías la mejora visual del videojuego?', ...IMPROVED),
      scale('cmp2', '¿Consideras que los movimientos y animaciones del personaje son ahora más fluidos?', ...IMPROVED),
      scale('cmp3', '¿Las nuevas mecánicas mejoraron tu experiencia de juego?', ...IMPROVED),
      scale('cmp4', '¿Consideras que la variedad de armas hace que los enfrentamientos sean menos repetitivos?', ...IMPROVED),
      scale('cmp5', '¿La ampliación del nivel hizo que la exploración fuera más interesante?', ...IMPROVED),
    ],
  },
  {
    title: 'Arsenal y sistema de combate',
    questions: [
      choice('ars1', '¿Cuántas de las armas disponibles llegaste a utilizar?', ['Solamente una', '2 a 3 armas', 'Todas las disponibles']),
      choice('ars2', '¿Qué tan equilibradas consideras las armas disponibles?', ['Muy desequilibradas', 'Poco equilibradas', 'Adecuadamente equilibradas', 'Muy bien equilibradas']),
      choice('ars3', '¿Sentiste que cada arma tenía una utilidad diferente?', YES_PARTLY_NO),
      choice('ars4', '¿Qué tipo de arma te resultó más efectiva o divertida?', ['Pistola láser', 'Rifle de asalto', 'Escopeta', 'Francotirador', 'Granadas de plasma']),
      choice('ars5', '¿Consideras que la cantidad de armas disponibles es suficiente?', ['Sí, es suficiente', 'Faltan armas', 'Sobran armas']),
    ],
  },
  {
    title: 'Dinámicas del personaje',
    questions: [
      scale('din1', '¿Qué tan cómodos te resultaron los controles del personaje?', 'Muy incómodos', 'Muy cómodos'),
      scale('din2', '¿Qué tan fluidos sentiste sus movimientos?', 'Nada fluidos', 'Muy fluidos'),
      choice('din3', '¿Las acciones disponibles (correr, esquivar, atacar, etc.) respondieron correctamente?', ['Siempre', 'Casi siempre', 'A veces', 'Casi nunca']),
      choice('din4', '¿Experimentaste dificultades al ejecutar alguna acción?', ['No', 'Sí, alguna vez', 'Sí, con frecuencia']),
      text('din5', '¿Qué movimiento o habilidad consideras que necesita mejorar?'),
    ],
  },
  {
    title: 'Nuevos sistemas: skins, logros y upgrades',
    note: 'Los upgrades son los beneficios que se obtienen al reunir piezas LEGO.',
    questions: [
      scale('sis1', '¿Qué tan interesante te pareció el sistema de personalización de skins?', 'Nada interesante', 'Muy interesante'),
      choice('sis2', '¿Consideras que los logros te motivan a cumplir objetivos adicionales?', YES_PARTLY_NO),
      choice('sis3', '¿El sistema de upgrades aporta una sensación de progreso?', YES_PARTLY_NO),
      choice('sis4', '¿Te resultó fácil comprender cómo funcionan las mejoras?', YES_PARTLY_NO),
      choice('sis5', '¿Qué sistema te motivó más a continuar jugando?', ['Skins', 'Logros', 'Upgrades', 'Ninguno']),
    ],
  },
  {
    title: 'Dificultades y configuración',
    questions: [
      choice('dif1', '¿Qué dificultad seleccionaste?', ['Fácil', 'Normal', 'Difícil', 'INFESTACIÓN', 'Todas']),
      scale('dif2', '¿Cómo calificarías el desafío de la dificultad seleccionada?', 'Muy fácil', 'Muy difícil'),
      choice('dif3', '¿Consideras que las opciones de configuración permiten adaptar adecuadamente el juego a tus preferencias?', YES_PARTLY_NO),
      choice('dif4', '¿Qué configuración modificaste? (puedes marcar varias)', ['Volumen', 'Sensibilidad', 'Gráficos', 'Ninguna'], true),
      choice('dif5', '¿Encontraste fácilmente las opciones de configuración?', YES_PARTLY_NO),
    ],
  },
  {
    title: 'Nuevos niveles · Nivel del cohete',
    note: 'Responde esta sección sólo si llegaste al nivel del cohete.',
    optional: true,
    questions: [
      scale('coh1', '¿Qué tan divertido te pareció este modo de juego?', 'Nada divertido', 'Muy divertido'),
      choice('coh2', '¿Consideras que su dificultad es adecuada?', ['Demasiado fácil', 'Adecuada', 'Demasiado difícil']),
      choice('coh3', '¿Te gustaría encontrar más niveles con mecánicas arcade diferentes?', YES_MAYBE_NO),
    ],
  },
  {
    title: 'Nuevos niveles · El nuevo planeta',
    questions: [
      scale('pla1', '¿Qué tan interesante te pareció explorar el nuevo escenario?', 'Nada interesante', 'Muy interesante'),
      choice('pla2', '¿La variedad de vehículos disponibles enriqueció la experiencia?', YES_PARTLY_NO),
      scale('pla3', '¿Qué tan satisfactorios fueron los enfrentamientos contra los nuevos enemigos?', 'Nada satisfactorios', 'Muy satisfactorios'),
      choice('pla4', '¿Consideras que el escenario ofrece suficientes elementos para explorar?', YES_PARTLY_NO),
      text('pla5', '¿Qué te gustaría encontrar en futuras zonas de exploración?'),
    ],
  },
  {
    title: 'Experiencia general y retención',
    questions: [
      scale('gen1', '¿Qué tan divertido te pareció el videojuego en esta versión?', 'Nada divertido', 'Muy divertido'),
      choice('gen2', '¿Volverías a jugarlo por iniciativa propia?', YES_MAYBE_NO),
      choice('gen3', '¿Cuánto tiempo estarías dispuesto a jugar una partida?', ['Menos de 10 minutos', '10 a 20 minutos', '20 a 40 minutos', 'Más de 40 minutos']),
      text('gen4', '¿Qué característica te motivaría a seguir jugando?'),
      choice('gen5', '¿Recomendarías este videojuego a otra persona?', YES_MAYBE_NO),
      choice('gen6', '¿Qué fue lo que más te motivó a continuar jugando?', [
        'Superar los desafíos', 'Desbloquear skins', 'Obtener logros', 'Mejorar las habilidades mediante upgrades',
        'Descubrir nuevos escenarios', 'Probar diferentes armas', 'Ninguna de las anteriores',
      ]),
    ],
  },
  {
    title: 'Detección de errores y oportunidades',
    questions: [
      choice('err1', '¿Experimentaste algún error durante la partida?', ['Sí', 'No']),
      text('err2', '¿En qué momento o nivel ocurrió?', 'Déjalo vacío si no hubo errores'),
      text('err3', '¿Encontraste alguna mecánica que no funcionara como esperabas?'),
      text('err4', '¿Hubo algún elemento que te pareciera confuso?'),
      text('err5', 'Si pudieras cambiar una sola cosa del videojuego, ¿qué cambiarías?'),
    ],
  },
  {
    title: 'Por último',
    questions: [
      choice('fin1', '¿Realmente mejoró la experiencia respecto a Alpha?', YES_PARTLY_NO),
      choice('fin2', '¿Las nuevas mecánicas aportan diversión o solamente complejidad?', ['Aportan diversión', 'Un poco de ambas', 'Solamente complejidad']),
      choice('fin3', '¿Los nuevos niveles son interesantes y suficientemente diferentes?', YES_PARTLY_NO),
      choice('fin4', '¿Los sistemas de progresión (skins, logros y upgrades) motivan a continuar jugando?', YES_PARTLY_NO),
      text('fin5', '¿Qué problemas siguen presentes y deberían atenderse en una siguiente versión?'),
    ],
  },
]

type Answer = number | string | string[]
type Answers = Record<string, Answer>
export type SurveyResponse = { date: string; context: Record<string, string | number>; answers: Answers }

const DRAFT_KEY = 'varado_survey_draft_v1'
const SAVED_KEY = 'varado_survey_responses_v1'

const esc = (s: string): string => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const store = {
  get<T>(key: string, def: T): T {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : def
    } catch {
      return def
    }
  },
  set(key: string, v: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(v))
    } catch {
      /* localStorage puede estar deshabilitado */
    }
  },
}

const answered = (a: Answer | undefined): boolean => a !== undefined && a !== '' && !(Array.isArray(a) && a.length === 0)

export class Survey {
  private page = 0
  private answers: Answers = store.get<Answers>(DRAFT_KEY, {})
  private context: Record<string, string | number> = {}
  private onClose: () => void = () => {}
  private last: SurveyResponse | null = null
  private readonly root: HTMLElement
  private readonly body: HTMLElement

  constructor() {
    this.root = document.getElementById('ovl-survey') as HTMLElement
    this.body = document.getElementById('survey-body') as HTMLElement
    this.root.addEventListener('click', e => this.click(e))
    this.root.addEventListener('input', e => {
      const t = e.target as HTMLTextAreaElement
      if (t.tagName !== 'TEXTAREA') return
      this.answers[t.dataset.q!] = t.value
      store.set(DRAFT_KEY, this.answers)
    })
  }

  get isOpen(): boolean {
    return !this.root.classList.contains('hidden')
  }

  /** `context` acompaña a las respuestas (dificultad, tiempo jugado…); `onClose` devuelve a la pantalla anterior. */
  open(context: Record<string, string | number>, onClose: () => void): void {
    this.context = context
    this.onClose = onClose
    this.page = 0
    this.last = null
    this.root.classList.remove('hidden')
    this.render()
  }

  close(): void {
    if (!this.isOpen) return
    this.root.classList.add('hidden')
    const fn = this.onClose
    this.onClose = () => {}
    fn()
  }

  private missing(sec: Section): string[] {
    if (sec.optional) return []
    return sec.questions.filter(q => q.type !== 'text' && !answered(this.answers[q.id])).map(q => q.id)
  }

  private click(e: Event): void {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act],[data-q]')
    if (!el || el.tagName === 'TEXTAREA') return
    const act = el.dataset.act
    if (act === 'close') return this.close()
    if (act === 'prev') {
      this.page = Math.max(0, this.page - 1)
      return this.render()
    }
    if (act === 'next') {
      const miss = this.missing(SURVEY[this.page])
      if (miss.length) return this.render(miss)
      if (this.page < SURVEY.length - 1) {
        this.page++
        return this.render()
      }
      return this.submit()
    }
    if (act === 'download') return this.download()
    if (act === 'copy') return void this.copy(el)
    // respuesta de escala u opción
    const id = el.dataset.q
    if (!id) return
    const q = SURVEY[this.page].questions.find(x => x.id === id)
    if (!q) return
    const v = el.dataset.v!
    if (q.type === 'scale') this.answers[id] = Number(v)
    else if (q.type === 'choice' && q.multi) {
      const cur = Array.isArray(this.answers[id]) ? [...(this.answers[id] as string[])] : []
      const i = cur.indexOf(v)
      if (i >= 0) cur.splice(i, 1)
      else cur.push(v)
      this.answers[id] = cur
    } else this.answers[id] = v
    store.set(DRAFT_KEY, this.answers)
    // sólo se actualiza el grupo pulsado, para no perder el foco ni el scroll
    const group = el.parentElement!
    group.querySelectorAll<HTMLElement>('[data-q]').forEach(b => {
      const a = this.answers[id]
      b.classList.toggle('on', Array.isArray(a) ? a.includes(b.dataset.v!) : String(a) === b.dataset.v)
    })
    group.closest('.sv-q')?.classList.remove('miss')
  }

  private render(miss: string[] = []): void {
    const sec = SURVEY[this.page]
    const n = SURVEY.length
    const qs = sec.questions.map((q, i) => {
      const a = this.answers[q.id]
      let ctrl: string
      if (q.type === 'scale') {
        const btns = [1, 2, 3, 4, 5].map(v => `<button type="button" class="sv-num ${a === v ? 'on' : ''}" data-q="${q.id}" data-v="${v}">${v}</button>`).join('')
        ctrl = `<div class="sv-scale"><span>${esc(q.lo)}</span><div class="sv-nums">${btns}</div><span>${esc(q.hi)}</span></div>`
      } else if (q.type === 'choice') {
        const on = (o: string): boolean => (Array.isArray(a) ? a.includes(o) : a === o)
        ctrl = `<div class="sv-opts">${q.options.map(o => `<button type="button" class="sv-opt ${on(o) ? 'on' : ''}" data-q="${q.id}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`
      } else {
        ctrl = `<textarea class="sv-text" data-q="${q.id}" rows="2" maxlength="600" placeholder="${esc(q.placeholder ?? 'Escribe tu respuesta (opcional)')}">${esc(typeof a === 'string' ? a : '')}</textarea>`
      }
      return `<div class="sv-q ${miss.includes(q.id) ? 'miss' : ''}"><p><b>${i + 1}.</b> ${esc(q.text)}</p>${ctrl}</div>`
    }).join('')
    this.body.innerHTML = `
      <div class="sv-head">
        <span class="sv-step">Sección ${this.page + 1} de ${n}</span>
        <button type="button" class="sv-x" data-act="close" title="Cerrar (tus respuestas se guardan como borrador)">✕</button>
      </div>
      <div class="sv-bar"><i style="width:${((this.page + 1) / n) * 100}%"></i></div>
      <h3>${esc(sec.title)}</h3>
      ${sec.note ? `<p class="sv-note">${esc(sec.note)}</p>` : ''}
      <div class="sv-list">${qs}</div>
      ${miss.length ? '<p class="sv-warn">Responde las preguntas marcadas para continuar.</p>' : ''}
      <div class="row-btns">
        ${this.page > 0 ? '<button type="button" class="btn" data-act="prev">Anterior</button>' : ''}
        <button type="button" class="btn primary" data-act="next">${this.page === n - 1 ? 'Enviar evaluación' : 'Siguiente'}</button>
      </div>`
    this.body.querySelector('.sv-list')!.scrollTop = 0
    this.body.querySelector<HTMLElement>('.sv-q.miss')?.scrollIntoView({ block: 'center' })
  }

  private submit(): void {
    const res: SurveyResponse = { date: new Date().toISOString(), context: this.context, answers: this.answers }
    this.last = res
    store.set(SAVED_KEY, [...store.get<SurveyResponse[]>(SAVED_KEY, []), res])
    this.answers = {}
    store.set(DRAFT_KEY, {})
    let sent = ''
    if (SURVEY_ENDPOINT) {
      sent = '<p class="sv-note" id="sv-sent">Enviando…</p>'
      // text/plain evita la consulta previa CORS (compatible con Google Apps Script y similares)
      fetch(SURVEY_ENDPOINT, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(this.asRow(res)) })
        .then(() => true, () => false)
        .then(ok => {
          const el = document.getElementById('sv-sent')
          if (el) el.textContent = ok ? 'Respuestas enviadas al equipo.' : 'No se pudieron enviar. Descárgalas y compártelas con el equipo.'
        })
    }
    this.body.innerHTML = `
      <h3>¡Gracias por evaluar VARADO!</h3>
      <p class="sv-note">Tus respuestas quedaron guardadas en este navegador.${SURVEY_ENDPOINT ? '' : ' Descárgalas o cópialas para compartirlas con el equipo.'}</p>
      ${sent}
      <div class="row-btns">
        <button type="button" class="btn" data-act="download">Descargar respuestas</button>
        <button type="button" class="btn" data-act="copy">Copiar respuestas</button>
        <button type="button" class="btn primary" data-act="close">Volver</button>
      </div>`
  }

  /** Fila para la hoja de cálculo: una columna por dato de la partida y por pregunta (ver scripts/encuesta-sheets.gs). */
  private asRow(r: SurveyResponse): { headers: string[]; values: (string | number)[] } {
    const headers = ['Fecha', ...Object.keys(r.context)]
    const values: (string | number)[] = [r.date, ...Object.values(r.context)]
    SURVEY.forEach((sec, s) => sec.questions.forEach((q, i) => {
      const a = r.answers[q.id]
      headers.push(`${s + 1}.${i + 1} ${q.text}`)
      values.push(!answered(a) ? '' : Array.isArray(a) ? a.join(', ') : a)
    }))
    return { headers, values }
  }

  /** Texto legible: cada pregunta con su respuesta, agrupadas por sección. */
  private asText(r: SurveyResponse): string {
    const lines = ['EVALUACIÓN DE VARADO', `Fecha: ${r.date}`, ...Object.entries(r.context).map(([k, v]) => `${k}: ${v}`)]
    for (const sec of SURVEY) {
      lines.push('', `== ${sec.title} ==`)
      sec.questions.forEach((q, i) => {
        const a = r.answers[q.id]
        const val = !answered(a) ? '(sin respuesta)' : Array.isArray(a) ? a.join(', ') : q.type === 'scale' ? `${a} / 5` : String(a)
        lines.push(`${i + 1}. ${q.text}`, `   → ${val}`)
      })
    }
    return lines.join('\n')
  }

  private download(): void {
    if (!this.last) return
    const blob = new Blob([this.asText(this.last)], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `varado-evaluacion-${this.last.date.slice(0, 19).replace(/[:T]/g, '-')}.txt`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  private async copy(btn: HTMLElement): Promise<void> {
    if (!this.last) return
    try {
      await navigator.clipboard.writeText(this.asText(this.last))
      btn.textContent = '¡Copiado!'
    } catch {
      btn.textContent = 'No se pudo copiar'
    }
  }
}
