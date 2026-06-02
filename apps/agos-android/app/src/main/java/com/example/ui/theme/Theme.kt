package com.example.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkColorScheme = darkColorScheme(
    primary = NeonIndigo,
    onPrimary = Color.White,
    secondary = NeonBlue,
    onSecondary = Color.White,
    tertiary = NeonCyan,
    background = Color(0xFF131118),       // Sleek premium dark background
    onBackground = Color(0xFFF4EFF4),
    surface = Color(0xFF1C1A22),          // Dark cards
    onSurface = Color(0xFFF4EFF4),
    surfaceVariant = Color(0xFF49454F),
    onSurfaceVariant = Color(0xFFCAC4D0),
    error = NeonRed,
    onError = Color.White
)

private val LightColorScheme = lightColorScheme(
    primary = NeonIndigo,                 // Sleek M3 Purple (#6750A4)
    onPrimary = Color.White,
    secondary = NeonIndigo,
    onSecondary = Color.White,
    tertiary = NeonCyan,                  // (#0891B2)
    background = CyberBg,                 // Sleek light background (#FAF9FD)
    onBackground = CyberTextPrimary,       // Deep charcoal text (#1C1B1F)
    surface = CyberCard,                  // Crisp white surface (#FFFFFF)
    onSurface = CyberTextPrimary,
    surfaceVariant = SleekRecentBg,       // M3 Lavender variant background (#F3EDF7)
    onSurfaceVariant = CyberTextSecondary,// Soft slate grey secondary text (#49454F)
    error = NeonRed,                      // (#B3261E)
    onError = Color.White
)

@Composable
fun MyApplicationTheme(
    darkTheme: Boolean = false, // Default to Sleek Interface light theme
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
