# Métodos chamados a partir do JavaScript (window.FichaProAndroid) não podem ser removidos/renomeados
-keepclassmembers class pt.lappsstudio.fichapro.WebBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
