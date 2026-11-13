import { initializeApp, type FirebaseOptions } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

const env = import.meta.env

const firebaseConfig: FirebaseOptions = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

/** false si falta alguna variable en .env (la app muestra un aviso en lugar de fallar). */
export const firebaseConfigured = Object.values(firebaseConfig).every((v) => typeof v === 'string' && v.length > 0)

// Con valores de relleno getAuth no lanza al importar; la UI revisa firebaseConfigured antes de usarlo.
export const app = initializeApp(
  firebaseConfigured ? firebaseConfig : { apiKey: 'sin-configurar', projectId: 'sin-configurar', appId: 'sin-configurar' },
)

/** La sesión anónima persiste en IndexedDB del dispositivo. */
export const auth = getAuth(app)

/** Firestore con caché persistente (funciona sin conexión) compartida entre pestañas. */
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

/**
 * Solo para desarrollo y pruebas: con VITE_FIREBASE_EMULATOR=true la app usa el emulador local
 * (`firebase emulators:start --only firestore,auth`) en lugar del proyecto real.
 */
if (env.DEV && env.VITE_FIREBASE_EMULATOR === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
