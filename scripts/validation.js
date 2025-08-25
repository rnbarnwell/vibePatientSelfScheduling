export function validateName(name) {
  return typeof name === 'string' && name.trim().length > 0;
}

export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}
