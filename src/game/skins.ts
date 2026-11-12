// Aspectos (skins) del astronauta: cuatro básicos y cuatro desbloqueables con logros.
import { achievements } from './achievements'

export type SkinId = 'white' | 'red' | 'green' | 'blue' | 'orange' | 'black' | 'soldier' | 'worn' | 'meteor' | 'lego'
export type SkinStyle = 'standard' | 'outline' | 'armor' | 'worn' | 'meteor' | 'lego'

export type SkinDef = {
  id: SkinId
  name: string
  desc: string
  /** Logro que lo desbloquea (sin logro = disponible desde el principio). */
  unlock?: string
  unlockText?: string
  style: SkinStyle
  /** Tela principal del traje. */
  suit: number
  /** Franjas, anillos y detalles. */
  accent: number
  /** Mochila de soporte vital y unidad de pecho. */
  pack: number
  /** Guantes y botas. */
  glove: number
  /** Carcasa del casco. */
  helmet: number
  /** Articulaciones (codos, rodillas, cintura). */
  joint: number
}

export const SKINS: SkinDef[] = [
  { id: 'white', name: 'Blanco', desc: 'El traje reglamentario de la misión.', style: 'standard', suit: 0xf2f2ee, accent: 0xd9342b, pack: 0xc9ccd3, glove: 0x9aa0ab, helmet: 0xffffff, joint: 0xb9bdc6 },
  { id: 'red', name: 'Rojo', desc: 'Imposible perderte de vista.', style: 'standard', suit: 0xd5332f, accent: 0xf4f4f0, pack: 0x8e1f1f, glove: 0x2a2d35, helmet: 0xe2403b, joint: 0x7a1a1a },
  { id: 'green', name: 'Verde', desc: 'Fresco como una lechuga espacial.', style: 'standard', suit: 0x3fae4f, accent: 0xf4f4f0, pack: 0x23703a, glove: 0x2a2d35, helmet: 0x4cc35d, joint: 0x1f5e31 },
  { id: 'blue', name: 'Azul', desc: 'Del color del planeta que dejaste atrás.', style: 'standard', suit: 0x2f6fe0, accent: 0xf4f4f0, pack: 0x1d4494, glove: 0x2a2d35, helmet: 0x3c80f2, joint: 0x183a80 },
  { id: 'orange', name: 'Naranja', desc: 'Traje de lanzamiento de alta visibilidad.', unlock: 'winEasy', unlockText: 'Completa el juego en Fácil', style: 'standard', suit: 0xf07c1c, accent: 0x1b1d24, pack: 0x2f333c, glove: 0x1b1d24, helmet: 0xf4f4f0, joint: 0xb85a10 },
  { id: 'black', name: 'Negro', desc: 'Sigiloso, con contornos grises.', unlock: 'winNormal', unlockText: 'Completa el juego en Moderado', style: 'outline', suit: 0x17181d, accent: 0x9aa0ab, pack: 0x22242b, glove: 0x0e0f13, helmet: 0x1c1d23, joint: 0x2a2c34 },
  { id: 'soldier', name: 'Supersoldado', desc: 'Armadura de combate verde militar.', unlock: 'winHard', unlockText: 'Completa el juego en Difícil', style: 'armor', suit: 0x5b6d34, accent: 0x3d4a22, pack: 0x4a5a2a, glove: 0x1c1f22, helmet: 0x637638, joint: 0x1c1f22 },
  { id: 'meteor', name: 'Meteorito', desc: 'Traje café con meteoritos incrustados en relieve.', unlock: 'meteors30', unlockText: 'Destruye 30 meteoritos en el nivel del cohete', style: 'meteor', suit: 0x7a5236, accent: 0xd9a066, pack: 0x4e3524, glove: 0x2e2018, helmet: 0x8a6040, joint: 0x4e3524 },
  { id: 'lego', name: 'LEGO', desc: 'El astronauta, construido pieza a pieza.', unlock: 'spaceLegos', unlockText: 'Recoge las 7 piezas LEGO de colores en el nivel del cohete', style: 'lego', suit: 0xf4f4f0, accent: 0x2f6fe0, pack: 0x9aa0ab, glove: 0xffd21f, helmet: 0xf4f4f0, joint: 0x2a2d35 },
  { id: 'worn', name: 'Superviviente', desc: 'Blanco, desgastado y rasgado. Ha visto cosas.', unlock: 'winInfestation', unlockText: 'Completa el juego en INFESTACIÓN', style: 'worn', suit: 0xd8d0bc, accent: 0x8a3a2a, pack: 0x8f8a7c, glove: 0x5e5a52, helmet: 0xd9d3c2, joint: 0x8c8676 },
]

const BY_ID = new Map(SKINS.map(s => [s.id, s]))
const KEY = 'varado_skin_v1'

export function skinDef(id: SkinId): SkinDef {
  return BY_ID.get(id) ?? SKINS[0]
}

export function skinUnlocked(id: SkinId): boolean {
  const s = BY_ID.get(id)
  return !!s && (!s.unlock || achievements.done(s.unlock))
}

/** Aspecto elegido; si quedó bloqueado (logros reiniciados) vuelve al blanco. */
export function selectedSkin(): SkinId {
  try {
    const raw = localStorage.getItem(KEY) as SkinId | null
    if (raw && skinUnlocked(raw)) return raw
  } catch {
    /* localStorage puede estar deshabilitado */
  }
  return 'white'
}

export function selectSkin(id: SkinId): boolean {
  if (!skinUnlocked(id)) return false
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* ignorar */
  }
  return true
}
