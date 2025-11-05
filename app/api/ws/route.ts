export const runtime = 'edge';

type Room = { a: WebSocket | null; b: WebSocket | null };
const rooms = new Map<string, Room>();

function peerOther(room: Room, ws: WebSocket | null) {
  return room.a === ws ? room.b : room.a;
}

function safeSend(ws: WebSocket | null, obj: any) {
  try { ws && ws.readyState === ws.OPEN && ws.send(JSON.stringify(obj)); } catch {}
}

export async function GET(request: Request) {
  const upgrade = (request.headers.get('upgrade') || '').toLowerCase();
  if (upgrade !== 'websocket') return new Response('Expected WebSocket', { status: 426 });

  const pair = new WebSocketPair();
  const client = (pair as any)[0] as WebSocket;
  const server = (pair as any)[1] as WebSocket;

  let roomCode: string | null = null;
  server.accept();

  server.addEventListener('message', (ev) => {
    let msg: any = {};
    try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ''); } catch { return; }

    if (!roomCode) {
      roomCode = (msg.room || '').toUpperCase();
      if (!roomCode) return safeSend(server, { type: 'sys', message: 'Missing room' });
      if (!rooms.has(roomCode)) rooms.set(roomCode, { a: null, b: null });
    }

    const room = rooms.get(roomCode)!;
    const sys = (t: string) => safeSend(server, { type: 'sys', message: t });

    switch (msg.type) {
      case 'create':
      case 'join': {
        if (!room.a) room.a = server;
        else if (!room.b) room.b = server;
        else return sys('Room full');
        sys(`${msg.type === 'create' ? 'Room' : 'Joined'} ${roomCode}`);
        const other = peerOther(room, server);
        if (other) safeSend(other, { type: 'sys', message: 'Peer joined' });
        break;
      }
      case 'offer':
      case 'answer':
      case 'ice': {
        const other = peerOther(room, server);
        if (other) safeSend(other, msg);
        else sys('Waiting for peer…');
        break;
      }
      default: break;
    }
  });

  server.addEventListener('close', () => {
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;
    if (room.a === server) room.a = null;
    if (room.b === server) room.b = null;
    const other = room.a || room.b;
    if (other) safeSend(other, { type: 'sys', message: 'Peer left' });
    if (!room.a && !room.b) rooms.delete(roomCode);
  });

  // keepalive
  const ping = setInterval(() => {
    try { server.send(JSON.stringify({ type: 'sys', message: 'ping' })); } catch {}
  }, 30_000);
  server.addEventListener('close', () => clearInterval(ping));

  return new Response(null, { status: 101, webSocket: client });
}
