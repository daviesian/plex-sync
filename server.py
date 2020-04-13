import json
import os

import websockets
import asyncio
import ssl


connected = set()


def fmt(ws):
    if not ws or not ws.remote_address:
        return "<None>"
    return f"{ws.remote_address[0]}:{ws.remote_address[1]}"


async def send_to_room(room, message_object, except_ws=None):
    if room is None:
        return

    dests = [ws for ws in connected if ws is not except_ws and ws.room == room]
    if dests:
        await asyncio.wait([ws.send(json.dumps(message_object)) for ws in dests])


async def broadcast_room_status(room):
    room_status = {
        "members": [ws.name for ws in connected if ws.room == room]
    }
    await send_to_room(room, {"roomStatus": room_status})


async def handle_message(source, message):
    if 'action' in message:
        print(f"{fmt(source)} [{source.room}] Action: {message}")
        await send_to_room(source.room, {"dispatch": message['action']}, source)
    elif 'url' in message:
        print(f"{fmt(source)} [{source.room}] Navigate: {message['url']}")
        await send_to_room(source.room, {"navigate": message['url']}, source)
    elif 'joinRoom' in message:
        print(f"{fmt(source)} Joining '{message['joinRoom']}'")
        old_room = source.room
        source.room = message['joinRoom']
        if old_room and old_room != source.room:
            await broadcast_room_status(old_room)
        await broadcast_room_status(source.room)
    elif 'leaveRoom' in message:
        print(f"{fmt(source)} Leaving room.")
        old_room = source.room
        del source.room
        await broadcast_room_status(old_room)
    elif 'setName' in message:
        print(f"{fmt(source)} Setting name {message['setName']}")
        source.name = message['setName']
        await broadcast_room_status(source.room)


async def app(ws, path):
    ws.room = None
    ws.name = f"{fmt(ws)}"
    addr = fmt(ws)
    print(f"{addr} Connected")
    connected.add(ws)
    try:
        async for msg in ws:
            data = json.loads(msg)
            await handle_message(ws, data)
    except websockets.exceptions.ConnectionClosedError:
        pass
    finally:
        print(f"{addr} Disconnected")
        connected.remove(ws)
        await broadcast_room_status(ws.room)

PORT = int(os.getenv("PLEX_SYNC_LISTEN_PORT", "6789"))
CERT_FILE = os.getenv("PLEX_SYNC_CERT_FILE", None)
KEY_FILE = os.getenv("PLEX_SYNC_KEY_FILE", None)

ssl_ctx = None
if CERT_FILE:
    ssl_ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ssl_ctx.load_cert_chain(CERT_FILE, KEY_FILE)


start_server = websockets.serve(app, "0.0.0.0", PORT,ssl=ssl_ctx)

print(f"Listening on port {PORT}")
asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()

