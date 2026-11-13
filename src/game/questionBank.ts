import raw from '../data/questions.json'
import { indexQuestions, parseQuestions } from './questions'

/** Banco de preguntas empaquetado con la app (no se guarda en Firestore). */
export const QUESTIONS = parseQuestions(raw)
export const QUESTIONS_BY_ID = indexQuestions(QUESTIONS)
