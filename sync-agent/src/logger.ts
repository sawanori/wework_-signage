export function info(message: string, data?: unknown): void {
  console.log(JSON.stringify({ level: 'info', message, ...(data !== undefined ? { data } : {}), timestamp: new Date().toISOString() }));
}

export function warn(message: string, data?: unknown): void {
  console.warn(JSON.stringify({ level: 'warn', message, ...(data !== undefined ? { data } : {}), timestamp: new Date().toISOString() }));
}

export function error(message: string, data?: unknown): void {
  console.error(JSON.stringify({ level: 'error', message, ...(data !== undefined ? { data } : {}), timestamp: new Date().toISOString() }));
}

export function alert(message: string, data?: unknown): void {
  console.error(JSON.stringify({ level: 'alert', message, ...(data !== undefined ? { data } : {}), timestamp: new Date().toISOString() }));
}
