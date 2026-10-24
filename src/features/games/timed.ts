/* Общий каркас игры на время: таймер, счёт, серия (Близнецы, Ложные друзья, Цифры, Термины). */
import { useEffect, useRef, useState } from 'react'
import { stopAudio } from '../../lib/audio/audio'
import { sfx } from '../../lib/audio/sfx'
import { comboPoints } from '../../lib/games/games'
import { comboMultiplier } from '../../lib/progress/signal'

export type TimedOutcome = { score: number; correct: number; wrong: number; bestStreak: number; seconds: number; spokenMs: number; onTime: number }

/** `ready` — таймер стартует, когда материал загружен (колода из базы, словарь). */
/** `paused` — пока показан разбор ошибки, время не идёт: читать объяснение не должно стоить очков. */
/**
  Обратный отсчёт, который можно ставить на паузу. Считает накопленные миллисекунды, а не тики по секунде:
  иначе при частых паузах (ошибка → разбор → «Дальше» быстрее секунды) setInterval перезапускался
  и не успевал отсчитать ни одной секунды — игра не кончалась.
*/
export function useCountdown(seconds: number, running: boolean): number {
  const [left, setLeft] = useState(seconds)
  const spent = useRef(0)
  useEffect(() => {
    if (!running) return
    let last = Date.now()
    const tick = () => {
      const now = Date.now()
      spent.current += now - last
      last = now
      setLeft(Math.max(0, seconds - Math.floor(spent.current / 1000)))
    }
    const timer = setInterval(tick, 250)
    return () => {
      clearInterval(timer)
      tick()
    }
  }, [running, seconds])
  return left
}

export function useTimed(seconds: number, onFinish: (o: TimedOutcome) => void, ready = true, paused = false) {
  const left = useCountdown(seconds, ready && !paused)
  const [streak, setStreak] = useState(0)
  const [score, setScore] = useState(0)
  const stats = useRef({ correct: 0, wrong: 0, best: 0 })
  const ended = useRef(false)
  const started = useRef(0)
  useEffect(() => {
    if (ready && !started.current) started.current = Date.now()
  }, [ready])
  useEffect(() => {
    if (left > 0 || ended.current) return
    ended.current = true
    stopAudio()
    onFinish({ score, correct: stats.current.correct, wrong: stats.current.wrong, bestStreak: stats.current.best, seconds: (Date.now() - started.current) / 1000, spokenMs: 0, onTime: 0 })
  }, [left, score, onFinish])
  const answer = (ok: boolean): number => {
    const s2 = ok ? streak + 1 : 0
    if (ok) {
      stats.current.correct++
      stats.current.best = Math.max(stats.current.best, s2)
      setScore((x) => x + comboPoints(comboMultiplier(s2)))
      sfx(s2 === 5 || s2 === 10 ? 'combo' : 'correct')
    } else {
      stats.current.wrong++
      sfx('wrong')
    }
    setStreak(s2)
    return s2
  }
  return { left, streak, score, answer, ended }
}

