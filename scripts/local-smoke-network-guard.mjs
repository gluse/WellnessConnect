// Test-only child preload: prevent any hosted connection during the copy smoke.
import net from 'node:net';
import { syncBuiltinESMExports } from 'node:module';
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  const options = first && typeof first === 'object' ? first : undefined;
  const host = options?.host ?? (typeof args[1] === 'string' ? args[1] : undefined);
  const localPipe = typeof first === 'string' || typeof options?.path === 'string';
  if (!localPipe && host !== undefined && !['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error('LOCAL_SMOKE_NONLOCAL_CONNECTION_REFUSED');
  }
  return connect.apply(this, args);
};
syncBuiltinESMExports();
