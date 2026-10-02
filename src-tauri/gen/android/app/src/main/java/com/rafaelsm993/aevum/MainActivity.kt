package com.rafaelsm993.aevum

import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.WindowCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onWebViewCreate(webView: WebView) {
    webView.addJavascriptInterface(SystemBars(), "AevumSystemBars")
  }

  // Called by src/lib/theme.ts; true draws dark status and navigation bar icons for the light theme.
  inner class SystemBars {
    @JavascriptInterface
    fun setLightBars(light: Boolean) {
      runOnUiThread {
        WindowCompat.getInsetsController(window, window.decorView).apply {
          isAppearanceLightStatusBars = light
          isAppearanceLightNavigationBars = light
        }
      }
    }
  }
}
