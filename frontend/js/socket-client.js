// Socket.io Client for static frontend — connects to window.SERVER_URL
const SERVER_URL = (typeof window !== 'undefined' && window.SERVER_URL) ? window.SERVER_URL : window.location.origin;
let socket = null;
let isConnected = false;

export function initSocket() {
  if (socket && isConnected) return socket;

  socket = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    withCredentials: true
  });

  socket.on('connect', () => {
    isConnected = true;
    console.log(`🔌 socket connected ${socket.id} -> ${SERVER_URL}`);
  });

  socket.on('disconnect', (reason) => {
    isConnected = false;
    console.log('🔌 socket disconnected', reason);
  });

  // Ensure a light-weight lobby:closed handler exists early so it isn't missed
  socket.on('lobby:closed', (payload) => {
    console.log("ℹ️ socket-client received 'lobby:closed'", payload);
    // forward to app-level listeners (if they use the exported 'on' helper)
    // dispatch a DOM event so legacy code can handle it too
    try {
      window.dispatchEvent(new CustomEvent('lobby:closed', { detail: payload }));
    } catch (e) {}
  });

  return socket;
}

// minimal event API (your existing code can expand)
export function on(event, cb) {
  initSocket();
  socket.on(event, cb);
}
export function off(event, cb) { if (socket) socket.off(event, cb); }
export function emit(event, data, cb) { initSocket(); socket.emit(event, data, cb); }
export function disconnect() { if (socket) socket.disconnect(); socket = null; isConnected = false; }

export default { initSocket, on, off, emit, disconnect };