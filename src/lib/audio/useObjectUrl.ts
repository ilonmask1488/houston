/*
  Запись ответа живёт как blob: URL (capture.ts). Без revokeObjectURL каждая запись остаётся в памяти
  до перезагрузки страницы — за занятие это десятки мегабайт на телефоне.
  Хук держит владелец результата: при замене записи и при уходе с экрана старая освобождается.
*/
import { useEffect } from 'react'

export function useObjectUrl(url: string | undefined | null): void {
  useEffect(() => {
    if (!url?.startsWith('blob:')) return
    return () => URL.revokeObjectURL(url)
  }, [url])
}
