import com.android.ide.common.vectordrawable.Svg2Vector;

import java.io.FileOutputStream;
import java.nio.file.Path;

/**
 * Convierte pares (entrada.svg, salida.xml) a VectorDrawable con el conversor de Android Studio.
 * Lo invoca scripts/export-android-art.mjs con el classpath de Android Studio.
 */
public class Svg2VectorCli {
    public static void main(String[] args) throws Exception {
        for (int i = 0; i + 1 < args.length; i += 2) {
            try (FileOutputStream out = new FileOutputStream(args[i + 1])) {
                String avisos = Svg2Vector.parseSvgToXml(Path.of(args[i]), out);
                if (avisos != null && !avisos.isBlank()) {
                    System.out.println(Path.of(args[i]).getFileName() + ": " + avisos.trim());
                }
            }
        }
    }
}
