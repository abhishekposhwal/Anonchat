// Vercel Edge WebSocket signaling for AnonChat
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

type Room = { a: WebSocket | null; b: WebSocket | null };
const rooms = new Map<string, Room>();

function peerOther(room: Room, ws: WebSocket | null) {
  return room.a === ws ? room.b : room.a;
}

function safeSend(ws: WebSocket | null, obj: any) {
  try {
    const w: any = ws;
    if (w && w.readyState === w.OPEN) w.send(JSON.stringify(obj));
  } catch {}
}

export async function GET(request: Request) {
  const upgrade = (request.headers.get('upgrade') || '').toLowerCase();
  if (upgrade !== 'websocket') return new Response('Expected WebSocket', { status: 426 });

  // Edge runtime provides WebSocketPair at runtime (not in TS DOM types)
  const WebSocketPairCtor = (globalThis as any).WebSocketPair;
  if (!WebSocketPairCtor) {
    return new Response('WebSocketPair not supported in this runtime', { status: 500 });
  }

  const pair = new WebSocketPairCtor();
  const client: WebSocket = (pair as any)[0];
  const server: WebSocket = (pair as any)[1];

  (server as any).accept(); // required in Edge to finalize the upgrade

  let roomCode: string | null = null;

  server.addEventListener('message', (ev: MessageEvent) => {
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

  // keepalive pings help some proxies
  const ping = setInterval(() => {
    try { (server as any).send(JSON.stringify({ type: 'sys', message: 'ping' })); } catch {}
  }, 30_000);
  server.addEventListener('close', () => clearInterval(ping));

  // TS doesn't know about webSocket in ResponseInit — cast to any
  return new Response(null, { status: 101, webSocket: client } as any);
}
