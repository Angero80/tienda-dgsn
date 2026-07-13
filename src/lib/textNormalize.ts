// src/lib/textNormalize.ts

/**
 * Normaliza texto para COMPARAR (detectar duplicados), nunca para guardar.
 * "Samsúng", "samsung ", "SAMSUNG" y "Samsung" se consideran el mismo valor.
 *
 * Qué hace:
 * 1. Quita espacios sobrantes al inicio/final
 * 2. Colapsa espacios múltiples en uno solo ("Samsung   Colombia" -> "Samsung Colombia")
 * 3. Pasa a minúsculas
 * 4. Quita tildes/acentos (á, é, í, ó, ú, ñ se comparan sin diacríticos)
 */
export function normalizeForCompare(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // elimina marcas diacríticas (tildes)
}

/**
 * Busca si ya existe un valor equivalente en una lista, comparando de forma
 * normalizada. Devuelve el objeto existente si lo encuentra, o null.
 */
export function findDuplicate<T extends { name: string }>(
  list: T[],
  candidateName: string,
  excludeId?: number | null
): T | null {
  const normalizedCandidate = normalizeForCompare(candidateName);
  const found = list.find((item) => {
    if (excludeId != null && (item as any).id === excludeId) return false;
    return normalizeForCompare(item.name) === normalizedCandidate;
  });
  return found || null;
}