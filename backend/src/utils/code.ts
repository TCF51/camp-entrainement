// Genere un code court, lisible a l'oral, pour rejoindre un camp.
// On evite les caracteres ambigus (0/O, 1/I/L) pour limiter les erreurs de saisie.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateCampCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}
