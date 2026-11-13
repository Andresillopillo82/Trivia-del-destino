# Reglas de R8 para la versión release.
#
# No hace falta casi nada propio: Firebase, kotlinx.serialization, Navigation y WorkManager
# traen sus reglas dentro de sus bibliotecas. La app no usa reflexión (Firestore se lee y
# escribe con mapas, no con toObject), así que R8 puede renombrar el resto sin romper nada.

# Conserva números de línea en los errores para poder leer los informes de fallos.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
