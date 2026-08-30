/* =====================================================
   KONSTANTEN / BUDGETS
   Schutz gegen Endlosläufe im Browser bei größeren
   Rastern bzw. hohen Schrittzahlen.
   ===================================================== */

export const EXACT_EDGE_LIMIT       = 26;     // bis hierhin exakte Berechnung (Bitmask-DP)
export const MAX_STEPS_TIME_BUDGET  = 500;    // ms, für approximative Maximalsuche (größere Raster)
export const GENERATION_NODE_BUDGET = 200000; // Rekursionsschritte pro Generierungsversuch
export const GENERATION_RETRIES     = 5;

// "Mehrere Elemente": pro Element eigenes Budget, plus Versuche für die
// Gesamtkonstruktion (Größenverteilung + alle Elemente), falls ein
// einzelnes Element mit der gewählten Punktzahl/Restfläche nicht
// erzeugbar ist.
export const MULTI_NODE_BUDGET_PER_ELEMENT = 100000;
export const MULTI_RETRIES                 = 8;

// "Alle Kombinationen" hat KEIN festes Anzeige-Limit mehr. Stattdessen:
// - Ergebnisse werden per Generator lazy berechnet (nur was gebraucht wird)
// - jeder Ladeschritt läuft zeitgescheibelt, damit der Main-Thread nie blockiert
// - eine sehr hohe Sicherheitsgrenze fängt nur pathologische Extremfälle ab
export const ENUM_BATCH_SIZE           = 48;      // Karten pro Ladeschritt (Scroll/Button)
export const ENUM_BATCH_TIME_SLICE_MS  = 35;      // max. ms Rechenzeit am Stück, bevor an den Browser abgegeben wird
export const ENUM_NODE_SAFETY_CEILING  = 3000000; // Notausstieg gegen pathologische Endlossuchen
export const ENUM_AUTO_LOAD_SOFT_LIMIT = 3000;    // ab hier: manueller Button statt automatischem Nachladen

// Obergrenze für den "Alle als ZIP"-Sammelexport: unabhängig von der
// Anzeige (die per Lazy-Loading praktisch unbegrenzt viele Kombinationen
// laden kann), damit ein versehentlicher Export bei riesigen Kombinations-
// zahlen nicht zu einem faktisch endlosen Vorgang wird (besonders bei
// PNG, wo jede Kombination einzeln rasterisiert werden muss).
export const ZIP_EXPORT_MAX_COMBOS = 1500;
export const ZIP_EXPORT_BATCH_SIZE = 40;          // Kombinationen pro Zeitscheibe beim Sammeln
export const ZIP_EXPORT_PNG_CONCURRENCY = 6;      // parallele Rasterisierungen beim PNG-Export

export const CUSTOM_MIN_DIM = 2;
export const CUSTOM_MAX_DIM = 12;

// Das Drachenviereck wächst quadratisch mit h (Gesamtpunktzahl ≈ h²),
// daher eine niedrigere Obergrenze als bei linear wachsenden Rastern.
export const KITE_MAX_H = 8;

// Sternpolygon/Kompassstern: Anzahl der Spitzen. Die Radial-Variante hat
// 2×Spitzen Ecken, daher eine bescheidene Obergrenze (Lesbarkeit/Performance).
export const STAR_TIPS_MIN = 3;
export const STAR_TIPS_MAX = 12;

// Kreuz: Armbreite als Anteil der Gesamtausdehnung (0=unendlich dünn,
// 1=quadratisch). Grenzen halten das Kreuz sowohl klar spinnenbeinig
// (nicht auf 0 kollabierend) als auch klar kreuzförmig (nicht auf ein
// Quadrat anwachsend).
export const CROSS_ARM_WIDTH_MIN = 0.1;
export const CROSS_ARM_WIDTH_MAX = 0.8;

// Für den Konzentrations-Constraint bei der Kanten-/Pfadgenerierung.
export const CONCENTRATION_RADIUS_FACTOR = 1.55;
export const CONCENTRATION_THRESHOLD = 0.55;

// Export-Auflösungen (PNG).
export const PNG_EXPORT_SIZE = 1024;
export const PNG_EXPORT_SIZE_CARD = 640;

export function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
