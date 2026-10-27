// Política de contraseñas del informe (la misma que valida la API y el User Pool de Cognito).
export function problemasDePassword(password: string): string[] {
  const faltan: string[] = [];
  if (password.length < 8) faltan.push('8 caracteres');
  if (!/[A-Z]/.test(password)) faltan.push('una mayúscula');
  if (!/[a-z]/.test(password)) faltan.push('una minúscula');
  if (!/[0-9]/.test(password)) faltan.push('un número');
  if (!/[^A-Za-z0-9]/.test(password)) faltan.push('un símbolo');
  return faltan;
}
